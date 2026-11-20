/**
 * Independent draws: the dice part of `thermolab.sampling` (die_mean … predicted_relative_spread), ported
 * so the live figures run the model the lesson describes. Tests: tests/physics/sampling.test.ts.
 *
 * MODEL SPECIFICATION
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
 * Randomness comes from a caller-supplied uniform generator on [0, 1) (`uniform(seed)` in kinetics.ts).
 */

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
