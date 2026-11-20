/**
 * Pure helpers for the two dice figures (DiceAverage, DiceSpread): which points of a long run to draw, the
 * log slider for N, and a histogram whose bins respect the lattice the values sit on. Unit-tested in
 * tests/unit/dice-view.test.ts.
 */

/**
 * The 1-based roll counts at which a run of `n` rolls is drawn: about `count` of them spread evenly in
 * log n and as many evenly in n, always including 1 and `n`. Sorted, unique, integers.
 */
export function plotIndices(n: number, count = 400): number[] {
  const total = Math.max(1, Math.round(n));
  const set = new Set<number>([1, total]);
  for (let i = 0; i <= count; i++) {
    set.add(Math.min(total, Math.max(1, Math.round(total ** (i / count)))));
    set.add(Math.min(total, Math.max(1, Math.round((total * i) / count))));
  }
  return Array.from(set).sort((a, b) => a - b);
}

export const N_MIN = 1;
export const N_MAX = 10000;

/** The N a log slider at position t ∈ [0, 1] stands for: an integer from 1 to 10 000. */
export function nFromSlider(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return Math.min(N_MAX, Math.max(N_MIN, Math.round(N_MAX ** c)));
}

/** The slider position of N: the inverse of `nFromSlider`. */
export function sliderFromN(n: number): number {
  return Math.log(Math.min(N_MAX, Math.max(N_MIN, n))) / Math.log(N_MAX);
}

export interface Histogram {
  /** left edge of the first bin, and the common bin width, in the units of the values */
  start: number;
  width: number;
  counts: number[];
}

/**
 * Counts of `values` within [lo, hi]. The values sit on a lattice (the sum of N dice is a whole number, their
 * average a multiple of 1/N), so the bins are a whole number of lattice spacings wide and their edges fall
 * midway between lattice sites: no bin holds more sites than its neighbour and none falls between two sites.
 * At most `maxBins` bins; values outside [lo, hi] are not counted.
 */
export function latticeHistogram(values: ArrayLike<number>, lo: number, hi: number, lattice: number, maxBins = 60): Histogram {
  const sitesPerBin = Math.max(1, Math.ceil((hi - lo) / maxBins / lattice - 1e-9));
  const width = sitesPerBin * lattice;
  const first = Math.floor((lo + lattice / 2) / width);
  const last = Math.max(first, Math.ceil((hi + lattice / 2) / width - 1e-9) - 1);
  const counts = new Array<number>(last - first + 1).fill(0);
  for (let i = 0; i < values.length; i++) {
    const b = Math.floor((values[i] + lattice / 2) / width);
    if (b >= first && b <= last) counts[b - first]++;
  }
  return { start: first * width - lattice / 2, width, counts };
}
