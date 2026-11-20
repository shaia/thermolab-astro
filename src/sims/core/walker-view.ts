/**
 * Pure parts of the walker-cloud figure (WalkerCloud): an ensemble of walkers advanced step by step, and the
 * choices a frame needs (axis range, histogram bins, walk rate, the walkers slider). The ensemble draws its steps
 * time-major from the same stream as `randomWalk`, so what the figure shows is what the physics module computes.
 * Unit-tested in tests/unit/walker-view.test.ts.
 */

import { uniform } from '~/physics/kinetics';
import { stepDistribution, walkerHistogram, type StepDist, type StepName, type WalkerHistogram } from '~/physics/sampling';

export const WALKERS_MIN = 100;
export const WALKERS_MAX = 10000;
export const STEPS_MIN = 10;
export const STEPS_MAX = 2000;
/** the faint paths drawn behind the highlighted one */
export const PATHS_MAX = 120;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The walkers a log slider at position t ∈ [0, 1] stands for: 100 to 10 000, rounded to a tidy number. */
export function walkersFromSlider(t: number): number {
  const raw = WALKERS_MIN * (WALKERS_MAX / WALKERS_MIN) ** clamp(t, 0, 1);
  const unit = 10 ** Math.floor(Math.log10(raw) - 1);
  return clamp(Math.round(raw / unit) * unit, WALKERS_MIN, WALKERS_MAX);
}

/** The slider position of a walker count: the inverse of `walkersFromSlider`. */
export function sliderFromWalkers(n: number): number {
  return Math.log(clamp(n, WALKERS_MIN, WALKERS_MAX) / WALKERS_MIN) / Math.log(WALKERS_MAX / WALKERS_MIN);
}

/** A walker or step count from outside (a lesson step): an integer inside [lo, hi], or the default. */
export function cleanCount(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : fallback;
}

/** A step distribution name from outside, or the default. */
export function cleanStep(v: unknown, fallback: StepName): StepName {
  return v === 'pm1' || v === 'biased' || v === 'uniform' || v === 'heavy' ? v : fallback;
}

/** Steps per second of a run: a run of `steps` lasts about ten seconds, never slower than 12 or faster than 200 a second. */
export function walkRate(steps: number): number {
  return clamp(steps / 10, 12, 200);
}

/** How many steps one press of Step (or an arrow key) takes: one fortieth of the run, at least one. */
export function stepChunk(steps: number): number {
  return Math.max(1, Math.round(steps / 40));
}

/** The time by which a task counts as done: two hundred steps, or the whole run if it is shorter. */
export function taskTime(steps: number): number {
  return Math.min(steps, 200);
}

/**
 * The position axis of a run of `steps` steps: μ₁T ± 3.6 σ₁√T, widened to include the origin, so that the faint
 * paths, the histogram at every t and the Gaussian prediction all share one scale for the whole run.
 */
export function positionSpan(dist: StepDist, steps: number): [number, number] {
  const reach = 3.6 * dist.std * Math.sqrt(steps);
  const drift = dist.mean * steps;
  return [Math.min(0, drift) - reach, Math.max(0, drift) + reach];
}

/** The lattice of the positions: ±1 steps land on every second site, the other walks on none. */
export const latticeOf = (dist: StepDist): number | undefined => (dist.name === 'pm1' || dist.name === 'biased' ? 2 : undefined);

export class WalkerEnsemble {
  readonly dist: StepDist;
  readonly nPaths: number;
  /** steps taken so far */
  t = 0;
  /** every walker's current position */
  readonly pos: Float64Array;
  /** the first `nPaths` walkers' whole paths, row w at `w * (steps + 1)`; walker 0 is the highlighted one */
  readonly paths: Float64Array;
  /** the ensemble mean and the spread (n − 1) across all walkers, at every t taken so far */
  readonly mean: Float64Array;
  readonly spread: Float64Array;
  private readonly next: () => number;

  constructor(
    readonly walkers: number,
    readonly steps: number,
    step: StepName | StepDist,
    readonly seed: number,
  ) {
    if (!(walkers >= 2) || !(steps >= 1)) throw new RangeError('an ensemble needs two walkers and one step');
    this.dist = typeof step === 'string' ? stepDistribution(step) : step;
    this.nPaths = Math.min(PATHS_MAX, walkers);
    this.pos = new Float64Array(walkers);
    this.paths = new Float64Array(this.nPaths * (steps + 1));
    this.mean = new Float64Array(steps + 1);
    this.spread = new Float64Array(steps + 1);
    this.next = this.dist.stepper(uniform(seed * 100003 + 17));
  }

  get done(): boolean {
    return this.t >= this.steps;
  }

  /** Take up to `k` more steps; returns how many were taken. */
  advance(k: number): number {
    const n = Math.min(Math.max(0, Math.floor(k)), this.steps - this.t);
    const { walkers, pos, next } = this;
    const cols = this.steps + 1;
    for (let i = 0; i < n; i++) {
      const t = ++this.t;
      let sum = 0;
      for (let w = 0; w < walkers; w++) {
        const x = (pos[w] += next());
        sum += x;
        if (w < this.nPaths) this.paths[w * cols + t] = x;
      }
      const m = sum / walkers;
      let ss = 0;
      for (let w = 0; w < walkers; w++) ss += (pos[w] - m) ** 2;
      this.mean[t] = m;
      this.spread[t] = Math.sqrt(ss / (walkers - 1));
    }
    return n;
  }

  /** The cloud's histogram at the current t, on the run's fixed span (so a wider cloud is not rebinned away). */
  histogram(nBins = 50): WalkerHistogram {
    return walkerHistogram(this.pos, nBins, positionSpan(this.dist, this.steps), latticeOf(this.dist));
  }

  /** The ensemble mean's standard error now, spread/√walkers (0 at t = 0). */
  get standardError(): number {
    return this.spread[this.t] / Math.sqrt(this.walkers);
  }
}

/** At most `maxPoints` indices 0 … t, always including 0 and t: how a long path is drawn without 2000 segments each. */
export function drawIndices(t: number, maxPoints = 300): number[] {
  const stride = Math.max(1, Math.ceil(t / maxPoints));
  const out: number[] = [];
  for (let i = 0; i < t; i += stride) out.push(i);
  out.push(t);
  return out;
}
