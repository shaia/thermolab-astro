/**
 * Independent draws: `thermolab.sampling`, ported so the live figures run the model the lessons describe. The
 * dice half (die_mean … predicted_relative_spread, lesson 0.1) comes first; the random-walk half (StepDist …
 * correlated_walk, lesson 3.1) follows it. Tests: tests/physics/sampling.test.ts.
 *
 * MODEL SPECIFICATION (dice)
 *   System:        N dice, each showing one of six equally likely faces; the observable is their sum
 *                  or their average
 *   Dynamics:      none; each draw is independent of every other, with no memory and nothing
 *                  evolving in time
 *   Boundary:      trivially closed; N is fixed for one experiment, and nothing is exchanged
 *   Ensemble:      every face equally probable, by assumption rather than by proof
 *   Ignored:       all the physics of real dice: the tumble, the bounce, pip asymmetry, air drag, and
 *                  the deterministic chaos that is the real reason a throw looks random
 *   Valid when:    the randomness is well described by independent uniform draws
 *   Failure modes: correlated draws, loaded dice, and any question about a single roll beyond its
 *                  distribution
 *
 * MODEL SPECIFICATION (random walks)
 *   System:        W walkers on a line, each starting at the origin; a walker's position is the running sum
 *                  of its own steps, and the observables are the ensemble's histogram, mean and spread
 *   Dynamics:      none beyond accumulation: every step is drawn from one fixed distribution, independently
 *                  of every other step (the correlated walk breaks that on purpose)
 *   Boundary:      none; the line is unbounded and W, the step count and the distribution are fixed
 *   Ensemble:      independent walkers repeating the same experiment
 *   Ignored:       all physics; no medium, no collisions, no restoring force
 *   Valid when:    steps are independent with finite variance
 *   Failure modes: correlated steps (correlatedWalk), infinite-variance steps such as Cauchy, and any
 *                  question about one path beyond its distribution
 *
 * Randomness comes from a caller-supplied uniform generator on [0, 1) (`uniform(seed)` in kinetics.ts).
 * The walks are drawn time-major (every walker's step t before any walker's step t + 1), so a walk built in
 * one call and the same walk advanced step by step (src/sims/core/walker-view.ts) are the same numbers.
 */

import { normal } from './kinetics';

function validateFaces(nFaces: number): void {
  if (!(nFaces >= 1) || !Number.isInteger(nFaces)) throw new RangeError('a die needs at least one face');
}

/** Mean of one uniform die, (n_faces + 1) / 2; for six faces, 7/2. */
export function dieMean(nFaces = 6): number {
  validateFaces(nFaces);
  return (nFaces + 1) / 2;
}

/** Variance of one uniform die, (n_faces² − 1) / 12; for six faces, 35/12. */
export function dieVariance(nFaces = 6): number {
  validateFaces(nFaces);
  return (nFaces * nFaces - 1) / 12;
}

/** The dimensionless scatter of one die, σ / mean: about 0.488 for six faces. */
export function dieRelativeSpread(nFaces = 6): number {
  return Math.sqrt(dieVariance(nFaces)) / dieMean(nFaces);
}

/** Roll one die `nRolls` times; the faces shown, 1 … nFaces. */
export function rollDice(nRolls: number, rand: () => number, nFaces = 6): Uint8Array {
  if (!(nRolls >= 1)) throw new RangeError('nRolls must be positive');
  validateFaces(nFaces);
  const out = new Uint8Array(nRolls);
  for (let i = 0; i < nRolls; i++) out[i] = 1 + Math.floor(rand() * nFaces);
  return out;
}

/** Average of the first k entries, for every k: the curve that visibly settles, by dilution. */
export function runningAverage(values: ArrayLike<number>): Float64Array {
  if (values.length === 0) throw new RangeError('runningAverage needs at least one value');
  const out = new Float64Array(values.length);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    s += values[i];
    out[i] = s / (i + 1);
  }
  return out;
}

/** The running sum minus k·mean for every k: the excess that is never paid back, only diluted. */
export function runningExcess(values: ArrayLike<number>, mean: number): Float64Array {
  if (values.length === 0) throw new RangeError('runningExcess needs at least one value');
  const out = new Float64Array(values.length);
  let s = 0;
  for (let i = 0; i < values.length; i++) {
    s += values[i] - mean;
    out[i] = s;
  }
  return out;
}

/** The sum of `nPerSample` dice, repeated `nSamples` times. */
export function sampleSums(nPerSample: number, nSamples: number, rand: () => number, nFaces = 6): Float64Array {
  if (!(nPerSample >= 1) || !(nSamples >= 1)) throw new RangeError('nPerSample and nSamples must be positive');
  validateFaces(nFaces);
  const out = new Float64Array(nSamples);
  for (let s = 0; s < nSamples; s++) {
    let sum = 0;
    for (let i = 0; i < nPerSample; i++) sum += 1 + Math.floor(rand() * nFaces);
    out[s] = sum;
  }
  return out;
}

/** The experiment "average `nPerSample` dice", repeated `nSamples` times: one average per repetition. */
export function sampleAverages(nPerSample: number, nSamples: number, rand: () => number, nFaces = 6): Float64Array {
  const sums = sampleSums(nPerSample, nSamples, rand, nFaces);
  for (let s = 0; s < sums.length; s++) sums[s] /= nPerSample;
  return sums;
}

export function mean(values: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += values[i];
  return s / values.length;
}

/** Sample standard deviation (n − 1 in the denominator, as numpy's ddof = 1). */
export function stdDev(values: ArrayLike<number>): number {
  if (values.length < 2) throw new RangeError('a spread needs at least two values');
  const m = mean(values);
  let ss = 0;
  for (let i = 0; i < values.length; i++) ss += (values[i] - m) ** 2;
  return Math.sqrt(ss / (values.length - 1));
}

/** Measured standard deviation of the sample average divided by its mean. */
export function relativeSpreadOfAverage(nPerSample: number, nSamples: number, rand: () => number, nFaces = 6): number {
  if (nSamples < 2) throw new RangeError('estimating a spread needs at least two repetitions');
  const a = sampleAverages(nPerSample, nSamples, rand, nFaces);
  return stdDev(a) / Math.abs(mean(a));
}

/** The analytic answer, (σ₁ / μ₁) · N^(−1/2). */
export function predictedRelativeSpread(nPerSample: number, nFaces = 6): number {
  if (!(nPerSample >= 1)) throw new RangeError('nPerSample must be positive');
  return dieRelativeSpread(nFaces) / Math.sqrt(nPerSample);
}

/** The standard deviation of a sum of N dice, σ₁ √N. */
export function predictedSumSpread(nPerSample: number, nFaces = 6): number {
  if (!(nPerSample >= 1)) throw new RangeError('nPerSample must be positive');
  return Math.sqrt(dieVariance(nFaces) * nPerSample);
}

/** The standard deviation of an average of N dice, σ₁ / √N. */
export function predictedAverageSpread(nPerSample: number, nFaces = 6): number {
  if (!(nPerSample >= 1)) throw new RangeError('nPerSample must be positive');
  return Math.sqrt(dieVariance(nFaces) / nPerSample);
}

/** Fit quantity ~ size^α on a log–log plot and return α (least squares on the logarithms). */
export function scalingExponent(sizes: ArrayLike<number>, quantities: ArrayLike<number>): number {
  if (sizes.length !== quantities.length || sizes.length < 2) throw new RangeError('need at least two (size, quantity) pairs');
  const n = sizes.length;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += Math.log(sizes[i]);
    sy += Math.log(quantities[i]);
  }
  const mx = sx / n;
  const my = sy / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    const dx = Math.log(sizes[i]) - mx;
    sxy += dx * (Math.log(quantities[i]) - my);
    sxx += dx * dx;
  }
  return sxy / sxx;
}

/* ------------------------------------------------------------------ random walks and the central limit theorem */

export const STEP_NAMES = ['pm1', 'biased', 'uniform', 'heavy'] as const;
export type StepName = (typeof STEP_NAMES)[number];

/**
 * One step distribution with the exact moments its sampler was built from. The Gaussian overlays are drawn from
 * `mean` and `variance`, never estimated from the sample they are compared against: an overlay fitted to its own
 * data agrees with anything and tests nothing.
 */
export interface StepDist {
  name: StepName;
  mean: number;
  variance: number;
  /** σ₁, the standard deviation of one step */
  std: number;
  /** a function that draws one step per call from `rand` (it may keep state, so make one per stream) */
  stepper: (rand: () => number) => () => number;
}

/** Gamma(shape, 1) deviates for shape ≥ 1, by Marsaglia and Tsang (2000). Mean `shape`, variance `shape`. */
export function gammaSampler(shape: number, rand: () => number, gauss: () => number = normal(rand)): () => number {
  if (!(shape >= 1)) throw new RangeError('gammaSampler needs shape >= 1');
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  return () => {
    for (let attempt = 0; attempt < 10000; attempt++) {
      const x = gauss();
      let v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      const u = rand();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
    throw new Error('gammaSampler: rejection sampling did not terminate');
  };
}

/** Chi-square deviates with `nu` degrees of freedom (nu >= 2): twice a Gamma(nu/2). Mean nu, variance 2 nu. */
export function chiSquareSampler(nu: number, rand: () => number, gauss: () => number = normal(rand)): () => number {
  if (!(nu >= 2)) throw new RangeError('chiSquareSampler needs nu >= 2');
  const g = gammaSampler(nu / 2, rand, gauss);
  return () => 2 * g();
}

/** Student-t deviates with `nu` degrees of freedom: a seeded normal over the root of a seeded chi-square / nu. */
export function studentTSampler(nu: number, rand: () => number): () => number {
  const gauss = normal(rand);
  const chi = chiSquareSampler(nu, rand, gauss);
  return () => gauss() / Math.sqrt(chi() / nu);
}

/*
 * Student-t with 5 degrees of freedom has variance nu / (nu - 2) = 5/3: visibly heavy-tailed, yet of finite
 * variance, so the central limit theorem still holds and the collapse still happens, more slowly. Cauchy
 * (nu = 1, no variance) is left to the problem set, where its failure is the point.
 */
const STEP_DISTRIBUTIONS: Record<StepName, StepDist> = {
  pm1: { name: 'pm1', mean: 0, variance: 1, std: 1, stepper: (rand) => () => (rand() < 0.5 ? -1 : 1) },
  biased: { name: 'biased', mean: 0.2, variance: 0.96, std: Math.sqrt(0.96), stepper: (rand) => () => (rand() < 0.6 ? 1 : -1) },
  uniform: { name: 'uniform', mean: 0, variance: 1 / 3, std: Math.sqrt(1 / 3), stepper: (rand) => () => 2 * rand() - 1 },
  heavy: { name: 'heavy', mean: 0, variance: 5 / 3, std: Math.sqrt(5 / 3), stepper: (rand) => studentTSampler(5, rand) },
};

/**
 * The named step distribution with its exact mean and variance:
 * pm1 (fair ±1), biased (±1, probability 0.6 of +1), uniform (on [−1, 1]), heavy (Student-t, 5 degrees of freedom).
 */
export function stepDistribution(name: StepName | string = 'pm1'): StepDist {
  if (!Object.hasOwn(STEP_DISTRIBUTIONS, name)) throw new RangeError(`unknown step distribution '${name}'; choose from ${STEP_NAMES.join(', ')}`);
  return STEP_DISTRIBUTIONS[name as StepName];
}

const asDist = (step: StepDist | string) => (typeof step === 'string' ? stepDistribution(step) : step);

/** `n` independent steps. */
export function drawSteps(step: StepDist | string, n: number, rand: () => number): Float64Array {
  const next = asDist(step).stepper(rand);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = next();
  return out;
}

/**
 * Trajectories of `nWalkers` independent walkers from the origin, one flat array: walker w's position after t
 * steps is at `w * (nSteps + 1) + t`, and column 0 is x₀ = 0. A position is the running sum of the walker's steps.
 */
export function randomWalk(nWalkers: number, nSteps: number, rand: () => number, step: StepDist | string = 'pm1'): Float64Array {
  if (!(nWalkers >= 1) || !(nSteps >= 1)) throw new RangeError('nWalkers and nSteps must be positive');
  const next = asDist(step).stepper(rand);
  const cols = nSteps + 1;
  const out = new Float64Array(nWalkers * cols);
  for (let t = 0; t < nSteps; t++) for (let w = 0; w < nWalkers; w++) out[w * cols + t + 1] = out[w * cols + t] + next();
  return out;
}

/** The standard deviation across walkers (n − 1 in the denominator) at every time: the √t curve. */
export function walkerSpread(positions: ArrayLike<number>, nWalkers: number): Float64Array {
  if (!(nWalkers >= 2)) throw new RangeError('a spread needs at least two walkers');
  const cols = positions.length / nWalkers;
  if (!Number.isInteger(cols) || cols < 1) throw new RangeError('positions must hold nWalkers equal rows');
  const out = new Float64Array(cols);
  for (let t = 0; t < cols; t++) {
    let m = 0;
    for (let w = 0; w < nWalkers; w++) m += positions[w * cols + t];
    m /= nWalkers;
    let ss = 0;
    for (let w = 0; w < nWalkers; w++) ss += (positions[w * cols + t] - m) ** 2;
    out[t] = Math.sqrt(ss / (nWalkers - 1));
  }
  return out;
}

export interface WalkerHistogram {
  /** bin centres, and the unit-area density of the walkers inside the edges */
  centres: Float64Array;
  density: Float64Array;
  /** the common bin width */
  width: number;
}

/** Python's round(): halves go to the even neighbour, so a bin holds the same number of sites as ThermoLab's. */
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** Edges a whole number of lattice spacings wide with a lattice site at every centre (ThermoLab _lattice_edges). */
function latticeEdges(minPos: number, nBins: number, low: number, high: number, lattice: number): number[] {
  const sitesPerBin = Math.max(roundHalfEven((high - low) / nBins / lattice), 1);
  const width = sitesPerBin * lattice;
  // Half a lattice spacing, not half a bin: every edge then sits midway between two sites whatever a bin holds,
  // so no site falls on an edge and no bin alternates tall and short by rounding noise.
  let anchor = minPos - 0.5 * lattice;
  anchor -= Math.ceil((anchor - low) / width) * width;
  const count = Math.ceil((high - anchor) / width) + 1;
  return Array.from({ length: count }, (_, i) => anchor + width * i);
}

/**
 * Bin centres and unit-area density of one time slice of the walker cloud.
 *
 * `span` fixes the bin edges instead of letting the data choose them (without it a wider cloud silently gets
 * wider bins and the spreading is scaled away); walkers outside the span are dropped and the density is
 * normalised to those that remain, as numpy's `density=True`. `lattice` is the spacing of the underlying
 * discrete positions: a ±1 walk after t steps occupies sites 2 apart, and bins on arbitrary edges then alternate
 * tall and short by up to 100%. With it, every bin holds a whole number of sites.
 */
export function walkerHistogram(positions: ArrayLike<number>, nBins = 60, span?: [number, number], lattice?: number): WalkerHistogram {
  if (positions.length < 2) throw new RangeError('a histogram needs at least two walkers');
  if (!(nBins >= 1)) throw new RangeError('nBins must be positive');
  if (lattice !== undefined && !(lattice > 0)) throw new RangeError('lattice spacing must be positive');
  let minPos = Infinity;
  let maxPos = -Infinity;
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] < minPos) minPos = positions[i];
    if (positions[i] > maxPos) maxPos = positions[i];
  }
  let [low, high] = span ?? [minPos, maxPos];
  if (span === undefined && low === high) {
    low -= 0.5;
    high += 0.5;
  }
  const edges =
    lattice === undefined ? Array.from({ length: nBins + 1 }, (_, i) => low + ((high - low) * i) / nBins) : latticeEdges(minPos, nBins, low, high, lattice);
  const nb = edges.length - 1;
  const width = edges[1] - edges[0];
  const counts = new Float64Array(nb);
  let inside = 0;
  for (let i = 0; i < positions.length; i++) {
    const x = positions[i];
    if (x < edges[0] || x > edges[nb]) continue;
    counts[Math.min(nb - 1, Math.floor((x - edges[0]) / width))]++;
    inside++;
  }
  const centres = new Float64Array(nb);
  const density = new Float64Array(nb);
  for (let b = 0; b < nb; b++) {
    centres[b] = 0.5 * (edges[b] + edges[b + 1]);
    density[b] = inside > 0 ? counts[b] / (inside * width) : 0;
  }
  return { centres, density, width };
}

/** The N(mean, sigma²) density at x. */
export function gaussianPdf(x: number, mean: number, sigma: number): number {
  const z = (x - mean) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** The CLT overlay N(μ₁ t, σ₁² t) on `x`: a prediction from the step's exact moments and t, never a fit. */
export function gaussianLimit(x: ArrayLike<number>, t: number, step: StepDist | string = 'pm1'): Float64Array {
  if (!(t >= 1)) throw new RangeError('t must be at least one step');
  const d = asDist(step);
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = gaussianPdf(x[i], d.mean * t, d.std * Math.sqrt(t));
  return out;
}

/** (S_n − n μ₁) / (σ₁ √n) for `nSamples` independent sums of `nTerms` steps: only the shape is left. */
export function cltSumDistribution(nTerms: number, nSamples: number, rand: () => number, step: StepDist | string = 'pm1'): Float64Array {
  if (!(nTerms >= 1) || !(nSamples >= 1)) throw new RangeError('nTerms and nSamples must be positive');
  const d = asDist(step);
  const next = d.stepper(rand);
  const sums = new Float64Array(nSamples);
  for (let i = 0; i < nTerms; i++) for (let s = 0; s < nSamples; s++) sums[s] += next();
  for (let s = 0; s < nSamples; s++) sums[s] = (sums[s] - nTerms * d.mean) / (d.std * Math.sqrt(nTerms));
  return sums;
}

/** erf(x) by the all-positive series 2/√π e^(−x²) Σ 2ⁿ x^(2n+1) / (2n+1)!!, accurate to ~1e-16 up to |x| = 6. */
function erf(x: number): number {
  const ax = Math.abs(x);
  if (ax >= 6) return Math.sign(x);
  let term = ax;
  let sum = ax;
  for (let n = 1; n < 400; n++) {
    term *= (2 * ax * ax) / (2 * n + 1);
    sum += term;
    if (term < sum * 1e-17) break;
  }
  return Math.sign(x) * ((2 / Math.sqrt(Math.PI)) * Math.exp(-ax * ax) * sum);
}

/** The standard normal cumulative distribution function. */
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/**
 * The Kolmogorov distance sup |F_sample(z) − Φ(z)| of a sample from the standard Gaussian. A sample on a lattice
 * (the standardised sum of ±1 steps) jumps by its probability at every site, so for it the distance is at least
 * half the largest jump, about 0.4/√n for the fair coin, however Gaussian its shape.
 */
export function ksDistanceToGaussian(sample: ArrayLike<number>): number {
  const z = Float64Array.from(sample).sort();
  const n = z.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const phi = normalCdf(z[i]);
    d = Math.max(d, phi - i / n, (i + 1) / n - phi);
  }
  return d;
}

export interface Binomial {
  /** the number of +1 steps, 0 … n */
  k: Float64Array;
  /** the exact binomial probability of each k */
  pmf: Float64Array;
  /** the de Moivre–Laplace Gaussian of mean np and variance np(1 − p) at each k (lattice spacing 1) */
  gaussian: Float64Array;
}

/** The exact binomial pmf (through sums of logarithms, finite at n = 10⁴) and its Gaussian. */
export function binomialToGaussian(n: number, p = 0.5): Binomial {
  if (!(n >= 1) || !Number.isInteger(n)) throw new RangeError('n must be a positive integer');
  if (!(p > 0 && p < 1)) throw new RangeError('p must lie strictly between 0 and 1');
  const logFact = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) logFact[i] = logFact[i - 1] + Math.log(i);
  const lp = Math.log(p);
  const lq = Math.log1p(-p);
  const sigma = Math.sqrt(n * p * (1 - p));
  const k = new Float64Array(n + 1);
  const pmf = new Float64Array(n + 1);
  const gaussian = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    k[i] = i;
    pmf[i] = Math.exp(logFact[n] - logFact[i] - logFact[n - i] + i * lp + (n - i) * lq);
    gaussian[i] = gaussianPdf(i, n * p, sigma);
  }
  return { k, pmf, gaussian };
}

export interface BinomialError {
  sigma: number;
  /** the largest |pmf − Gaussian| over all k, and the same times σ (the scale-free number that falls as 1/n) */
  maxAbs: number;
  maxAbsScaled: number;
  /** |Gaussian / pmf − 1| at the site nearest np + zσ and np − zσ: the relative error out in the tails */
  tailUpper: number;
  tailLower: number;
}

/** How far the Gaussian is from the exact binomial: absolutely (tiny, falling) and relatively in the tails (large). */
export function binomialGaussianError(n: number, p = 0.5, z = 3): BinomialError {
  const { pmf, gaussian } = binomialToGaussian(n, p);
  const sigma = Math.sqrt(n * p * (1 - p));
  let maxAbs = 0;
  for (let i = 0; i <= n; i++) maxAbs = Math.max(maxAbs, Math.abs(pmf[i] - gaussian[i]));
  const rel = (at: number) => {
    const i = Math.min(n, Math.max(0, Math.round(at)));
    return Math.abs(gaussian[i] / pmf[i] - 1);
  };
  return { sigma, maxAbs, maxAbsScaled: maxAbs * sigma, tailUpper: rel(n * p + z * sigma), tailLower: rel(n * p - z * sigma) };
}

/**
 * A ±1 walk that repeats its previous step with probability `persistence` and otherwise draws a fresh fair ±1
 * step (ThermoLab's rule). Returns a function that fills `out` (one entry per walker) with the next step of every
 * walker; the first call draws fresh steps. A step equals its predecessor with probability (1 + q)/2, so
 * successive steps have correlation exactly q.
 */
export function correlatedStepper(nWalkers: number, persistence: number, rand: () => number): (out: Float64Array) => void {
  if (!(nWalkers >= 1)) throw new RangeError('nWalkers must be positive');
  if (!(persistence >= 0 && persistence < 1)) throw new RangeError('persistence must lie in [0, 1)');
  const last = new Float64Array(nWalkers);
  let first = true;
  return (out) => {
    for (let w = 0; w < nWalkers; w++) {
      out[w] = !first && rand() < persistence ? last[w] : rand() < 0.5 ? -1 : 1;
      last[w] = out[w];
    }
    first = false;
  };
}

/** Trajectories of the persistent ±1 walk, in `randomWalk`'s flat layout. `persistence = 0` is the fair ±1 walk. */
export function correlatedWalk(nWalkers: number, nSteps: number, persistence: number, rand: () => number): Float64Array {
  if (!(nWalkers >= 1) || !(nSteps >= 1)) throw new RangeError('nWalkers and nSteps must be positive');
  const next = correlatedStepper(nWalkers, persistence, rand);
  const cols = nSteps + 1;
  const out = new Float64Array(nWalkers * cols);
  const step = new Float64Array(nWalkers);
  for (let t = 0; t < nSteps; t++) {
    next(step);
    for (let w = 0; w < nWalkers; w++) out[w * cols + t + 1] = out[w * cols + t] + step[w];
  }
  return out;
}

/** `nSamples` unstandardised sums S_n of the persistent ±1 walk, without storing the paths. */
export function correlatedSums(nTerms: number, nSamples: number, persistence: number, rand: () => number): Float64Array {
  if (!(nTerms >= 1) || !(nSamples >= 1)) throw new RangeError('nTerms and nSamples must be positive');
  const next = correlatedStepper(nSamples, persistence, rand);
  const sums = new Float64Array(nSamples);
  const step = new Float64Array(nSamples);
  for (let t = 0; t < nTerms; t++) {
    next(step);
    for (let s = 0; s < nSamples; s++) sums[s] += step[s];
  }
  return sums;
}

/**
 * Var(S_n) / n for the persistent walk with persistence q. Successive steps have correlation q^k at lag k, so
 * Var(S_n) = n + 2 Σ_{k=1}^{n−1} (n − k) q^k = n (1 + q)/(1 − q) − 2q (1 − q^n)/(1 − q)²; the factor tends to
 * (1 + q)/(1 − q) as n grows, and is that limit when `n` is omitted.
 */
export function correlatedVarianceFactor(persistence: number, n?: number): number {
  const q = persistence;
  if (!(q >= 0 && q < 1)) throw new RangeError('persistence must lie in [0, 1)');
  const limit = (1 + q) / (1 - q);
  if (n === undefined) return limit;
  if (!(n >= 1)) throw new RangeError('n must be positive');
  return limit - (2 * q * (1 - q ** n)) / (n * (1 - q) ** 2);
}
