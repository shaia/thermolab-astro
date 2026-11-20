/**
 * The Ising model: order, symmetry breaking and Monte Carlo sampling. A TypeScript port of
 * `thermolab.ising` (the Python library behind the original course), so the live figures run the
 * same chain the lesson describes. Tests: tests/physics/ising.test.ts.
 *
 * MODEL SPECIFICATION
 *   System:        N classical spins s_i = ±1 on a periodic lattice: an L × L square lattice for the
 *                  module, an L-site ring for the exact one-dimensional anchor; nearest-neighbour
 *                  coupling J > 0 and a uniform field h,   E = −J Σ_<ij> s_i s_j − h Σ_i s_i
 *   Dynamics:      a Markov chain, not equations of motion: checkerboard half-sweeps, each site of one
 *                  colour proposing to flip and accepting by the Metropolis rule min(1, e^(−ΔE/T)) or
 *                  the Glauber (heat-bath) rule 1/(1 + e^(ΔE/T)); "time" is counted in sweeps, which no
 *                  physical constant converts into seconds
 *   Boundary:      periodic: the lattice has no edges; T and h are imposed by an implicit heat bath
 *   Ensemble:      canonical at temperature T: P_s ∝ e^(−E_s/T) is the stationary distribution of the
 *                  chain, by detailed balance
 *   Ignored:       quantum spin, lattice vibrations, long-range forces, anisotropy, disorder
 *   Valid when:    the chain has run well past burn-in and many autocorrelation times τ(T)
 *   Failure modes: near T_c, τ grows with L (critical slowing down) and error bars that ignore it are
 *                  illusory; below T_c at small |h| the chain stays on one magnetization branch for
 *                  longer than any run; a trace that keeps its burn-in biases every average
 *
 * REDUCED UNITS. Energy in J, temperature k_B T / J, field h / J: with one coupling this is dimensional
 * analysis (T_c = 2.269 J/k_B still depends on J and the lattice). At h = 0 the totals are integers.
 *
 * CHECKERBOARD. Every neighbour of a black site is white, so with the white sites frozen the black sites
 * do not interact: updating them in one sequential loop is exactly the simultaneous update, and each
 * half-sweep satisfies detailed balance. A full sweep is black then white (needs even L). Updating every
 * site at once would be wrong: neighbours would both flip against a configuration the other one changed.
 *
 * GLAUBER FOR THE RING. Metropolis accepts ΔE = 0 with certainty; on the h = 0 ring every wall move is free,
 * so under the checkerboard walls travel ballistically and the chain forgets its start slowly. Glauber
 * accepts the same move with probability 1/2. Same stationary distribution: a statement about speed.
 *
 * SUSCEPTIBILITY. χ = N Var(m)/T is exact in the ensemble, but below T_c a finite run crosses between ±m
 * rarely, so Var(m) measures how many crossings fitted in the run. `observables` applies the identity to
 * |m|, which the run can sample: χ' = N Var(|m|)/T, the standard finite-size estimator.
 *
 * Unlike the Python original, states are mutable: every update changes the lattice and its running
 * totals in place (a figure runs thousands of sweeps a second and cannot copy 16 kB each time).
 */

import { uniform } from './kinetics';

export { uniform };

/** Neighbours per site of the square lattice. */
export const SQUARE_COORDINATION = 4;

/** Sokal's window constant: sum ρ(t) out to the first lag W with W ≥ C τ(W). */
const WINDOW_C = 5;

export type Rule = 'metropolis' | 'glauber';
export type Rand = () => number;

export interface IsingState {
  /** spins, ±1, row-major for the square lattice */
  lattice: Int8Array;
  /** side L (the ring has L sites, the square lattice L × L) */
  size: number;
  dimension: 1 | 2;
  /** running energy [J], updated by every flip */
  energy: number;
  /** running total of the spins, an integer */
  magnetization: number;
  /** field h/J */
  field: number;
}

export interface IsingObservables {
  absMagnetization: number;
  absMagnetizationError: number;
  energy: number;
  energyError: number;
  /** χ' = N Var(|m|)/T */
  susceptibility: number;
  /** c = N Var(e)/T² */
  heatCapacity: number;
  tauAbsMagnetization: number;
  tauEnergy: number;
}

/** Magnetization per spin, between −1 and +1. */
export const mOf = (s: IsingState) => s.magnetization / s.lattice.length;
/** Energy per spin in units of J. */
export const eOf = (s: IsingState) => s.energy / s.lattice.length;

/* ------------------------------------------------------------------ states and energies */

function checkSize(size: number) {
  if (!Number.isInteger(size) || size < 4 || size % 2) {
    throw new RangeError('the side L must be even and at least 4, so the checkerboard colouring survives the periodic wrap');
  }
}

/** Σ_<ij> s_i s_j over nearest-neighbour bonds, each counted once (N on a ring, 2N on a square lattice). */
export function bondSum(lattice: Int8Array, size: number, dimension: 1 | 2 = 2): number {
  let sum = 0;
  if (dimension === 1) {
    for (let i = 0; i < size; i++) sum += lattice[i] * lattice[i + 1 === size ? 0 : i + 1];
    return sum;
  }
  for (let i = 0; i < size; i++) {
    const row = i * size;
    const next = (i + 1 === size ? 0 : i + 1) * size;
    for (let j = 0; j < size; j++) sum += lattice[row + j] * (lattice[row + (j + 1 === size ? 0 : j + 1)] + lattice[next + j]);
  }
  return sum;
}

/** E = −J Σ s_i s_j − h Σ s_i recomputed from scratch, in units of J. */
export function latticeEnergy(lattice: Int8Array, size: number, field = 0, dimension: 1 | 2 = 2): number {
  let total = 0;
  for (let i = 0; i < lattice.length; i++) total += lattice[i];
  return -bondSum(lattice, size, dimension) - field * total;
}

function makeState(lattice: Int8Array, size: number, field: number, dimension: 1 | 2): IsingState {
  let total = 0;
  for (let i = 0; i < lattice.length; i++) total += lattice[i];
  return { lattice, size, dimension, energy: latticeEnergy(lattice, size, field, dimension), magnetization: total, field };
}

const sites = (size: number, dimension: 1 | 2) => (dimension === 1 ? size : size * size);

/** A hot start: every spin independently up or down with probability 1/2. */
export function randomState(size: number, rand: Rand, field = 0, dimension: 1 | 2 = 2): IsingState {
  checkSize(size);
  const lattice = new Int8Array(sites(size, dimension));
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand() < 0.5 ? -1 : 1;
  return makeState(lattice, size, field, dimension);
}

/** A cold start: every spin up (or every spin down). */
export function alignedState(size: number, up = true, field = 0, dimension: 1 | 2 = 2): IsingState {
  checkSize(size);
  return makeState(new Int8Array(sites(size, dimension)).fill(up ? 1 : -1), size, field, dimension);
}

/** The same configuration in a new field; only the field term of the energy changes. Mutates and returns `state`. */
export function withField(state: IsingState, field: number): IsingState {
  state.energy -= (field - state.field) * state.magnetization;
  state.field = field;
  return state;
}

export function cloneState(s: IsingState): IsingState {
  return { ...s, lattice: s.lattice.slice() };
}

/* ------------------------------------------------------------------ the Markov chain */

/**
 * Probability of accepting a flip that changes the energy by ΔE.
 *   metropolis: min(1, e^(−ΔE/T))      glauber: 1/(1 + e^(ΔE/T))
 * Both satisfy detailed balance, A(ΔE)/A(−ΔE) = e^(−ΔE/T).
 */
export function acceptance(dE: number, temperature: number, rule: Rule = 'metropolis'): number {
  if (!(temperature > 0)) throw new RangeError('temperature must be positive');
  const x = dE / temperature;
  if (rule === 'metropolis') return Math.exp(-Math.max(x, 0));
  if (rule === 'glauber') return 0.5 * (1 - Math.tanh(0.5 * x));
  throw new RangeError("rule must be 'metropolis' or 'glauber'");
}

/**
 * ΔE of flipping spin s with neighbour sum nb depends only on s·nb ∈ {−4, −2, 0, 2, 4} and on s (through
 * the field): ten values. Index: s = +1 → s·nb + 4, s = −1 → s·nb + 13.
 */
interface Table {
  p: Float64Array;
  dE: Float64Array;
}

function table(temperature: number, field: number, rule: Rule): Table {
  const p = new Float64Array(18);
  const dE = new Float64Array(18);
  for (let sn = -4; sn <= 4; sn += 2) {
    for (const s of [1, -1]) {
      const k = s > 0 ? sn + 4 : sn + 13;
      dE[k] = 2 * (sn + s * field);
      p[k] = acceptance(dE[k], temperature, rule);
    }
  }
  return { p, dE };
}

/** One full sweep (black half then white half), updating the state in place. */
function sweepWith(st: IsingState, tab: Table, rand: Rand) {
  const a = st.lattice;
  const L = st.size;
  const { p, dE } = tab;
  let energy = st.energy;
  let magnet = st.magnetization;
  if (st.dimension === 1) {
    for (let colour = 0; colour < 2; colour++) {
      for (let j = colour; j < L; j += 2) {
        const s = a[j];
        const sn = s * (a[j === 0 ? L - 1 : j - 1] + a[j === L - 1 ? 0 : j + 1]);
        const k = s > 0 ? sn + 4 : sn + 13;
        const pk = p[k];
        if (pk >= 1 || rand() < pk) {
          a[j] = -s;
          energy += dE[k];
          magnet -= 2 * s;
        }
      }
    }
  } else {
    for (let colour = 0; colour < 2; colour++) {
      for (let i = 0; i < L; i++) {
        const row = i * L;
        const up = (i === 0 ? L - 1 : i - 1) * L;
        const dn = (i === L - 1 ? 0 : i + 1) * L;
        for (let j = (i + colour) & 1; j < L; j += 2) {
          const s = a[row + j];
          const nb = a[up + j] + a[dn + j] + a[row + (j === 0 ? L - 1 : j - 1)] + a[row + (j === L - 1 ? 0 : j + 1)];
          const sn = s * nb;
          const k = s > 0 ? sn + 4 : sn + 13;
          const pk = p[k];
          if (pk >= 1 || rand() < pk) {
            a[row + j] = -s;
            energy += dE[k];
            magnet -= 2 * s;
          }
        }
      }
    }
  }
  st.energy = energy;
  st.magnetization = magnet;
}

/** `n` full sweeps in place. Each site gets one flip attempt per sweep: the unit of Monte Carlo time. */
export function sweep(state: IsingState, temperature: number, rand: Rand, rule: Rule = 'metropolis', n = 1) {
  const tab = table(temperature, state.field, rule);
  for (let i = 0; i < n; i++) sweepWith(state, tab, rand);
}

export interface SimulateOptions {
  burnIn?: number;
  thin?: number;
  rule?: Rule;
}

/**
 * Run the chain and record per-spin traces: `burnIn` discarded sweeps, then `nSweeps` more, recording
 * m (signed) and e after every `thin`-th one. The state is updated in place and returned as `state`.
 */
export function simulate(state: IsingState, temperature: number, nSweeps: number, rand: Rand, opts: SimulateOptions = {}) {
  const { burnIn = 200, thin = 1, rule = 'metropolis' } = opts;
  if (nSweeps < 1 || burnIn < 0 || thin < 1) throw new RangeError('need nSweeps >= 1, burnIn >= 0 and thin >= 1');
  const tab = table(temperature, state.field, rule);
  const n = state.lattice.length;
  const records = Math.floor(nSweeps / thin);
  const m = new Float64Array(records);
  const e = new Float64Array(records);
  for (let i = 0; i < burnIn; i++) sweepWith(state, tab, rand);
  let k = 0;
  for (let i = 1; i <= records * thin; i++) {
    sweepWith(state, tab, rand);
    if (i % thin === 0) {
      m[k] = state.magnetization / n;
      e[k] = state.energy / n;
      k++;
    }
  }
  return { m, e, state };
}

/* ------------------------------------------------------------------ statistics of correlated traces */

/** In-place iterative radix-2 FFT of (re, im); length a power of two. */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** Normalised autocorrelation ρ(t) of a trace, ρ(0) = 1, via FFT (zero padded: no wrap-around). */
export function autocorrelation(trace: ArrayLike<number>, maxLag?: number): Float64Array {
  const n = trace.length;
  if (n < 2) throw new RangeError('need at least two samples');
  let mean = 0;
  for (let i = 0; i < n; i++) mean += trace[i];
  mean /= n;
  const size = 2 ** Math.ceil(Math.log2(2 * n - 1));
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let variance = 0;
  for (let i = 0; i < n; i++) {
    re[i] = trace[i] - mean;
    variance += re[i] * re[i];
  }
  const len = maxLag === undefined ? n : Math.min(maxLag + 1, n);
  const out = new Float64Array(len);
  if (variance === 0) {
    out[0] = 1;
    return out;
  }
  fft(re, im, false);
  for (let i = 0; i < size; i++) {
    re[i] = re[i] * re[i] + im[i] * im[i];
    im[i] = 0;
  }
  fft(re, im, true);
  for (let t = 0; t < len; t++) out[t] = re[t] / size / variance;
  return out;
}

/**
 * Integrated autocorrelation time, in samples, with Sokal's self-consistent window:
 * τ = 1/2 + Σ_{t=1}^{W} ρ(t), W the first lag with W ≥ 5 τ(W). Independent samples give τ = 1/2; a trace
 * of n samples carries about n/(2τ) independent ones. Never below 1/2: an anticorrelated trace has
 * formally τ < 1/2 but claiming better-than-independent statistics is never the conservative choice.
 * A trace too short for the window to close gives a lower bound: read it as "run longer".
 */
export function autocorrelationTime(trace: ArrayLike<number>): number {
  const rho = autocorrelation(trace);
  let tau = 0.5;
  for (let w = 1; w < rho.length; w++) {
    tau += rho[w];
    if (w >= WINDOW_C * tau) break;
  }
  return Math.max(tau, 0.5);
}

/** N_eff = N / (2τ). */
export function effectiveSamples(nSamples: number, tau: number): number {
  if (tau < 0.5) throw new RangeError('tau is at least 1/2');
  return nSamples / (2 * tau);
}

function meanVar(x: ArrayLike<number>): { mean: number; variance: number } {
  const n = x.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i];
  mean /= n;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += (x[i] - mean) ** 2;
  return { mean, variance: ss / n };
}

/** (mean, standard error, τ). The naive σ/√N is too small by √(2τ); this uses N_eff. */
export function meanWithError(trace: ArrayLike<number>): { mean: number; error: number; tau: number } {
  const n = trace.length;
  const tau = autocorrelationTime(trace);
  const { mean, variance } = meanVar(trace);
  const sd = Math.sqrt((variance * n) / (n - 1));
  return { mean, error: sd / Math.sqrt(effectiveSamples(n, tau)), tau };
}

/** ⟨|m|⟩, ⟨e⟩, χ' and c from per-spin traces, with τ-corrected error bars. */
export function observables(mTrace: ArrayLike<number>, eTrace: ArrayLike<number>, temperature: number, nSpins: number): IsingObservables {
  const absM = Float64Array.from(mTrace, Math.abs);
  const am = meanWithError(absM);
  const en = meanWithError(eTrace);
  return {
    absMagnetization: am.mean,
    absMagnetizationError: am.error,
    energy: en.mean,
    energyError: en.error,
    susceptibility: (nSpins * meanVar(absM).variance) / temperature,
    heatCapacity: (nSpins * meanVar(eTrace).variance) / temperature ** 2,
    tauAbsMagnetization: am.tau,
    tauEnergy: en.tau,
  };
}

/**
 * Crossings of a trace from m > threshold to m < −threshold or back. Thresholded so that noise about
 * m = 0 above T_c is not counted: a flip is a full traverse between the two ordered branches.
 */
export function branchFlips(mTrace: ArrayLike<number>, threshold = 0.5): number {
  if (!(threshold > 0 && threshold < 1)) throw new RangeError('threshold must lie strictly between 0 and 1');
  let branch = 0;
  let flips = 0;
  for (let i = 0; i < mTrace.length; i++) {
    const m = mTrace[i];
    const side = m > threshold ? 1 : m < -threshold ? -1 : 0;
    if (side && side !== branch) {
      if (branch !== 0) flips++;
      branch = side;
    }
  }
  return flips;
}

/* ------------------------------------------------------------------ experiments */

export interface ScanOptions {
  burnIn?: number;
  field?: number;
  dimension?: 1 | 2;
  rule?: Rule;
  /** called after each temperature, so a figure can draw progressively */
  onPoint?: (temperature: number, obs: IsingObservables, index: number) => void;
}

/**
 * Observables along a ladder of temperatures, each run starting from the last configuration (an annealing
 * ladder): shorter burn-in, same equilibrium. The burn-in is still run at every temperature.
 */
export function temperatureScan(size: number, temperatures: ArrayLike<number>, nSweeps: number, rand: Rand, opts: ScanOptions = {}): IsingObservables[] {
  const { burnIn = 200, field = 0, dimension = 2, rule = 'metropolis', onPoint } = opts;
  const state = randomState(size, rand, field, dimension);
  const out: IsingObservables[] = [];
  for (let i = 0; i < temperatures.length; i++) {
    const t = temperatures[i];
    const { m, e } = simulate(state, t, nSweeps, rand, { burnIn, rule });
    const obs = observables(m, e, t, state.lattice.length);
    out.push(obs);
    onPoint?.(t, obs, i);
  }
  return out;
}

/** A closed field ladder +h_max → −h_max → +h_max, `nSteps` points per leg (2 nSteps − 1 in all). */
export function hysteresisFields(fieldMax: number, nSteps: number): Float64Array {
  if (!(fieldMax > 0) || nSteps < 2) throw new RangeError('need fieldMax > 0 and nSteps >= 2');
  const out = new Float64Array(2 * nSteps - 1);
  for (let i = 0; i < nSteps; i++) {
    const h = fieldMax - (2 * fieldMax * i) / (nSteps - 1);
    out[i] = h;
    if (i < nSteps - 1) out[2 * nSteps - 2 - i] = h;
  }
  return out;
}

/**
 * Step the field along `fields`, running `sweepsPerStep` sweeps at each value. First `burnIn` sweeps at
 * fields[0] so the loop starts from equilibrium. Returns m after each step; the state is updated in place.
 * Below T_c the curve does not retrace itself: reversing needs a domain of the other sign to nucleate.
 */
export function hysteresisSweep(state: IsingState, temperature: number, fields: ArrayLike<number>, sweepsPerStep: number, rand: Rand, opts: { burnIn?: number; rule?: Rule } = {}) {
  const { burnIn = 200, rule = 'metropolis' } = opts;
  const m = new Float64Array(fields.length);
  if (burnIn) {
    withField(state, fields[0]);
    sweep(state, temperature, rand, rule, burnIn);
  }
  for (let i = 0; i < fields.length; i++) {
    withField(state, fields[i]);
    sweep(state, temperature, rand, rule, sweepsPerStep);
    m[i] = mOf(state);
  }
  return { fields, m, state };
}

/** |closed ∮ m dh| around a loop (shoelace on the polygon). */
export function loopArea(fields: ArrayLike<number>, magnetization: ArrayLike<number>): number {
  const n = fields.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = i + 1 === n ? 0 : i + 1;
    sum += magnetization[i] * fields[j] - fields[i] * magnetization[j];
  }
  return Math.abs(sum) / 2;
}

/**
 * Where a curve y(x) peaks: the parabola through the highest sample and its two neighbours (any spacing),
 * so the peak can fall between grid points. At an end of the grid, or if the three points curve the wrong
 * way, the highest sample itself is returned.
 */
export function parabolaPeak(x: ArrayLike<number>, y: ArrayLike<number>): { x: number; y: number } {
  let i = 0;
  for (let k = 1; k < y.length; k++) if (y[k] > y[i]) i = k;
  if (i === 0 || i === y.length - 1) return { x: x[i], y: y[i] };
  const [x0, x1, x2, y0, y1, y2] = [x[i - 1], x[i], x[i + 1], y[i - 1], y[i], y[i + 1]];
  const d1 = (y1 - y0) / (x1 - x0);
  const d2 = (y2 - y1) / (x2 - x1);
  const curvature = (d2 - d1) / (x2 - x0);
  if (!(curvature < 0)) return { x: x1, y: y1 };
  // Newton form p(x) = y0 + d1 (x - x0) + curvature (x - x0)(x - x1); its vertex:
  const vx = (x0 + x1) / 2 - d1 / (2 * curvature);
  const vy = y0 + d1 * (vx - x0) + curvature * (vx - x0) * (vx - x1);
  return vx > x0 && vx < x2 ? { x: vx, y: vy } : { x: x1, y: y1 };
}

/* ------------------------------------------------------------------ exact anchors and mean field */

/** Onsager's exact critical temperature of the square lattice at h = 0: 2/ln(1 + √2) = 2.269185. */
export const onsagerTc = () => 2 / Math.log(1 + Math.SQRT2);

/** Exact spontaneous magnetization of the infinite square lattice: (1 − sinh(2/T)^−4)^(1/8) below T_c, 0 above. */
export function onsagerMagnetization(temperature: number): number {
  if (!(temperature > 0)) throw new RangeError('temperature must be positive');
  if (temperature >= onsagerTc()) return 0;
  return Math.max(0, 1 - Math.sinh(2 / temperature) ** -4) ** 0.125;
}

/**
 * (e, m) per spin of the infinite periodic chain, from the transfer matrix. K = 1/T, b = h/T,
 * m = sinh b / √(sinh² b + e^−4K); at h = 0, e = −tanh K and m = 0 at every T > 0: no transition.
 */
export function ising1dExact(temperature: number, field = 0): { e: number; m: number } {
  if (!(temperature > 0)) throw new RangeError('temperature must be positive');
  const k = 1 / temperature;
  const b = field / temperature;
  const root = Math.sqrt(Math.sinh(b) ** 2 + Math.exp(-4 * k));
  const m = Math.sinh(b) / root;
  const dRoot = (field * Math.sinh(b) * Math.cosh(b) - 2 * Math.exp(-4 * k)) / root;
  const e = -(1 + (field * Math.sinh(b) + dRoot) / (Math.cosh(b) + root));
  return { e, m };
}

/** The largest solution of m = tanh((q m + h)/T), by bisection; 0 above T_c^MF = q at h = 0. */
export function meanFieldMagnetization(temperature: number, field = 0, coordination = SQUARE_COORDINATION): number {
  if (!(temperature > 0)) throw new RangeError('temperature must be positive');
  const sign = field < 0 ? -1 : 1;
  const h = Math.abs(field);
  if (h === 0 && temperature >= coordination) return 0;
  let lo = h === 0 ? 1e-300 : 0;
  let hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = 0.5 * (lo + hi);
    if (Math.tanh((coordination * mid + h) / temperature) > mid) lo = mid;
    else hi = mid;
  }
  return (sign * (lo + hi)) / 2;
}

/** k_B T_c^MF / J = q: 4 on the square lattice, and a spurious 2 on the chain. */
export const meanFieldTc = (coordination = SQUARE_COORDINATION) => coordination;
