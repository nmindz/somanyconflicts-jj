# Change Log

All notable changes to the "somanyconflicts-jj" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [v1.0.0-jj] - 2026-02-18

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

#### Removed

- `simple-git` dependency entirely.
- Git-specific conflict markers (`|||||||`, `=======`).
- Fixed `ours`/`base`/`theirs` properties from `Conflict`.
- Fixed `AcceptOurs`/`AcceptTheirs`/`AcceptBase`/`AcceptBoth` from `Strategy`.

---

## [v0.1.3] - 2021-08-19

- Refined linking and sorting algorithm.
- Critical fix for refresh logic.
- Linted code and dependencies.

## [v0.1.2]

- Add refresh button in both views.

## [v0.1.1]

- Enable query to work normally via web-tree-sitter.

## [v0.1.0]

- Switch to WebAssembly for native module TreeSitter to cross platform.
- Be more self-explainable with tips above buttons.
