# Change Log

All notable changes to the "somanyconflicts-jj" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [v0.1.0] - 2026-02-19

### Added

- **esbuild bundling**: Extension is now bundled into a single `dist/extension.js` with all runtime dependencies included. VSIX packages are self-contained — no `node_modules` needed.
- **Accept Side CodeLens actions**: One-click "Accept Side 1" / "Accept Side 2" / "Accept All" / "Accept None" inline actions above each conflict block. Respects naming convention setting (Git-friendly: "Accept Current" / "Accept Incoming" for 2-way).
- `somanyconflicts-jj.accept` command for programmatic conflict resolution.
- `esbuild.mjs` build configuration with WASM file copying.
- `check-types` and `package` npm scripts.

### Fixed

- **Extension activation failure**: `web-tree-sitter` is now lazy-loaded (was eagerly imported at module scope, causing silent crash before `activate()` ran).
- **Tree-sitter query errors**: Fixed `new_expression` patterns in JavaScript and TypeScript queries for compatibility with tree-sitter grammar v0.25+.
- **Double newline on accept**: Content lines already include `\n` terminators — join with empty string instead of `\n`.
- **Tree view labels**: Skip JJ conflict markers (`%%%%%%%`, `+++++++`, etc.) and show first meaningful content line.

### Improved

- **Group labels**: Tree view groups now show file names (e.g., "utils.ts, config.ts (3 conflicts)") instead of generic "Group1", "Group2".
- **Conflict labels**: Tree view items show a clean first-line preview (truncated to 60 chars) instead of raw conflict marker text.
- **Strategy message**: Clarified "No suggestion" to explain strategy propagation requirement.
- Build pipeline: `compile` now runs `tsc --noEmit` + esbuild. `watch` runs both in parallel.

## [v0.0.1] - 2026-02-18

### Fork: Adapted for Jujutsu (JJ)

This release forks the original [So Many Conflicts](https://github.com/Symbolk/somanyconflicts) extension by Symbolk and adapts it for the Jujutsu version control system.

#### Added

- Full N-way JJ conflict parsing with `%%%%%%%` (diff) and `+++++++` (literal) sections.
- State machine parser supporting `OutsideConflict`, `AwaitingSection`, `DiffHeader`, `DiffContent`, `LiteralContent` states.
- `ConflictSide` type system (`diff` | `literal`) with `resolveFromDiff()` and `getBaseLines()` methods.
- Dynamic strategy system supporting arbitrary number of sides (N-way conflicts).
- Configurable naming convention: `jj-native` ("Side 1", "Side 2") or `git-friendly` ("Current", "Incoming").
- Configurable scan mode: `jj-cli` (uses `jj resolve --list`) or `file-scan` (scans files for markers).
- JJ conflict file discovery via `jj resolve --list` CLI command.
- `conflictNumber` and `totalConflicts` properties parsed from JJ markers.
- `Conflict.getBaseContent()` to extract base content from diff sections.

#### Changed

- Extension ID: `somanyconflicts` → `somanyconflicts-jj`.
- Display name: "So Many Conflicts" → "So Many Conflicts (JJ)".
- All command IDs: `somanyconflicts.*` → `somanyconflicts-jj.*`.
- `Conflict` class: replaced fixed `ours`/`base`/`theirs` with dynamic `sides[]` array.
- `Parser`: complete rewrite from Git 3-way to JJ N-way state machine.
- `Strategy`: replaced fixed object with dynamic `buildStrategies()` factory.
- `ConflictSection`: dynamic `strategiesProb` array sized by `getStrategyCount(sideCount)`.
- `AlgUtils`: iterates sides dynamically instead of fixed ours/base/theirs.
- `SoManyConflicts`: all side-specific logic now iterates `conflict.sides`.
- `FileUtils`: replaced `simple-git` with `jj resolve --list` + file scanning fallback.
- All user-facing messages: "merge conflicts" → "JJ conflicts".
- Fixed typo "Reamining" → "Remaining".
- Package manager: Yarn → pnpm.
- Tree-sitter toolchain: 0.19 → 0.26 (web-tree-sitter, tree-sitter-cli, all grammars).

#### Removed

- `simple-git` dependency entirely.
- Git-specific conflict markers (`|||||||`, `=======`).
- Fixed `ours`/`base`/`theirs` properties from `Conflict`.
- Fixed `AcceptOurs`/`AcceptTheirs`/`AcceptBase`/`AcceptBoth` from `Strategy`.
- `tree-sitter` native binding (replaced by web-tree-sitter WASM only).

---

## [v0.0.0] (fork) — Inherited from [So Many Conflicts](https://github.com/Symbolk/somanyconflicts)

The following changes were made by the original author [Bo Shen (@Symbolk)](https://github.com/Symbolk) in the upstream repository before this fork.

### v0.1.3 - 2021-08-19

- Refined linking and sorting algorithm.
- Critical fix for refresh logic.
- Linted code and dependencies.

### v0.1.2

- Add refresh button in both views.

### v0.1.1

- Enable query to work normally via web-tree-sitter.

### v0.1.0

- Switch to WebAssembly for native module TreeSitter to cross platform.
- Be more self-explainable with tips above buttons.
