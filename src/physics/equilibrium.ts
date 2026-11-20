/**
 * Two bodies exchanging energy quanta until they share one temperature (lesson 1.1). A TypeScript port of
 * `thermolab.equilibrium` (the Python library behind the original course), without its entropy ledger, which
 * module 09 will port. Tests: tests/physics/equilibrium.test.ts.
 *
 * MODEL SPECIFICATION
 *   System:        two Einstein solids in thermal contact, body A with nA independent oscillators and body B
 *                  with nB, exchanging identical energy quanta
 *   Dynamics:      one randomly chosen quantum hops per step: it leaves its current body with probability
 *                  proportional to that body's share of the quanta, then lands on a uniformly random
 *                  oscillator among both bodies
 *   Boundary:      closed and isolated as a pair; the total number of quanta Q, hence the energy, is exactly
 *                  conserved
 *   Ensemble:      microcanonical for the joint system, with the quanta counted as labelled particles: every
 *                  assignment of the labelled quanta to the oscillators is equally probable. This is the hop
 *                  rule's own stationary law (binomial in qA), not the Einstein count of unlabelled quanta.
 *                  Each body's temperature is read off its own quanta by equipartition, T = q / n
 *   Ignored:       the physical attempt rate (time is counted in steps), spatial structure inside a body, any
 *                  coupling besides the quantum exchange
 *   Valid when:    both bodies are warm enough for equipartition and exchange quanta of the same size
 *   Failure modes: low temperature, unequal quantum sizes, so few oscillators that "temperature" is not yet
 *                  a macroscopic quantity
 *
 * Units: energy in quanta ε, temperature in ε/k_B, heat capacity in k_B. So a body of n oscillators holding q
 * quanta has C = n and T = q/n, and the Python's `quantum` and `K_B` drop out.
 *
 * The chance that a quantum leaves A is qA/Q and that it lands in A is nA/(nA + nB), so the expected change of
 * qA per step is exactly nA/N − qA/Q, linear in qA for every state. Its solution is geometric,
 * E[T_A(n) − T_B(n)] = (T_A(0) − T_B(0)) (1 − 1/Q)^n = (T_A(0) − T_B(0)) exp(−n/τ), τ = −1/ln(1 − 1/Q) ≈ Q − 1/2.
 */

export type Rand = () => number;

export interface TwoBodyState {
  /** oscillators in body A and in body B: the sizes, and the heat capacities in k_B */
  nA: number;
  nB: number;
  /** quanta held by A and by B */
  qA: number;
  qB: number;
}

function checkState(s: TwoBodyState): void {
  if (!Number.isInteger(s.nA) || !Number.isInteger(s.nB) || s.nA < 1 || s.nB < 1) throw new RangeError('nA and nB must be positive integers');
  if (!Number.isInteger(s.qA) || !Number.isInteger(s.qB) || s.qA < 0 || s.qB < 0) throw new RangeError('qA and qB must be non-negative integers');
}

/** A validated state. */
export function twoBodyState(nA: number, nB: number, qA: number, qB: number): TwoBodyState {
  const s = { nA, nB, qA, qB };
  checkState(s);
  return s;
}

export const totalQuanta = (s: TwoBodyState): number => s.qA + s.qB;
export const totalOscillators = (s: TwoBodyState): number => s.nA + s.nB;
/** T_A = q_A / n_A, in ε/k_B */
export const temperatureA = (s: TwoBodyState): number => s.qA / s.nA;
export const temperatureB = (s: TwoBodyState): number => s.qB / s.nB;

/** The state whose bodies start at the given temperatures; each q is rounded to the nearest whole quantum. */
export function fromTemperatures(nA: number, nB: number, tA: number, tB: number): TwoBodyState {
  if (!(tA > 0) || !(tB > 0)) throw new RangeError('temperatures must be positive');
  return twoBodyState(nA, nB, Math.round(nA * tA), Math.round(nB * tB));
}

/** T_eq = (C_A T_A + C_B T_B) / (C_A + C_B), from energy conservation alone. */
export function equilibriumTemperature(cA: number, tA: number, cB: number, tB: number): number {
  if (!(cA > 0) || !(cB > 0)) throw new RangeError('heat capacities must be positive');
  return (cA * tA + cB * tB) / (cA + cB);
}

/**
 * One step on the pair's quanta counts alone: whether the quantum leaves A and whether it lands in A, drawn in that
 * order. Returns the change of qA (−1, 0 or +1).
 */
export function exchangeStep(qA: number, nA: number, nTotal: number, qTotal: number, rand: Rand): number {
  const leavesA = rand() < qA / qTotal;
  const landsInA = rand() < nA / nTotal;
  return leavesA === landsInA ? 0 : leavesA ? -1 : 1;
}

export interface ExchangeResult {
  initial: TwoBodyState;
  /** quanta in A after each step; element 0 is after step 1 */
  qA: Int32Array;
}

/** Advance the pair by `nSteps` random single-quantum exchanges, recording qA after each. */
export function simulateEnergyExchange(state: TwoBodyState, nSteps: number, rand: Rand): ExchangeResult {
  checkState(state);
  if (!Number.isInteger(nSteps) || nSteps < 1) throw new RangeError('nSteps must be a positive integer');
  const q = totalQuanta(state);
  if (q < 1) throw new RangeError('the pair needs at least one energy quantum to exchange');
  const n = totalOscillators(state);
  const out = new Int32Array(nSteps);
  let cur = state.qA;
  for (let i = 0; i < nSteps; i++) {
    cur += exchangeStep(cur, state.nA, n, q, rand);
    out[i] = cur;
  }
  return { initial: state, qA: out };
}

/** T_A and T_B after each step of a run. */
export function temperatureSeries(r: ExchangeResult): { tA: Float64Array; tB: Float64Array } {
  const q = totalQuanta(r.initial);
  const tA = new Float64Array(r.qA.length);
  const tB = new Float64Array(r.qA.length);
  for (let i = 0; i < r.qA.length; i++) {
    tA[i] = r.qA[i] / r.initial.nA;
    tB[i] = (q - r.qA[i]) / r.initial.nB;
  }
  return { tA, tB };
}

/** Closed-form E[T_A(n) − T_B(n)] = (T_A(0) − T_B(0)) (1 − 1/Q)^n, exact for every state. */
export function predictedRelaxation(state: TwoBodyState, steps: ArrayLike<number>): Float64Array {
  const q = totalQuanta(state);
  if (q < 2) throw new RangeError('predictedRelaxation needs at least two quanta');
  const d0 = temperatureA(state) - temperatureB(state);
  const out = new Float64Array(steps.length);
  for (let i = 0; i < steps.length; i++) out[i] = d0 * (1 - 1 / q) ** steps[i];
  return out;
}

/** τ in steps, defined so that (1 − 1/Q)^n = exp(−n/τ) exactly: τ = −1/ln(1 − 1/Q) → Q − 1/2 for large Q. */
export function relaxationTime(state: TwoBodyState): number {
  const q = totalQuanta(state);
  if (q < 2) throw new RangeError('relaxationTime needs at least two quanta to exchange');
  return -1 / Math.log(1 - 1 / q);
}

/**
 * The root-mean-square deviation of a run's gap from the predicted mean gap, as a fraction of the initial gap:
 * sqrt(mean over steps of ((T_A − T_B)(n) − predicted(n))² ) / (T_A(0) − T_B(0)). It scales as N^(−1/2).
 */
export function relaxationScatter(r: ExchangeResult): number {
  const s = r.initial;
  const q = totalQuanta(s);
  const d0 = temperatureA(s) - temperatureB(s);
  if (d0 === 0) throw new RangeError('the bodies start at one temperature: there is no gap to follow');
  const rate = 1 - 1 / q;
  let power = 1;
  let sum = 0;
  for (let i = 0; i < r.qA.length; i++) {
    power *= rate;
    const gap = r.qA[i] / s.nA - (q - r.qA[i]) / s.nB;
    const dev = (gap - d0 * power) / d0;
    sum += dev * dev;
  }
  return Math.sqrt(sum / r.qA.length);
}

/* ---------------------------------------------------------------- the labelled quanta, oscillator by oscillator */

/**
 * Where each of the Q labelled quanta sits: an oscillator index, 0 … nA − 1 for body A and nA … nA + nB − 1 for B.
 * The initial qA quanta are each dropped on a uniformly random oscillator of A, the qB on B.
 */
export function placeQuanta(state: TwoBodyState, rand: Rand): Int32Array {
  checkState(state);
  const pos = new Int32Array(totalQuanta(state));
  for (let k = 0; k < state.qA; k++) pos[k] = Math.floor(rand() * state.nA);
  for (let k = state.qA; k < pos.length; k++) pos[k] = state.nA + Math.floor(rand() * state.nB);
  return pos;
}

/** How many quanta each oscillator holds. */
export function countQuanta(pos: Int32Array, nOscillators: number): Int32Array {
  const c = new Int32Array(nOscillators);
  for (let k = 0; k < pos.length; k++) c[pos[k]]++;
  return c;
}

/**
 * The hop rule on the labelled quanta: a uniformly random quantum moves to a uniformly random oscillator of the
 * pair. The quantum leaves A with probability qA/Q and lands in A with probability nA/N, so qA follows exactly the
 * chain of `exchangeStep`. Mutates `pos`; returns the oscillator it left and the one it reached.
 */
export function hopQuantum(pos: Int32Array, nOscillators: number, rand: Rand): { from: number; to: number } {
  const k = Math.floor(rand() * pos.length);
  const from = pos[k];
  const to = Math.floor(rand() * nOscillators);
  pos[k] = to;
  return { from, to };
}
