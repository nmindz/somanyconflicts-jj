import { Uri } from 'vscode'
import { Conflict } from './Conflict'
import { ConflictSection } from './ConflictSection'
import { ConflictSide } from './ConflictSide'
import { Constants } from './Constants'
import { ISection } from './ISection'
import { TextSection } from './TextSection'

export enum ParserState {
  OutsideConflict,
  AwaitingSection,
  DiffHeader,
  DiffContent,
  LiteralContent,
}

export class Parser {
  public static parse(uri: Uri, text: string): ISection[] {
    const sections: ISection[] = []
    const lines: string[] = Parser.getLines(text)

    let state: ParserState = ParserState.OutsideConflict
    let currentConflict: Conflict | undefined
    let currentSide: ConflictSide | undefined
    let currentTextLines: string[] = []
    let startLine: number = -1
    let endLine: number = -1

    for (let i = 0, len = lines.length; i < len; i++) {
      const line: string = lines[i]
      const trimmedLine: string = line.replace(/[\r\n]+$/, '')

      // Check for each marker type
      const startMatch = trimmedLine.match(Constants.conflictStartPattern)
      const isEndMarker = Constants.conflictEndPattern.test(trimmedLine)
      const isDiffMarker = trimmedLine.startsWith(Constants.conflictMarkerDiff)
      const isLiteralMarker = trimmedLine.startsWith(
        Constants.conflictMarkerLiteral,
      )
      const isDiffDescMarker = trimmedLine.startsWith(
        Constants.conflictMarkerDiffDesc,
      )

      switch (state) {
        case ParserState.OutsideConflict:
          if (startMatch) {
            startLine = i

            if (currentTextLines.length > 0) {
              sections.push(new TextSection(currentTextLines))
              currentTextLines = []
            }

            currentConflict = new Conflict()
            currentConflict.uri = uri
            currentConflict.conflictNumber = parseInt(startMatch[1], 10)
            currentConflict.totalConflicts = parseInt(startMatch[2], 10)
            currentConflict.textAfterMarkerStart = trimmedLine.substring(
              Constants.conflictMarkerStart.length,
            )
            state = ParserState.AwaitingSection
          } else {
            currentTextLines.push(line)
          }
          break

        case ParserState.AwaitingSection:
          if (isDiffMarker) {
            currentSide = new ConflictSide('diff')
            currentSide.description = trimmedLine
              .substring(Constants.conflictMarkerDiff.length)
              .trim()
            state = ParserState.DiffHeader
          } else if (isLiteralMarker) {
            currentSide = new ConflictSide('literal')
            currentSide.description = trimmedLine
              .substring(Constants.conflictMarkerLiteral.length)
              .trim()
            state = ParserState.LiteralContent
          } else if (isEndMarker) {
            // Empty conflict, no sections
            this.finalizeConflict(
              currentConflict!,
              trimmedLine,
              i,
              startLine,
              sections,
            )
            currentConflict = undefined
            currentSide = undefined
            endLine = i
            state = ParserState.OutsideConflict
          } else {
            throw new Error(
              'Expected section marker after conflict start' +
                this.formatLog(line, startLine, endLine),
            )
          }
          break

        case ParserState.DiffHeader:
          if (isDiffDescMarker) {
            // \\\\\\\ description line
            currentSide!.hasDiffDescription = true
            state = ParserState.DiffContent
          } else if (
            trimmedLine.length > 0 &&
            (trimmedLine.charAt(0) === '+' ||
              trimmedLine.charAt(0) === '-' ||
              trimmedLine.charAt(0) === ' ')
          ) {
            // No backslash header; this line is already diff content
            currentSide!.lines.push(line)
            state = ParserState.DiffContent
          } else if (isDiffMarker) {
            // Empty diff side, new diff section
            this.finalizeSide(currentConflict!, currentSide!)
            currentSide = new ConflictSide('diff')
            currentSide.description = trimmedLine
              .substring(Constants.conflictMarkerDiff.length)
              .trim()
            state = ParserState.DiffHeader
          } else if (isLiteralMarker) {
            // Empty diff side, new literal section
            this.finalizeSide(currentConflict!, currentSide!)
            currentSide = new ConflictSide('literal')
            currentSide.description = trimmedLine
              .substring(Constants.conflictMarkerLiteral.length)
              .trim()
            state = ParserState.LiteralContent
          } else if (isEndMarker) {
            // Empty diff side, end of conflict
            this.finalizeSide(currentConflict!, currentSide!)
            this.finalizeConflict(
              currentConflict!,
              trimmedLine,
              i,
              startLine,
              sections,
            )
            currentConflict = undefined
            currentSide = undefined
            endLine = i
            state = ParserState.OutsideConflict
          } else {
            // Treat as diff content (some diffs may have unusual content)
            currentSide!.lines.push(line)
            state = ParserState.DiffContent
          }
          break

        case ParserState.DiffContent:
          if (isDiffMarker) {
            // Finalize current diff side, start new diff section
            this.finalizeSide(currentConflict!, currentSide!)
            currentSide = new ConflictSide('diff')
            currentSide.description = trimmedLine
              .substring(Constants.conflictMarkerDiff.length)
              .trim()
            state = ParserState.DiffHeader
          } else if (isLiteralMarker) {
            // Finalize current diff side, start new literal section
            this.finalizeSide(currentConflict!, currentSide!)
            currentSide = new ConflictSide('literal')
            currentSide.description = trimmedLine
              .substring(Constants.conflictMarkerLiteral.length)
              .trim()
            state = ParserState.LiteralContent
          } else if (isEndMarker) {
            // Finalize current diff side, end of conflict
            this.finalizeSide(currentConflict!, currentSide!)
            this.finalizeConflict(
              currentConflict!,
              trimmedLine,
              i,
              startLine,
              sections,
            )
            currentConflict = undefined
            currentSide = undefined
            endLine = i
            state = ParserState.OutsideConflict
          } else {
            // Regular diff line (+/-/space prefix)
            currentSide!.lines.push(line)
          }
          break

        case ParserState.LiteralContent:
          if (isDiffMarker) {
            // Finalize current literal side, start new diff section
            this.finalizeSide(currentConflict!, currentSide!)
            currentSide = new ConflictSide('diff')
            currentSide.description = trimmedLine
              .substring(Constants.conflictMarkerDiff.length)
              .trim()
            state = ParserState.DiffHeader
          } else if (isLiteralMarker) {
            // Finalize current literal side, start new literal section
            this.finalizeSide(currentConflict!, currentSide!)
            currentSide = new ConflictSide('literal')
            currentSide.description = trimmedLine
              .substring(Constants.conflictMarkerLiteral.length)
              .trim()
            state = ParserState.LiteralContent
          } else if (isEndMarker) {
            // Finalize current literal side, end of conflict
            this.finalizeSide(currentConflict!, currentSide!)
            this.finalizeConflict(
              currentConflict!,
              trimmedLine,
              i,
              startLine,
              sections,
            )
            currentConflict = undefined
            currentSide = undefined
            endLine = i
            state = ParserState.OutsideConflict
          } else {
            // Regular literal content line (raw, no prefix)
            currentSide!.lines.push(line)
          }
          break
      }
    }

    if (currentConflict) {
      throw new Error(
        'Conflict still open' + this.formatLog('', startLine, endLine),
      )
    }

    if (currentTextLines.length > 0) {
      sections.push(new TextSection(currentTextLines))
    }

    return sections
  }

  /**
   * Finalize a side: for diff sides, resolve the diff into literal content.
   */
  private static finalizeSide(conflict: Conflict, side: ConflictSide): void {
    if (side.type === 'diff') {
      side.resolveFromDiff()
    }
    conflict.addSide(side)
  }

  /**
   * Finalize a conflict: set end marker text, compute ranges, add to sections.
   */
  private static finalizeConflict(
    conflict: Conflict,
    endLine: string,
    endLineIndex: number,
    startLine: number,
    sections: ISection[],
  ): void {
    conflict.textAfterMarkerEnd = endLine.substring(
      Constants.conflictMarkerEnd.length,
    )
    conflict.computeRanges(startLine, endLineIndex)
    sections.push(new ConflictSection(conflict))
  }

  private static formatLog(
    line: string,
    startLine: number,
    endLine: number,
  ): string {
    return '(' + startLine + '-' + endLine + ')' + ': ' + line
  }

  public static getLines(text: string): string[] {
    const lines: string[] = []
    const textLength: number = text.length

    let currentCharacters: string[] = []

    for (let i: number = 0; i < textLength; i++) {
      const character: string = text.charAt(i)

      if (character === '\n') {
        currentCharacters.push(character)
        lines.push(currentCharacters.join(''))
        currentCharacters = []
      } else {
        if (i > 0 && text.charAt(i - 1) === '\r') {
          lines.push(currentCharacters.join(''))
          currentCharacters = [character]
        } else {
          currentCharacters.push(character)
        }
      }
    }

    if (currentCharacters.length > 0) {
      lines.push(currentCharacters.join(''))
    }

    return lines
  }
}
