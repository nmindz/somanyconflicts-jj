import * as vscode from 'vscode'
import { ConflictSection } from './ConflictSection'
import { Parser } from './Parser'
import { NamingConvention } from './Strategy'

export class ConflictLensProvider implements vscode.CodeLensProvider {
  public provideCodeLenses(
    document: vscode.TextDocument,

    token: vscode.CancellationToken,
  ): vscode.CodeLens[] | Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = []
    const conflictSections: ConflictSection[] = Parser.parse(
      document.uri,
      document.getText(),
    ).filter((sec) => sec instanceof ConflictSection) as ConflictSection[]
    const conflictsCount = conflictSections?.length ?? 0

    if (!conflictsCount) {
      return []
    }

    const config = vscode.workspace.getConfiguration('somanyconflicts-jj')
    const naming = config.get<NamingConvention>(
      'namingConvention',
      'jj-native',
    )

    // generate code lens for all conflict sections
    conflictSections.forEach((conflictSection) => {
      const conflict = conflictSection.conflict
      const range: vscode.Range = conflict.range
      const sideCount = conflict.sideCount

      // Accept Side N actions
      for (let i = 0; i < sideCount; i++) {
        let title: string
        if (naming === 'git-friendly' && sideCount === 2) {
          title = i === 0 ? 'Accept Current' : 'Accept Incoming'
        } else {
          title = `Accept Side ${i + 1}`
        }
        codeLenses.push(
          new vscode.CodeLens(range, {
            command: 'somanyconflicts-jj.accept',
            title,
            arguments: [document.uri, range, i, sideCount],
          }),
        )
      }

      // Accept All
      if (sideCount > 1) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            command: 'somanyconflicts-jj.accept',
            title: 'Accept All',
            arguments: [document.uri, range, -2, sideCount],
          }),
        )
      }

      // Accept None
      codeLenses.push(
        new vscode.CodeLens(range, {
          command: 'somanyconflicts-jj.accept',
          title: 'Accept None',
          arguments: [document.uri, range, -1, sideCount],
        }),
      )

      // Existing commands
      codeLenses.push(
        new vscode.CodeLens(range, {
          command: 'somanyconflicts-jj.next',
          title: 'Show Related Conflicts',
          arguments: ['current-conflict', conflict],
        }),
      )
      codeLenses.push(
        new vscode.CodeLens(range, {
          command: 'somanyconflicts-jj.how',
          title: 'Recommend Resolution Strategy',
          arguments: ['current-conflict', conflict],
        }),
      )
    })

    return codeLenses
  }

  public resolveCodeLens(
    codeLens: vscode.CodeLens,
    token: vscode.CancellationToken,
  ) {
    return codeLens
  }
}
