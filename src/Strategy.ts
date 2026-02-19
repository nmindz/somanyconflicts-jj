// resolution strategy — dynamic N-way system for JJ conflicts

export type NamingConvention = "jj-native" | "git-friendly";

export interface Strategy {
  index: number;
  display: string;
}

// Fixed strategies that always exist regardless of side count
export const FixedStrategies = {
  Unknown: { index: 0, display: "Unknown" } as Strategy,
  AcceptNone: { index: -1, display: "Accept None" } as Strategy, // index set dynamically
  AcceptAll: { index: -2, display: "Accept All" } as Strategy, // index set dynamically
};

/**
 * Create a strategy for accepting a specific side.
 * Side indices are 0-based in the sides array but 1-based in display.
 */
export function createAcceptSideStrategy(
  sideIndex: number,
  sideCount: number,
  namingConvention: NamingConvention = "jj-native",
): Strategy {
  let display: string;
  if (namingConvention === "git-friendly" && sideCount === 2) {
    // Git-friendly naming for 2-way conflicts
    display = sideIndex === 0 ? "Accept Current" : "Accept Incoming";
  } else {
    // JJ-native naming
    display = `Accept Side ${sideIndex + 1}`;
  }
  return {
    index: sideIndex + 1, // 0 is Unknown, sides start at 1
    display,
  };
}

/**
 * Get the total number of strategies for a given side count.
 * Layout: [Unknown, Side1, Side2, ..., SideN, AcceptNone, AcceptAll]
 */
export function getStrategyCount(sideCount: number): number {
  return sideCount + 3; // Unknown + N sides + AcceptNone + AcceptAll
}

/**
 * Build a complete set of strategies for a given side count.
 */
export function buildStrategies(
  sideCount: number,
  namingConvention: NamingConvention = "jj-native",
): Strategy[] {
  const strategies: Strategy[] = [];

  // Index 0: Unknown
  strategies.push({ index: 0, display: "Unknown" });

  // Index 1..sideCount: Accept Side N
  for (let i = 0; i < sideCount; i++) {
    strategies.push(createAcceptSideStrategy(i, sideCount, namingConvention));
  }

  // Index sideCount + 1: Accept None
  strategies.push({ index: sideCount + 1, display: "Accept None" });

  // Index sideCount + 2: Accept All
  strategies.push({ index: sideCount + 2, display: "Accept All" });

  return strategies;
}

/**
 * Find the strategy with the highest probability.
 */
export function getStrategy(
  probs: Array<number>,
  sideCount: number = 2,
  namingConvention: NamingConvention = "jj-native",
): Strategy {
  const strategies = buildStrategies(sideCount, namingConvention);
  const maxIndex = probs.reduce(
    (iMax, x, i, arr) => (x.toFixed(4) > arr[iMax].toFixed(4) ? i : iMax),
    0,
  );
  if (maxIndex >= 0 && maxIndex < strategies.length) {
    return strategies[maxIndex];
  }
  return strategies[0]; // Unknown
}
