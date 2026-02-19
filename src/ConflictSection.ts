import { AlgUtils } from "./AlgUtils";
import { Conflict } from "./Conflict";
import { ISection } from "./ISection";
import {
  Strategy,
  getStrategy,
  getStrategyCount,
  buildStrategies,
  NamingConvention,
} from "./Strategy";
import { Range } from "vscode";
import * as vscode from "vscode";

export class ConflictSection implements ISection {
  private _conflict: Conflict;
  private _index: string = "";
  public get index(): string {
    return this._index;
  }

  public set index(value: string) {
    this._index = value;
  }

  public get conflict(): Conflict {
    return this._conflict;
  }

  public constructor(conflict: Conflict) {
    this._conflict = conflict;
    // Initialize strategies probability array based on side count
    const stratCount = getStrategyCount(conflict.sideCount);
    this._strategiesProb = new Array<number>(stratCount).fill(1 / stratCount);
  }

  // mutable data stored in conflict section
  // has resolved by developer
  private _hasResolved: boolean = false;
  public get hasResolved(): boolean {
    return this._hasResolved;
  }

  public set hasResolved(value: boolean) {
    this._hasResolved = value;
  }

  // code string after resolution
  private _resolvedCode: string = "";
  public get resolvedCode(): string {
    return this._resolvedCode;
  }

  public set resolvedCode(value: string) {
    this._resolvedCode = value;
  }

  // update interactively as conflicts are resolved
  private _strategiesProb: Array<number>;
  public get strategiesProb(): Array<number> {
    return this._strategiesProb;
  }

  public set strategiesProb(value: Array<number>) {
    this._strategiesProb = value;
  }

  private _stragegy: Strategy = { index: 0, display: "Unknown" };
  public get stragegy(): Strategy {
    return this._stragegy;
  }

  public set stragegy(value: Strategy) {
    this._stragegy = value;
  }

  private getNamingConvention(): NamingConvention {
    const config = vscode.workspace.getConfiguration("somanyconflicts-jj");
    return config.get<NamingConvention>("namingConvention", "jj-native");
  }

  public checkStrategy(newText: string) {
    // compare the new text with each side and combination to check the strategy (trimmed line by line)
    let lines: string[] = newText.split(/\r\n|\r|\n/);
    lines = lines.filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      this._hasResolved = true;
      const strategies = buildStrategies(
        this.conflict.sideCount,
        this.getNamingConvention(),
      );
      // AcceptNone is at index sideCount + 1
      this._stragegy = strategies[this.conflict.sideCount + 1];
      return;
    }

    const naming = this.getNamingConvention();
    const strategies = buildStrategies(this.conflict.sideCount, naming);
    const similarities: number[] = [];

    // Compare against each side's content
    for (let i = 0; i < this.conflict.sideCount; i++) {
      const sideText = [this.conflict.getSideContent(i).join("")];
      const simi = AlgUtils.compareLineByLine([newText], sideText);
      if (simi === 1.0) {
        this._resolvedCode = newText;
        this._hasResolved = true;
        this._stragegy = strategies[i + 1]; // sides start at index 1
        return;
      }
      similarities.push(simi);
    }

    // Compare against concatenation of all sides (AcceptAll)
    const allText = this.conflict.sides
      .map((s) => s.getContentLines().join(""))
      .join("");
    const simiAll = AlgUtils.compareLineByLine([newText], [allText]);
    if (simiAll === 1.0) {
      this._resolvedCode = newText;
      this._hasResolved = true;
      // AcceptAll is at index sideCount + 2
      this._stragegy = strategies[this.conflict.sideCount + 2];
      return;
    }
    similarities.push(simiAll);

    // If none match exactly, find the most similar
    const idx = similarities.reduce(
      (maxIndex, x, i, arr) =>
        x.toFixed(4) > arr[maxIndex].toFixed(4) ? i : maxIndex,
      0,
    );
    if (idx < this.conflict.sideCount) {
      this._stragegy = strategies[idx + 1];
    } else {
      this._stragegy = strategies[this.conflict.sideCount + 2]; // AcceptAll
    }

    this._hasResolved = true;
  }

  public updateStrategy(probs: Array<number>, weight: number): Array<number> {
    // avg (prob*weight) + self.prob
    const newProbs = probs.map((p) => p * weight);
    for (
      let i = 0;
      i < Math.min(newProbs.length, this._strategiesProb.length);
      i++
    ) {
      this._strategiesProb[i] += newProbs[i];
    }
    const sum = this._strategiesProb.reduce((a, b) => a + b, 0);

    if (sum !== 0) {
      for (let i = 0; i < this._strategiesProb.length; i++) {
        this._strategiesProb[i] = +(this._strategiesProb[i] / sum);
      }
    }

    return this._strategiesProb;
  }

  public reverseUpdatedStrategy(
    probs: Array<number>,
    weight: number,
  ): Array<number> {
    const newProbs = probs.map((p) => p * weight);
    const sum = newProbs.reduce((a, b) => a + b, 0);
    if (sum !== 0) {
      for (
        let i = 0;
        i < Math.min(this._strategiesProb.length, newProbs.length);
        i++
      ) {
        this._strategiesProb[i] =
          this._strategiesProb[i] * (1 + weight) - newProbs[i];
      }
    }

    return this._strategiesProb;
  }

  public getText(): string {
    return this._conflict.getSqueezedText();
  }

  public printLineRange(): string {
    return (
      "(" +
      (this._conflict.range.start.line + 1) +
      "-" +
      (this._conflict.range.end.line + 1) +
      ")"
    );
  }

  public updateRange(range: Range) {
    this._conflict.range = range;
    this._conflict.computeRanges(range.start.line, range.end.line);
  }

  public updateRangeWithoutComputing(range: Range) {
    this._conflict.range = range;
  }
}
