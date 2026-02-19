import { Uri, Position, Range } from "vscode";
import { ConflictSide } from "./ConflictSide";
import { Constants } from "./Constants";
import { Symbol } from "./Symbol";

export class Conflict {
  public uri: Uri | undefined = undefined;
  public range: Range = new Range(new Position(0, 0), new Position(0, 0));

  private _sides: ConflictSide[] = [];
  private _conflictNumber: number = 0;
  private _totalConflicts: number = 0;
  private _textAfterMarkerStart: string = "";
  private _textAfterMarkerEnd: string = "";

  public get sides(): ConflictSide[] {
    return this._sides;
  }

  public get sideCount(): number {
    return this._sides.length;
  }

  public get conflictNumber(): number {
    return this._conflictNumber;
  }

  public set conflictNumber(value: number) {
    this._conflictNumber = value;
  }

  public get totalConflicts(): number {
    return this._totalConflicts;
  }

  public set totalConflicts(value: number) {
    this._totalConflicts = value;
  }

  public get textAfterMarkerStart(): string {
    return this._textAfterMarkerStart;
  }

  public set textAfterMarkerStart(value: string) {
    this._textAfterMarkerStart = value;
  }

  public get textAfterMarkerEnd(): string {
    return this._textAfterMarkerEnd;
  }

  public set textAfterMarkerEnd(value: string) {
    this._textAfterMarkerEnd = value;
  }

  public addSide(side: ConflictSide): void {
    this._sides.push(side);
  }

  public getSide(index: number): ConflictSide {
    if (index < 0 || index >= this._sides.length) {
      throw new Error(
        `Side index ${index} out of bounds (${this._sides.length} sides)`,
      );
    }
    return this._sides[index];
  }

  /**
   * Get the content lines for a specific side.
   * For diff sides, this returns the resolved content.
   * For literal sides, this returns the raw lines.
   */
  public getSideContent(index: number): string[] {
    return this.getSide(index).getContentLines();
  }

  /**
   * Get base content from the first diff side (if any).
   * Returns undefined if no diff sides exist.
   */
  public getBaseContent(): string[] | undefined {
    for (const side of this._sides) {
      if (side.type === "diff") {
        return side.getBaseLines();
      }
    }
    return undefined;
  }

  /**
   * Add a symbol to a specific side.
   */
  public addSideSymbol(sideIndex: number, symbol: Symbol): void {
    if (sideIndex >= 0 && sideIndex < this._sides.length) {
      this._sides[sideIndex].symbols.push(symbol);
    }
  }

  /**
   * Reconstruct the squeezed text for an N-way conflict.
   * For a 2-way conflict, attempts to squeeze identical top/bottom lines.
   * For N-way, reconstructs the full conflict with JJ markers.
   */
  public getSqueezedText(): string {
    if (this._sides.length === 0) {
      return "";
    }

    // Get content lines for all sides
    const sideContents = this._sides.map((s) => s.getContentLines());

    if (this._sides.length === 2) {
      // For 2-way conflicts, attempt to squeeze identical lines from top/bottom
      const side0Lines = sideContents[0];
      const side1Lines = sideContents[1];
      const minLines = Math.min(side0Lines.length, side1Lines.length);
      const maxLines = Math.max(side0Lines.length, side1Lines.length);

      let topCursor = 0;
      let bottomCursor = 0;

      while (topCursor < minLines) {
        if (side0Lines[topCursor] === side1Lines[topCursor]) {
          topCursor++;
        } else {
          break;
        }
      }

      while (bottomCursor < minLines - topCursor) {
        if (
          side0Lines[side0Lines.length - 1 - bottomCursor] ===
          side1Lines[side1Lines.length - 1 - bottomCursor]
        ) {
          bottomCursor++;
        } else {
          break;
        }
      }

      const identicalTopLines = side0Lines.slice(0, topCursor);
      const identicalBottomLines = side0Lines.slice(
        side0Lines.length - bottomCursor,
        side0Lines.length,
      );

      if (topCursor + bottomCursor === maxLines) {
        return [...identicalTopLines, ...identicalBottomLines]
          .filter((part) => part.length > 0)
          .join("");
      }

      // Build squeezed conflict
      const parts: string[] = [];
      parts.push(...identicalTopLines);

      // Re-emit conflict markers with remaining unique lines
      parts.push(Constants.conflictMarkerStart + this._textAfterMarkerStart);
      for (let i = 0; i < this._sides.length; i++) {
        const side = this._sides[i];
        if (side.type === "diff") {
          parts.push(
            Constants.conflictMarkerDiff +
              (side.description ? " " + side.description : ""),
          );
          if (side.hasDiffDescription) {
            parts.push(Constants.conflictMarkerDiffDesc);
          }
          const uniqueLines = side.lines.slice(
            topCursor,
            side.lines.length - bottomCursor,
          );
          parts.push(...uniqueLines);
        } else {
          parts.push(
            Constants.conflictMarkerLiteral +
              (side.description ? " " + side.description : ""),
          );
          const uniqueLines = sideContents[i].slice(
            topCursor,
            sideContents[i].length - bottomCursor,
          );
          parts.push(...uniqueLines);
        }
      }
      parts.push(Constants.conflictMarkerEnd + this._textAfterMarkerEnd);
      parts.push(...identicalBottomLines);

      return parts.filter((part) => part.length > 0).join("");
    }

    // For N-way conflicts (N > 2), just reconstruct without squeezing
    const parts: string[] = [];
    parts.push(Constants.conflictMarkerStart + this._textAfterMarkerStart);
    for (const side of this._sides) {
      if (side.type === "diff") {
        parts.push(
          Constants.conflictMarkerDiff +
            (side.description ? " " + side.description : ""),
        );
        if (side.hasDiffDescription) {
          parts.push(Constants.conflictMarkerDiffDesc);
        }
        parts.push(...side.lines);
      } else {
        parts.push(
          Constants.conflictMarkerLiteral +
            (side.description ? " " + side.description : ""),
        );
        parts.push(...side.lines);
      }
    }
    parts.push(Constants.conflictMarkerEnd + this._textAfterMarkerEnd);
    return parts.filter((part) => part.length > 0).join("");
  }

  /**
   * Compute ranges for N sides with variable marker lines.
   * Each side occupies its content lines between markers.
   */
  public computeRanges(startLine: number, endLine: number) {
    // Track the current line as we step through markers and side content
    let currentLine = startLine + 1; // skip the <<<<<<< line

    for (const side of this._sides) {
      // Skip the marker line (%%%%%%%/+++++++), and optional \\\\\\\ line
      currentLine++; // marker line (%%%%%%%/+++++++)
      if (side.type === "diff" && side.hasDiffDescription) {
        currentLine++; // \\\\\\\ description line
      }

      const sideStartLine = currentLine;
      const sideEndLine = sideStartLine + side.getContentLines().length - 1;

      if (side.getContentLines().length > 0) {
        side.range = new Range(
          new Position(sideStartLine, 0),
          new Position(
            sideEndLine,
            side.getContentLines()[side.getContentLines().length - 1].length -
              1,
          ),
        );
      } else {
        side.range = new Range(
          new Position(sideStartLine, 0),
          new Position(sideStartLine, 0),
        );
      }

      // For diff sides, the raw diff lines may differ in count from resolved lines
      // We advance by the raw line count (what's actually in the file)
      currentLine += side.lines.length;
    }

    this.range = new Range(
      new Position(startLine, 0),
      new Position(
        endLine,
        Constants.conflictMarkerEnd.length + this._textAfterMarkerEnd.length,
      ),
    );
  }
}
