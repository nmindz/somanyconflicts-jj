import * as vscode from 'vscode'
import * as path from 'path'
import { Parser } from './Parser'
import { ConflictSection } from './ConflictSection'
import { Symbol } from './Symbol'
import { Conflict } from './Conflict'
import { FileUtils } from './FileUtils'
import { AlgUtils } from './AlgUtils'
import type * as TreeSitter from 'web-tree-sitter'
import { Identifier } from './Identifier'
import { Language, languages } from './Language'
import { getStrategy, Strategy, NamingConvention } from './Strategy'
import { ISection } from './ISection'
import { TextSection } from './TextSection'
import { StringUtils } from './StringUtils'
const graphlib = require('@dagrejs/graphlib')

// Lazy-loaded tree-sitter module
let TreeSitterModule: typeof TreeSitter | null = null
let treeSitterReady: Promise<void> | null = null

async function ensureTreeSitter(): Promise<typeof TreeSitter> {
  if (!TreeSitterModule) {
    try {
      TreeSitterModule = require('web-tree-sitter')
      if (!treeSitterReady) {
        treeSitterReady = TreeSitterModule!.Parser.init({
          locateFile: (file: string) => path.join(__dirname, file),
        }).catch((err: any) => {
          console.error('[somanyconflicts-jj] TreeSitter init failed:', err?.message || err)
          TreeSitterModule = null
          treeSitterReady = null
        })
      }
      await treeSitterReady
    } catch (err: any) {
      console.error('[somanyconflicts-jj] Failed to load web-tree-sitter:', err?.message || err)
      TreeSitterModule = null
      treeSitterReady = null
      throw err
    }
  } else if (treeSitterReady) {
    await treeSitterReady
  }
  if (!TreeSitterModule) {
    throw new Error('web-tree-sitter is not available')
  }
  return TreeSitterModule
}

export class SoManyConflicts {
  /** singleton treesitter instances for different languages */
  private static queriers = new Map<
    Language,
    [TreeSitter.Parser, TreeSitter.Query]
  >()

  public static parseFile(absPath: string, content?: string): ISection[] {
    if (!content) {
      content = FileUtils.readFileContent(absPath)
    }
    const uri: vscode.Uri = vscode.Uri.file(absPath)
    const sections: ISection[] = Parser.parse(uri, content)
    return sections
  }

  public static scanConflictsInFile(
    absPath: string,
    content?: string,
  ): ConflictSection[] {
    return this.parseFile(absPath, content).filter(
      (sec) => sec instanceof ConflictSection,
    ) as ConflictSection[]
  }

  public static async scanAllConflicts(
    workspace: string,
  ): Promise<[Map<string, ISection[]>, Map<string, ConflictSection[]>]> {
    let message: string = ''
    const conflictSectionsByFile = new Map<string, ConflictSection[]>()
    const sectionsByFile = new Map<string, ISection[]>()

    // get all files with JJ conflicts in the opened workspace
    try {
      const filePaths: string[] =
        await FileUtils.getConflictingFilePaths(workspace)
      if (filePaths.length === 0) {
        message = 'Found no conflicting files in the workspace!'
        vscode.window.showWarningMessage(message)
        return [sectionsByFile, conflictSectionsByFile]
      }
      for (const absPath of filePaths) {
        console.log('Start parsing ' + absPath)
        // scan and parse all conflict blocks
        const sections: ISection[] = this.parseFile(absPath)
        const conflictSections: ConflictSection[] = sections.filter(
          (sec) => sec instanceof ConflictSection,
        ) as ConflictSection[]
        const uri: vscode.Uri = vscode.Uri.file(absPath)
        const language: Language = FileUtils.detectLanguage(absPath)

        // extract identifiers in the whole file
        const symbols = (await vscode.commands.executeCommand(
          'vscode.executeDocumentSymbolProvider',
          uri,
        )) as vscode.DocumentSymbol[]
        for (const conflictSection of conflictSections) {
          const conflict: Conflict = conflictSection.conflict
          // LSP: filter symbols involved in each conflict block
          if (symbols != null) {
            this.filterConflictingSymbols(conflict, symbols)
          }
          // AST: extract identifiers (def/use) to complement LSP results
          this.extractConflictingIdentifiers(conflict, language)
        }
        conflictSectionsByFile.set(uri.fsPath, conflictSections)
        sectionsByFile.set(uri.fsPath, sections)
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message)
      return [sectionsByFile, conflictSectionsByFile]
    }
    return [sectionsByFile, conflictSectionsByFile]
  }

  private static async extractConflictingIdentifiers(
    conflict: Conflict,
    language: Language,
  ) {
    // Iterate all sides dynamically
    for (const side of conflict.sides) {
      side.identifiers = await this.analyzeCode(
        side.getContentLines(),
        language,
      )
    }
  }

  private static async analyzeCode(
    codeLines: string[],
    language: Language,
  ): Promise<Identifier[]> {
    const identifiers: Identifier[] = []

    // early return if we don't support the language
    const { queryString } = languages[language] || {}
    if (!queryString) return []

    // store the tree sitter instance for later use
    if (!this.queriers.get(language)) {
      await this.initParser(language, queryString)
    }
    const instance = this.queriers.get(language)

    if (instance) {
      try {
        const tree = instance[0].parse(codeLines.join('\n'))
        if (!tree) return identifiers
        const matches: TreeSitter.QueryMatch[] = instance[1].matches(
          tree.rootNode,
        )
        for (const match of matches) {
          const captures: TreeSitter.QueryCapture[] = match.captures
          for (const capture of captures) {
            if (capture.node != null) {
              if (capture.node.text != null) {
                identifiers.push(
                  new Identifier(capture.name, capture.node.text),
                )
              }
            }
          }
        }
      } catch (error) {
        console.log(error)
      }
    }
    return identifiers
  }

  private static async initParser(language: Language, queryString: string) {
    const ts = await ensureTreeSitter()
    const parser = new ts.Parser()

    const langFile = path.join(
      __dirname,
      'parsers',
      language.toLowerCase() + '.wasm',
    )
    const langObj = await ts.Language.load(langFile)
    parser.setLanguage(langObj)
    const query = new ts.Query(langObj, queryString)
    this.queriers.set(language, [parser, query])
  }

  public static constructGraph(
    allConflictSections: ConflictSection[],
    sectionsByFile: Map<string, ISection[]>,
  ) {
    const graph = new graphlib.Graph()

    // construct graph nodes
    for (const conflictSection of allConflictSections) {
      graph.setNode(conflictSection.index, {
        file_path: conflictSection.conflict.uri?.fsPath,
        range: conflictSection.printLineRange(),
      })
    }

    // for each pair of conflicts
    let i
    let j: number = 0
    // construct graph edges
    for (i = 0; i < allConflictSections.length; ++i) {
      const conflict1: Conflict = allConflictSections[i].conflict
      const index1 = allConflictSections[i].index
      for (j = i + 1; j < allConflictSections.length; ++j) {
        const conflict2: Conflict = allConflictSections[j].conflict
        const index2 = allConflictSections[j].index
        const dependency = AlgUtils.computeDependency(conflict1, conflict2)
        if (dependency > 0) {
          const lastWeight = graph.edge(index1, index2)
          if (lastWeight == null) {
            graph.setEdge(index1, index2, dependency)
          } else {
            graph.setEdge(index1, index2, lastWeight + dependency)
          }
        }
        const similarity = AlgUtils.computeSimilarity(conflict1, conflict2)
        if (similarity > 0.5) {
          const lastWeight = graph.edge(index1, index2)
          if (lastWeight == null) {
            graph.setEdge(index1, index2, similarity)
          } else {
            graph.setEdge(index1, index2, lastWeight + similarity)
          }
        }
      }
    }
    for (const [, v] of sectionsByFile) {
      const size = v.length
      for (i = 0; i < size; i++) {
        if (v[i] instanceof ConflictSection) {
          // for now only check nesting relation for neighboring conflicts
          let cnt = 0 // simulate a stack, number of open braces (only for langs with braces)
          const section1: ConflictSection = v[i] as ConflictSection
          // Use base content from first diff side, or first side's content
          const baseContent =
            section1.conflict.getBaseContent() ||
            (section1.conflict.sideCount > 0
              ? section1.conflict.getSideContent(0)
              : [])
          cnt += StringUtils.countOpenBraces(baseContent)
          if (cnt <= 0) {
            continue
          }
          for (j = i + 1; j < size; j++) {
            if (v[j] instanceof TextSection) {
              cnt += StringUtils.countOpenBraces((v[j] as TextSection).lines)
            } else if (v[j] instanceof ConflictSection) {
              const section2: ConflictSection = v[j] as ConflictSection
              const baseContent2 =
                section2.conflict.getBaseContent() ||
                (section2.conflict.sideCount > 0
                  ? section2.conflict.getSideContent(0)
                  : [])
              cnt += StringUtils.countOpenBraces(baseContent2)
              if (cnt > 0) {
                const lastWeight = graph.edge(section1.index, section2.index)
                if (lastWeight == null) {
                  graph.setEdge(section1.index, section2.index, 1.0)
                } else {
                  graph.setEdge(
                    section1.index,
                    section2.index,
                    lastWeight + 1.0,
                  )
                }
              }
              break
            }
          }
        }
      }
    }

    return graph
  }

  public static suggestStartingPoint(
    allConflictSections: ConflictSection[],
    graph: any,
  ): ConflictSection[][] {
    const groupedConflictSections: ConflictSection[][] = []
    const components = graphlib.alg.components(graph)
    let topoSorted: string[] = []
    const cycles: [] = graphlib.alg.findCycles(graph)
    if (!cycles || cycles.length === 0) {
      topoSorted = graphlib.alg.topsort(graph)
    }

    // sort components by the number of nodes
    components.sort((a: [], b: []) => {
      return b.length - a.length
    })
    for (const component of components) {
      if (component.length > 0) {
        if (topoSorted.length > 0) {
          component.sort((a: string, b: string) => {
            return topoSorted.indexOf(a) - topoSorted.indexOf(b)
          })
        }
        const sections: ConflictSection[] = []
        for (const element of component) {
          const index: number = +element
          sections.push(allConflictSections[index])
        }
        groupedConflictSections.push(sections)
      }
    }
    return groupedConflictSections
  }

  public static suggestResolutionStrategy(
    allConflictSections: ConflictSection[],
    conflictIndex: number,
    decorationType: vscode.TextEditorDecorationType,
  ) {
    const activeEditor = vscode.window.activeTextEditor
    if (!activeEditor) {
      return
    }

    const focused: ConflictSection = this.getConflictSectionByIndex(
      allConflictSections,
      conflictIndex,
    )
    const config = vscode.workspace.getConfiguration('somanyconflicts-jj')
    const naming = config.get<NamingConvention>(
      'namingConvention',
      'jj-native',
    )
    const suggestedStrategy: Strategy = getStrategy(
      focused.strategiesProb,
      focused.conflict.sideCount,
      naming,
    )

    if (suggestedStrategy.index !== 0) {
      // Not Unknown
      const decorationOptions: vscode.DecorationOptions[] = []
      const sideCount = focused.conflict.sideCount

      if (
        suggestedStrategy.index >= 1 &&
        suggestedStrategy.index <= sideCount
      ) {
        // Accept a specific side
        const sideIdx = suggestedStrategy.index - 1
        decorationOptions.push({
          range: focused.conflict.getSide(sideIdx).range,
          hoverMessage: 'Suggest to ' + suggestedStrategy.display,
        })
      } else if (suggestedStrategy.index === sideCount + 2) {
        // AcceptAll — highlight all sides
        for (let i = 0; i < sideCount; i++) {
          decorationOptions.push({
            range: focused.conflict.getSide(i).range,
            hoverMessage: 'Suggest to ' + suggestedStrategy.display,
          })
        }
      }
      // AcceptNone (sideCount + 1) — no decoration needed

      if (decorationOptions.length > 0) {
        activeEditor.setDecorations(decorationType, decorationOptions)
      } else {
        vscode.window.showInformationMessage(
          'Suggest to ' + suggestedStrategy.display,
        )
      }
    } else {
      vscode.window.showWarningMessage('No suggestion for this conflict.')
    }
  }

  public static suggestRelatedConflicts(
    allConflictSections: ConflictSection[],
    conflictIndex: number,
    graph: any,
  ) {
    const focusedConflict: Conflict = this.getConflictByIndex(
      allConflictSections,
      conflictIndex,
    )
    const locations: vscode.Location[] = []
    const edges = graph.nodeEdges(conflictIndex)
    if (edges) {
      for (const edge of edges) {
        if (!isNaN(+edge.v)) {
          if (+edge.v !== conflictIndex) {
            const conflict = this.getConflictByIndex(
              allConflictSections,
              +edge.v,
            )
            // Use first side's range for location
            const range =
              conflict.sideCount > 0
                ? conflict.getSide(0).range
                : conflict.range
            locations.push(new vscode.Location(conflict.uri!, range))
          }
        }
        if (!isNaN(+edge.w)) {
          if (+edge.w !== conflictIndex) {
            const conflict = this.getConflictByIndex(
              allConflictSections,
              +edge.w,
            )
            const range =
              conflict.sideCount > 0
                ? conflict.getSide(0).range
                : conflict.range
            locations.push(new vscode.Location(conflict.uri!, range))
          }
        }
      }
    }

    if (edges.length === 0 || locations.length === 0) {
      vscode.window.showWarningMessage(
        'Found no related conflicts for this conflict.',
      )
    } else {
      const focusedRange =
        focusedConflict.sideCount > 0
          ? focusedConflict.getSide(0).range
          : focusedConflict.range
      vscode.commands.executeCommand(
        'editor.action.peekLocations',
        focusedConflict.uri,
        focusedRange.start,
        locations,
        'peek',
      )
    }
  }

  private static getConflictByIndex(
    allConflictSections: ConflictSection[],
    index: number,
  ): Conflict {
    return allConflictSections[index].conflict
  }

  public static getConflictSectionByIndex(
    allConflictSections: ConflictSection[],
    index: number,
  ): ConflictSection {
    return allConflictSections[index]
  }

  private static async filterConflictingSymbols(
    conflict: Conflict,
    symbols: vscode.DocumentSymbol[],
  ) {
    for (const symbol of symbols) {
      // Check each side dynamically
      for (let i = 0; i < conflict.sideCount; i++) {
        const side = conflict.getSide(i)
        if (side.range.contains(symbol.selectionRange)) {
          const refs = await this.getRefs(
            conflict.uri!,
            this.middlePosition(symbol.selectionRange),
          )
          conflict.addSideSymbol(
            i,
            new Symbol(symbol, refs == null ? [] : refs),
          )
        }
      }
      if (symbol.children.length > 0) {
        this.filterConflictingSymbols(conflict, symbol.children)
      }
    }
  }

  private static middlePosition(range: vscode.Range): vscode.Position {
    return new vscode.Position(
      Math.round((range.start.line + range.end.line) / 2),
      Math.round((range.start.character + range.end.character) / 2),
    )
  }

  private static async getRefs(
    uri: vscode.Uri,
    position: vscode.Position,
  ): Promise<vscode.Location[] | undefined> {
    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      uri,
      position,
    )
    return refs
  }
}
