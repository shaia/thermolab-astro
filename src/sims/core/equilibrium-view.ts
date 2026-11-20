/**
 * Pure helpers for the two equilibrium figures (TwoBodies, RelaxationScale): sizes on a log slider, the grid of
 * oscillators, the thinned history of a live run, the axis of the log gap and the three panels of the scale
 * figure. Unit-tested in tests/unit/equilibrium-view.test.ts.
 */

import {
  fromTemperatures,
  relaxationScatter,
  relaxationTime,
  simulateEnergyExchange,
  totalQuanta,
  type ExchangeResult,
  type TwoBodyState,
} from '~/physics/equilibrium';
import { uniform } from '~/physics/kinetics';

export const N_MIN = 10;
export const N_MAX = 2000;
export const T_MIN = 0.5;
export const T_MAX = 10;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** a number prop or step value inside [lo, hi], else the default `d` */
export const cleanNumber = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d;
export const cleanCount = (v: unknown, lo: number, hi: number, d: number): number => Math.round(cleanNumber(v, lo, hi, d));

/** The oscillator count of a log slider whose position is log10 n: a whole number from 10 to 2000. */
export const nFromLog = (v: number): number => clamp(Math.round(10 ** v), N_MIN, N_MAX);
export const logOfN = (n: number): number => Math.log10(clamp(n, N_MIN, N_MAX));

/** The run length: the prop if it is a usable number of steps, else six times the total number of quanta. */
export function runLength(state: TwoBodyState, steps?: unknown): number {
  const q = totalQuanta(state);
  const six = 6 * q;
  return typeof steps === 'number' && Number.isFinite(steps) && steps >= 1 ? Math.min(Math.round(steps), 1_000_000) : Math.min(six, 1_000_000);
}

/** Steps to advance per animation frame so that a run of `total` steps takes about `frames` frames. */
export const stepsPerFrame = (total: number, frames = 420): number => Math.max(1, Math.ceil(total / frames));

export interface BlockLayout {
  /** rows in each column, and the side of one oscillator's cell [px] */
  rows: number;
  cell: number;
  colsA: number;
  colsB: number;
}

/**
 * Two blocks of oscillators side by side in a w × h box, `gap` apart, with square cells of one common side, so that
 * the areas are in proportion to nA and nB. The rows per column is the one that makes the cells largest. The cells
 * are laid column by column, so a block is rectangular but for its last column.
 */
export function blockLayout(nA: number, nB: number, w: number, h: number, gap: number): BlockLayout {
  let best: BlockLayout = { rows: 1, cell: 0, colsA: nA, colsB: nB };
  const rowsMax = Math.max(1, Math.min(Math.max(nA, nB), Math.floor(h)));
  for (let rows = 1; rows <= rowsMax; rows++) {
    const colsA = Math.ceil(nA / rows);
    const colsB = Math.ceil(nB / rows);
    const cell = Math.min((w - gap) / (colsA + colsB), h / rows);
    if (cell > best.cell) best = { rows, cell, colsA, colsB };
  }
  return best;
}

/** The share (0 … 1) of the shade a cell holding `c` quanta gets, saturating at `cap` quanta. */
export const shadeOf = (c: number, cap: number): number => clamp(c / cap, 0, 1);

/** The history of a live run, thinned as it grows: past `max` points every other one goes and the stride doubles. */
export class Trace {
  stride = 1;
  xs: number[] = [];
  series: number[][];
  constructor(
    private readonly max: number,
    count: number,
  ) {
    this.series = Array.from({ length: count }, () => []);
  }
  /** keep the point at step `x` if it falls on the stride */
  push(x: number, ...ys: number[]): void {
    if (this.xs.length && x % this.stride !== 0) return;
    this.xs.push(x);
    ys.forEach((y, i) => this.series[i].push(y));
    if (this.xs.length > this.max) {
      const even = (_: unknown, i: number) => i % 2 === 0;
      this.xs = this.xs.filter(even);
      this.series = this.series.map((s) => s.filter(even));
      this.stride *= 2;
    }
  }
}

/** The range of a log axis holding the values in (0, ∞) between `lo` and `hi`: whole decades. */
export function logRange(lo: number, hi: number): { min: number; max: number } {
  const a = Math.floor(Math.log10(Math.max(lo, 1e-9)) + 1e-9);
  const b = Math.ceil(Math.log10(Math.max(hi, lo * 1.0001)) - 1e-9);
  return { min: 10 ** a, max: 10 ** Math.max(b, a + 1) };
}

/* ------------------------------------------------------------------------------- RelaxationScale */

export interface Panel {
  nA: number;
  nB: number;
  state: TwoBodyState;
  tau: number;
}

/** The three pairs of the scale figure: nA = base, base·factor, base·factor², nB = ratio·nA. */
export function panelPairs(base: number, factor: number, ratio: number, tA: number, tB: number): Panel[] {
  return [0, 1, 2].map((k) => {
    const nA = Math.max(1, Math.round(base * factor ** k));
    const nB = Math.max(1, Math.round(nA * ratio));
    const state = fromTemperatures(nA, nB, tA, tB);
    return { nA, nB, state, tau: relaxationTime(state) };
  });
}

export interface PanelRun {
  /** steps in units of τ, and the gap (T_A − T_B)/(T_A(0) − T_B(0)), at most `maxPoints` of them */
  x: number[];
  gap: number[];
  /** this run's RMS deviation from e^(−t/τ), and the mean over `average` runs (this one and the next seeds) */
  rms: number;
  rmsMean: number;
}

/** About `maxPoints` of the steps of a run, evenly spread, always including the last. */
export function thinIndices(length: number, maxPoints: number): number[] {
  const stride = Math.max(1, Math.ceil(length / maxPoints));
  const out: number[] = [];
  for (let i = 0; i < length; i += stride) out.push(i);
  if (out[out.length - 1] !== length - 1) out.push(length - 1);
  return out;
}

/** The displayed run of a panel: 6τ steps from `seed`, and the RMS scatter averaged over `average` seeds from it. */
export function runPanel(p: Panel, seed: number, average: number, maxPoints = 480): PanelRun {
  const steps = Math.round(6 * p.tau);
  const shown: ExchangeResult = simulateEnergyExchange(p.state, steps, uniform(seed));
  const q = totalQuanta(p.state);
  const d0 = p.state.qA / p.state.nA - p.state.qB / p.state.nB;
  const idx = thinIndices(steps, maxPoints);
  const rms = relaxationScatter(shown);
  let sum = rms;
  for (let k = 1; k < average; k++) sum += relaxationScatter(simulateEnergyExchange(p.state, steps, uniform(seed + 7919 * k)));
  return {
    x: idx.map((i) => (i + 1) / p.tau),
    gap: idx.map((i) => (shown.qA[i] / p.state.nA - (q - shown.qA[i]) / p.state.nB) / d0),
    rms,
    rmsMean: sum / Math.max(1, average),
  };
}

/** The ratios of successive values: rms[0]/rms[1], rms[1]/rms[2]. */
export const successiveRatios = (v: number[]): number[] => v.slice(0, -1).map((a, i) => a / v[i + 1]);
