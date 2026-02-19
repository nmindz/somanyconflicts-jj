# AGENTS.md — Claude Code Configuration

## Repository Overview

**So Many Conflicts (JJ)** — A VSCode extension for interactively resolving Jujutsu (JJ) conflicts. Groups related conflicts, suggests resolution order and strategy, and supports JJ's N-way conflict format.

Fork of [So Many Conflicts](https://github.com/Symbolk/somanyconflicts) by Bo Shen ([@Symbolk](https://github.com/Symbolk)), adapted for JJ by Evandro Camargo ([@nmindz](https://github.com/nmindz)).

## Build / Test Commands

```bash
# Install dependencies (postinstall builds tree-sitter WASM parsers)
yarn install

# Compile TypeScript → out/
yarn compile

# Run ESLint
yarn lint

# Run test suite
yarn test

# Package as VSIX for distribution
npx @vscode/vsce package
```

To debug: Press **F5** in VSCode to launch the Extension Development Host.

## Running Single Test

N/A — Tests run as a suite via `yarn test` (Mocha + vscode-test).

## Code Style Guidelines

### TypeScript

- **Strict mode**: `tsconfig.json` has `"strict": true`
- **Target**: ES6 (`"target": "es6"`)
- **Module**: CommonJS (`"module": "commonjs"`)
- **ESLint**: Standard config with `@typescript-eslint`
- **No semicolons** (enforced by eslint standard config)
- **Trailing commas** in multiline expressions (warn)
- **Output directory**: `out/` (compiled JS)

### Imports

- Use Node.js `require` style (CommonJS) — the extension runs in VSCode's Node runtime
- VSCode API: `import * as vscode from "vscode"`
- Internal imports: relative paths (`./Parser`, `./Conflict`)

### Naming Conventions

- **Classes**: PascalCase (`Conflict`, `ConflictSide`, `Parser`)
- **Interfaces**: PascalCase with `I` prefix (`ISection`)
- **Constants**: UPPER_SNAKE_CASE for marker strings, camelCase for regex patterns
- **Methods**: camelCase (`resolveFromDiff`, `getBaseLines`)
- **Files**: PascalCase matching their primary export (`Conflict.ts`, `Parser.ts`)

## Key Architecture

### Parser State Machine (`src/Parser.ts`)

Five states: `OutsideConflict` → `AwaitingSection` → `DiffHeader` → `DiffContent` → `LiteralContent`

- Transitions on JJ markers (`<<<<<<<`, `%%%%%%%`, `+++++++`, `>>>>>>>`)
- `\\\\\\\` (7 backslashes) is an optional description line after `%%%%%%%`
- Produces `Conflict` objects with dynamic `sides[]` array

### Conflict Model (`src/Conflict.ts`)

- `_sides: ConflictSide[]` — dynamic array, NOT fixed ours/base/theirs
- `computeRanges()` — calculates line ranges for each side
- `getBaseContent()` — extracts base from diff sections

### ConflictSide Types (`src/ConflictSide.ts`)

- `diff` type: has `diffLines` (unified diff with +/-/space prefixes), `description`
- `literal` type: has `lines` (raw content, no prefix)
- `resolveFromDiff()` — applies diff to base to get resolved content
- `getBaseLines()` — extracts base content (lines without `+` prefix)
- `getContentLines()` — gets resolved content (lines without `-` prefix)

### Strategy System (`src/Strategy.ts`)

- `buildStrategies(sideCount, namingConvention)` — factory for N-way strategies
- `getStrategyCount(sideCount)` — returns total strategy count for given side count
- Supports `jj-native` ("Side 1", "Side 2") and `git-friendly` ("Current", "Incoming") naming

### File Discovery (`src/FileUtils.ts`)

- Primary: `jj resolve --list` via `child_process.execSync`
- Fallback: recursive file scan for JJ conflict markers (`<<<<<<<`)
- Controlled by `somanyconflicts-jj.scanMode` setting

### Extension Entry Point (`src/extension.ts`)

- Registers all `somanyconflicts-jj.*` commands
- Provides CodeLens (`ConflictLensProvider`) and TreeView (`ConflictTreeView`)
- Detects JJ conflicts on file open/save

## File Organization

```
somanyconflicts-jj/
├── src/                        # TypeScript source
│   ├── extension.ts            # VSCode extension entry point
│   ├── Parser.ts               # JJ conflict parser (5-state machine)
│   ├── Conflict.ts             # Conflict model (N-way sides[])
│   ├── ConflictSide.ts         # Side types: diff | literal
│   ├── ConflictSection.ts      # Resolution tracking per section
│   ├── Strategy.ts             # Dynamic resolution strategies
│   ├── FileUtils.ts            # JJ file discovery (CLI + fallback)
│   ├── AlgUtils.ts             # Similarity/dependency algorithms
│   ├── SoManyConflicts.ts      # Main logic: scan, graph, suggestions
│   ├── ConflictLensProvider.ts # CodeLens provider
│   ├── ConflictTreeView.ts     # Sidebar tree view
│   ├── Constants.ts            # JJ marker constants and regex
│   ├── ISection.ts             # Section interface
│   ├── TextSection.ts          # Text section model
│   ├── MutexUtils.ts           # Mutex utilities
│   ├── Symbol.ts               # Symbol extraction
│   ├── Identifier.ts           # Identifier resolution
│   ├── Language.ts             # Language detection
│   └── StringUtils.ts          # String utilities
├── parsers/                    # Pre-built WASM parsers
│   ├── tree-sitter-java.wasm
│   ├── tree-sitter-javascript.wasm
│   ├── tree-sitter-python.wasm
│   └── tree-sitter-typescript.wasm
├── scripts/
│   └── build.js                # WASM parser build script (postinstall)
├── media/                      # Icons and screenshots
├── out/                        # Compiled JS output (gitignored)
├── _jj-conflicts/              # Reference JJ conflict examples
├── package.json                # Extension manifest
├── tsconfig.json               # TypeScript config
├── .eslintrc.yml               # ESLint config
├── .vscode/launch.json         # Debug/launch configs
├── LICENSE                     # MIT License
├── README.md                   # User-facing documentation
├── CHANGELOG.md                # Version history
└── CONTRIBUTING.md             # Contribution guidelines
```

## Critical Rules

1. **No Git dependencies**: This extension uses `jj` CLI exclusively. Never import `simple-git` or any Git library. All VCS interaction goes through `child_process.execSync("jj ...")`.

2. **Command prefix**: All VSCode commands MUST use `somanyconflicts-jj.*` prefix (not `somanyconflicts.*`).

3. **N-way conflict support**: NEVER assume exactly 2 or 3 sides. Always iterate `conflict.sides` dynamically. The number of sides can be arbitrary.

4. **Configuration IDs**: All settings use `somanyconflicts-jj.*` prefix.

5. **Backslash constant**: In `Constants.ts`, the 7-backslash marker (`\\\\\\\`) requires careful escaping. The string literal needs 14 characters (`"\\\\\\\\\\\\\\\\"`) to produce 7 backslashes.

6. **No commits without review**: Never commit and push changes without handing control to the user for review.

## Attribution

- **Original author**: Bo Shen ([@Symbolk](https://github.com/Symbolk)) — [So Many Conflicts](https://github.com/Symbolk/somanyconflicts)
- **Conflict parsing inspiration**: Angelo Mollame ([@angelo-mollame](https://github.com/angelo-mollame)) — [Conflict Squeezer](https://github.com/angelo-mollame/conflict-squeezer)
- **JJ adaptation**: Evandro Camargo ([@nmindz](https://github.com/nmindz))
