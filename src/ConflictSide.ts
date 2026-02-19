import { Symbol } from "./Symbol";
import { Range, Position } from "vscode";
import { Identifier } from "./Identifier";

export type ConflictSideType = "diff" | "literal";

export class ConflictSide {
  private _lines: string[];
  private _range: Range;
  private _symbols: Symbol[];
  private _identifiers: Identifier[];
  private _type: ConflictSideType;
  private _description: string;
  private _resolvedLines: string[];
  private _hasDiffDescription: boolean;

  public constructor(type: ConflictSideType = "literal") {
    this._lines = [];
    this._range = new Range(new Position(0, 0), new Position(0, 0));
    this._symbols = [];
    this._identifiers = [];
    this._type = type;
    this._description = "";
    this._resolvedLines = [];
    this._hasDiffDescription = false;
  }

  public get lines(): string[] {
    return this._lines;
  }

  public set lines(value: string[]) {
    this._lines = value;
  }

  public get range(): Range {
    return this._range;
  }

  public set range(value: Range) {
    this._range = value;
  }

  public get symbols(): Symbol[] {
    return this._symbols;
  }

  public get identifiers(): Identifier[] {
    return this._identifiers;
  }

  public set identifiers(value: Identifier[]) {
    this._identifiers = value;
  }

  public get type(): ConflictSideType {
    return this._type;
  }

  public set type(value: ConflictSideType) {
    this._type = value;
  }

  public get description(): string {
    return this._description;
  }

  public set description(value: string) {
    this._description = value;
  }

  public get resolvedLines(): string[] {
    return this._resolvedLines;
  }

  public get hasDiffDescription(): boolean {
    return this._hasDiffDescription;
  }

  public set hasDiffDescription(value: boolean) {
    this._hasDiffDescription = value;
  }

  /**
   * Returns the content lines for this side.
   * For diff sides, returns the resolved (reconstructed) lines.
   * For literal sides, returns the raw lines.
   */
  public getContentLines(): string[] {
    if (this._type === "diff") {
      return this._resolvedLines;
    }
    return this._lines;
  }

  /**
   * Reconstruct content from diff +/- lines.
   * + lines are additions (included in result)
   * - lines are removals (excluded from result)
   * space-prefixed lines are context/unchanged (included in result)
   *
   * Lines stored in _lines include the prefix character (+, -, or space).
   */
  public resolveFromDiff(): void {
    this._resolvedLines = [];
    for (const line of this._lines) {
      if (line.length === 0) {
        // Empty lines in diff context are treated as context
        this._resolvedLines.push(line);
        continue;
      }
      const prefix = line.charAt(0);
      if (prefix === "-") {
        // Removed line: skip it (it was in the base, removed by this side)
        continue;
      } else if (prefix === "+") {
        // Added line: include without the prefix
        this._resolvedLines.push(line.substring(1));
      } else if (prefix === " ") {
        // Context/unchanged line: include without the prefix
        this._resolvedLines.push(line.substring(1));
      } else {
        // Line without recognized prefix — treat as context
        this._resolvedLines.push(line);
      }
    }
  }

  /**
   * Extract base content from diff lines.
   * Base content = lines with '-' prefix (removed) + lines with ' ' prefix (context).
   * '+' lines are not part of the base.
   */
  public getBaseLines(): string[] {
    const baseLines: string[] = [];
    for (const line of this._lines) {
      if (line.length === 0) {
        baseLines.push(line);
        continue;
      }
      const prefix = line.charAt(0);
      if (prefix === "-") {
        // Removed line was in the base
        baseLines.push(line.substring(1));
      } else if (prefix === " ") {
        // Context line was in the base
        baseLines.push(line.substring(1));
      }
      // '+' lines are additions, not in the base
    }
    return baseLines;
  }
}
