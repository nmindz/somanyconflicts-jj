<div align="center">
  <a href="https://github.com/nmindz/somanyconflicts-jj" target="_blank">
    <img width="160" src="/media/logo.png" alt="logo">
  </a>
  <h1 id="somanyconflicts-jj"><a href="https://github.com/nmindz/somanyconflicts-jj" target="repo">So Many Conflicts (JJ)</a></h1>
</div>

**A VSCode extension to help developers resolve Jujutsu (JJ) conflicts interactively and systematically — group related conflicts, suggest resolution order and strategy.**

Adapted from the original [So Many Conflicts](https://github.com/Symbolk/somanyconflicts) extension by [Bo Shen (@Symbolk)](https://github.com/Symbolk) for the [Jujutsu](https://jj-vcs.github.io/jj/) version control system.

![screen](/media/screenshot.png?raw=true "screen")

## JJ Conflict Format

Unlike Git's 3-way merge markers, JJ uses an N-way conflict format with **diff sections** and **literal sections**:

```
<<<<<<< Conflict 1 of N
%%%%%%% diff description
\\\\\\\        to: side #1
+added line (added by this side)
-removed line (removed by this side)
 context line (unchanged)
+++++++ side #2
literal content of side 2
(raw lines, no prefix)
>>>>>>> Conflict 1 of N ends
```

**Key differences from Git:**

- `<<<<<<<` — suffix is `Conflict X of Y` (numbered)
- `%%%%%%%` — introduces a **diff section** (changes from base to side)
- `\\\\\\\` — optional description line after `%%%%%%%`
- `+++++++` — introduces a **literal content** section
- `>>>>>>>` — suffix includes `ends`
- **N-way conflicts**: can have multiple `%%%%%%%` and `+++++++` sections

## Features

- Group _related_ JJ conflicts and order them topologically — _related_ means: _depending/depended_, _similar_, or _close_.
- Interactively suggest the next related conflict to resolve.
- Suggest resolution strategy based on already resolved relevant conflicts.
- Full N-way conflict support — parse arbitrary numbers of diff and literal sections.
- Configurable naming: JJ-native ("Side 1", "Side 2") or Git-friendly ("Current", "Incoming").

## Language Support

- Java
- TypeScript
- JavaScript
- Python

## Requirements

- OS: macOS / Linux / Windows
- VSCode: ^1.45.0
- [Jujutsu (jj)](https://jj-vcs.github.io/jj/) installed and on PATH (for `jj resolve --list`)

## Installation

### From VSIX (Local Build)

1. Build the extension package:

   ```bash
   npx @vscode/vsce package
   ```

   This produces a `.vsix` file (e.g., `somanyconflicts-jj-1.0.0-jj.vsix`).

2. In VSCode, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) and run:

   ```
   Extensions: Install from VSIX...
   ```

3. Select the generated `.vsix` file.

### From Marketplace

_Not yet published. Coming soon._

## Quick Start

1. Open a JJ repository with unresolved conflicts in VSCode.
2. Click the merge icon in the Activity Bar, or invoke commands starting with `somany` from the Command Palette.
3. Start resolving by starting from the grouped and ordered related conflicts.
4. Navigate and jump to related conflict blocks to resolve along the way.
5. After all conflicts are resolved, run `jj resolve` to finalize.

## Configuration

| Setting                               | Values                      | Default     | Description                                                                                                           |
| ------------------------------------- | --------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| `somanyconflicts-jj.namingConvention` | `jj-native`, `git-friendly` | `jj-native` | How conflict sides are named. JJ-native uses "Side 1", "Side 2". Git-friendly uses "Current"/"Incoming" (2-way only). |
| `somanyconflicts-jj.scanMode`         | `jj-cli`, `file-scan`       | `jj-cli`    | How to discover conflicting files. `jj-cli` runs `jj resolve --list`. `file-scan` scans all files for JJ markers.     |

## Build from Source

### Prerequisites

- **Node.js** ≥ 18.0.0
- **pnpm** ≥ 8.0.0
- **wasi-sdk** (optional — auto-downloaded by tree-sitter-cli on first WASM build if not present)

### Steps

```bash
# Clone the repository
git clone https://github.com/nmindz/somanyconflicts-jj.git
cd somanyconflicts-jj

# Install dependencies (postinstall builds tree-sitter WASM parsers)
pnpm install

# Compile TypeScript to JavaScript
pnpm run compile

# Launch Extension Development Host in VSCode
# Press F5 (or use the "Run Extension" launch config)
```

### Available Scripts

| Command                      | Description                       |
| ---------------------------- | --------------------------------- |
| `pnpm run compile`           | Compile TypeScript → `out/`       |
| `pnpm run watch`             | Watch mode — recompile on changes |
| `pnpm run lint`              | Run ESLint on `src/**/*.ts`       |
| `pnpm run test`              | Run the test suite                |
| `pnpm run vscode:prepublish` | Compile for publishing            |

### Package as VSIX

```bash
npx @vscode/vsce package
```

This generates a `.vsix` file you can install locally or distribute.

## Attribution

This project is a fork of [So Many Conflicts](https://github.com/Symbolk/somanyconflicts), adapted for the Jujutsu version control system.

- **Original author**: [Bo Shen (@Symbolk)](https://github.com/Symbolk) — created the original So Many Conflicts extension under the MIT License.
- **Conflict parsing**: Originally inspired by [Conflict Squeezer](https://github.com/angelo-mollame/conflict-squeezer) by [Angelo Mollame (@angelo-mollame)](https://github.com/angelo-mollame).
- **JJ adaptation**: [Evandro Camargo (@nmindz)](https://github.com/nmindz) — adapted the extension for Jujutsu (JJ), including full N-way conflict support, JJ CLI integration, and the new parser state machine.

## License

MIT — see [LICENSE](./LICENSE).
