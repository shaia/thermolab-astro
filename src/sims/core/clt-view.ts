/**
 * Pure parts of the CLT figure (CltCollapse): the ensemble of sums for each distribution, grown one term at a time
 * in slices short enough that the page stays smooth, how far each is from the Gaussian, and the binomial view of
 * de Moivre–Laplace. Unit-tested in tests/unit/clt-view.test.ts.
 */

import { uniform } from '~/physics/kinetics';
import {
  binomialGaussianError,
  binomialToGaussian,
  correlatedStepper,
  correlatedVarianceFactor,
  ksDistanceToGaussian,
  stdDev,
  stepDistribution,
  walkerHistogram,
  type BinomialError,
} from '~/physics/sampling';

export const CLT_DISTS = ['pm1', 'uniform', 'heavy', 'correlated'] as const;
export type CltDist = (typeof CLT_DISTS)[number];

export const N_MIN = 1;
export const N_MAX = 400;
/** sums per distribution: the Kolmogorov distance of a true Gaussian sample sits near 0.87/√4000 = 0.014 */
export const CLT_SAMPLES = 4000;
export const DENSITY_SPAN = 4.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The n a log slider at position t ∈ [0, 1] stands for: an integer from 1 to 400. */
export function nFromSlider(t: number): number {
  return clamp(Math.round(N_MAX ** clamp(t, 0, 1)), N_MIN, N_MAX);
}

/** The slider position of n: the inverse of `nFromSlider`. */
export function sliderFromN(n: number): number {
  return Math.log(clamp(n, N_MIN, N_MAX)) / Math.log(N_MAX);
}

/** The reader's (or a lesson step's) n, an integer in [1, 400], or the default. */
export function cleanN(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), N_MIN, N_MAX) : fallback;
}

/** A distribution list from outside: the known names, once each, in the figure's order; the default if none. */
export function cleanDists(v: unknown, fallback: readonly CltDist[]): CltDist[] {
  if (!Array.isArray(v)) return [...fallback];
  const keep = CLT_DISTS.filter((d) => v.includes(d));
  return keep.length > 0 ? keep : [...fallback];
}

/** Persistence for the correlated walk, in [0, 0.95]: the walk is still a walk below 1, but at 1 it never turns. */
export function cleanPersistence(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v * 100) / 100, 0, 0.95) : fallback;
}

/** The success probability of the binomial view, in [0.05, 0.95]. */
export function cleanP(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v * 100) / 100, 0.05, 0.95) : fallback;
}

/** A chain of sums S_n for one distribution: n terms so far, advanced one term for every sample at a time. */
class Chain {
  n = 0;
  sums: Float64Array;
  private step: (out: Float64Array) => void;
  private readonly scratch: Float64Array;

  constructor(
    readonly dist: CltDist,
    readonly samples: number,
    private readonly streamSeed: number,
    private readonly persistence: number,
  ) {
    this.sums = new Float64Array(samples);
    this.scratch = new Float64Array(samples);
    this.step = this.makeStep();
  }

  private makeStep(): (out: Float64Array) => void {
    const rand = uniform(this.streamSeed);
    if (this.dist === 'correlated') return correlatedStepper(this.samples, this.persistence, rand);
    const next = stepDistribution(this.dist).stepper(rand);
    return (out) => {
      for (let i = 0; i < out.length; i++) out[i] = next();
    };
  }

  reset(): void {
    this.n = 0;
    this.sums.fill(0);
    this.step = this.makeStep();
  }

  /** one more term for every sample */
  advance(): void {
    this.step(this.scratch);
    const { sums, scratch } = this;
    for (let i = 0; i < sums.length; i++) sums[i] += scratch[i];
    this.n++;
  }
}

/** The mean and the spread the standardising formula uses: the step's own for the independent walks, ±1's for the correlated one. */
export function standardisation(dist: CltDist): { mean: number; std: number } {
  const d = stepDistribution(dist === 'correlated' ? 'pm1' : dist);
  return { mean: d.mean, std: d.std };
}

/**
 * The sums of the four distributions, for one seed. `advanceTo(n, dists, budgetMs)` grows the chains toward n a
 * term at a time and stops when the time budget is spent, so a figure can finish the work over several frames.
 * A chain that is already past n starts again, so S_n for a given seed and n is always the same numbers.
 */
export class CltEnsemble {
  private readonly chains: Record<CltDist, Chain>;
  private persistence: number;

  constructor(
    readonly samples: number,
    readonly seed: number,
    persistence: number,
  ) {
    this.persistence = persistence;
    this.chains = this.build();
  }

  private build(): Record<CltDist, Chain> {
    const chain = (d: CltDist, i: number) => new Chain(d, this.samples, this.seed * 100003 + 7919 * (i + 1), this.persistence);
    return { pm1: chain('pm1', 0), uniform: chain('uniform', 1), heavy: chain('heavy', 2), correlated: chain('correlated', 3) };
  }

  /** the persistence of the correlated walk; changing it starts that chain again */
  setPersistence(q: number): void {
    if (q === this.persistence) return;
    this.persistence = q;
    this.chains.correlated = new Chain('correlated', this.samples, this.seed * 100003 + 7919 * 4, q);
  }

  /** terms so far in one chain */
  termsOf(dist: CltDist): number {
    return this.chains[dist].n;
  }

  /** true when every listed chain is at n */
  ready(dists: readonly CltDist[], n: number): boolean {
    return dists.every((d) => this.chains[d].n === n);
  }

  /** Grow the listed chains toward n for at most `budgetMs`; returns true when they are all there. */
  advanceTo(n: number, dists: readonly CltDist[], budgetMs: number, now: () => number = () => performance.now()): boolean {
    const start = now();
    for (const d of dists) {
      const c = this.chains[d];
      if (c.n > n) c.reset();
      while (c.n < n) {
        c.advance();
        if (now() - start > budgetMs) return this.ready(dists, n);
      }
    }
    return this.ready(dists, n);
  }

  /** (S_n − n μ)/(σ √n) for the chain's current n, with μ and σ the walk's own (±1's for the correlated walk). */
  standardised(dist: CltDist): Float64Array {
    const c = this.chains[dist];
    if (c.n < 1) throw new RangeError('no terms yet');
    const { mean, std } = standardisation(dist);
    const s = std * Math.sqrt(c.n);
    return Float64Array.from(c.sums, (v) => (v - c.n * mean) / s);
  }
}

export interface CltMeasure {
  /** Kolmogorov distance to the standard Gaussian */
  ks: number;
  /** the sample variance of the standardised sums: 1 for the independent walks, the correlation factor for the other */
  varianceRatio: number;
}

/** The spacing of the standardised sums' sites: 2/√n for the ±1 walks, none for the continuous steps. */
export const latticeOfSums = (dist: CltDist, n: number): number | undefined => (dist === 'pm1' || dist === 'correlated' ? 2 / Math.sqrt(n) : undefined);

export function measure(z: ArrayLike<number>): CltMeasure {
  return { ks: ksDistanceToGaussian(z), varianceRatio: stdDev(z) ** 2 };
}

/**
 * What the lattice alone adds to the Kolmogorov distance of the ±1 sums: half the largest jump of their
 * distribution function, half the central binomial probability (0.25 at n = 1, 0.4/√n for large n).
 */
export function latticeFloor(n: number): number {
  return 0.5 * Math.max(...binomialToGaussian(n, 0.5).pmf);
}

/** What the variance ratio should be: 1 for the independent distributions, Var(S_n)/n for the correlated walk. */
export function expectedVarianceRatio(dist: CltDist, n: number, persistence: number): number {
  return dist === 'correlated' ? correlatedVarianceFactor(persistence, n) : 1;
}

/**
 * The key a measured row is stored under. The persistence matters only to the correlated walk, so changing it
 * leaves the other rows' keys, and their measurements, as they were.
 */
export function rowKey(seed: number, n: number, persistence: number, dist: CltDist): string {
  return dist === 'correlated' ? `${seed}|${n}|${persistence}|${dist}` : `${seed}|${n}|${dist}`;
}

/** The density of the standardised sums as a polyline: lattice-aware bins (spacing 2/√n) for the ±1 walks. */
export function standardisedDensity(z: ArrayLike<number>, dist: CltDist, n: number, nBins = 30): { x: Float64Array; y: Float64Array } {
  const h = walkerHistogram(z, nBins, [-DENSITY_SPAN, DENSITY_SPAN], latticeOfSums(dist, n));
  return { x: h.centres, y: h.density };
}

/** The standard Gaussian density. */
export const standardGaussian = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

export interface BinomialFrame {
  n: number;
  p: number;
  mean: number;
  sigma: number;
  /** first and last k drawn: about 4.5 σ either side of np, inside 0 … n */
  kLo: number;
  kHi: number;
  /** the exact pmf and the Gaussian at k = 0 … n */
  pmf: Float64Array;
  gaussian: Float64Array;
  error: BinomialError;
}

/** Everything the binomial view draws at n and p. */
export function binomialFrame(n: number, p: number): BinomialFrame {
  const { pmf, gaussian } = binomialToGaussian(n, p);
  const mean = n * p;
  const sigma = Math.sqrt(n * p * (1 - p));
  return {
    n,
    p,
    mean,
    sigma,
    kLo: Math.max(0, Math.floor(mean - DENSITY_SPAN * sigma)),
    kHi: Math.min(n, Math.ceil(mean + DENSITY_SPAN * sigma)),
    pmf,
    gaussian,
    error: binomialGaussianError(n, p),
  };
}

/**
 * The difference strip under the binomial: σ·(pmf − Gaussian), which is small everywhere and falls as 1/n for p = ½ (as n^−1/2 otherwise), or, on
 * the log view, the relative error (Gaussian − pmf)/pmf clipped to ±1, which is not small out in the tails.
 */
export function errorStrip(f: BinomialFrame, relative: boolean): Float64Array {
  const out = new Float64Array(f.n + 1);
  for (let k = 0; k <= f.n; k++) {
    out[k] = relative ? clamp((f.gaussian[k] - f.pmf[k]) / f.pmf[k], -1, 1) : f.sigma * (f.pmf[k] - f.gaussian[k]);
  }
  return out;
}
