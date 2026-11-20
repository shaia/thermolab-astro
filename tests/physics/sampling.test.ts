/**
 * The claims lesson 0.1 makes about dice, each as a test: the die's moments, the N^(-1/2) law with its fitted
 * exponent, the sum's N^(+1/2) growth, and the running average inside its envelope at the expected rate.
 * Every stochastic assertion is made over several seeds, against a tolerance several standard errors wide.
 * The deterministic values were checked against ThermoLab's Python (thermolab.sampling, validation).
 */

import { describe, expect, it } from 'vitest';
import {
  binomialGaussianError,
  binomialToGaussian,
  chiSquareSampler,
  cltSumDistribution,
  correlatedSums,
  correlatedVarianceFactor,
  correlatedWalk,
  dieMean,
  dieRelativeSpread,
  dieVariance,
  drawSteps,
  gammaSampler,
  gaussianLimit,
  gaussianPdf,
  ksDistanceToGaussian,
  mean,
  normalCdf,
  predictedAverageSpread,
  predictedRelativeSpread,
  predictedSumSpread,
  randomWalk,
  relativeSpreadOfAverage,
  rollDice,
  runningAverage,
  runningExcess,
  sampleAverages,
  sampleSums,
  scalingExponent,
  STEP_NAMES,
  stdDev,
  stepDistribution,
  studentTSampler,
  walkerHistogram,
  walkerSpread,
  type StepName,
} from '../../src/physics/sampling';
import { normal, uniform } from '../../src/physics/kinetics';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const NS = [1, 4, 16, 64, 256, 1024, 4096];
const SIGMA = Math.sqrt(35 / 12);

describe('one die', () => {
  it('has mean 3.5 and variance 35/12 (ThermoLab: 3.5, 2.9166666666666665, 0.48795003647426655)', () => {
    expect(dieMean()).toBe(3.5);
    expect(dieVariance()).toBeCloseTo(35 / 12, 14);
    expect(dieRelativeSpread()).toBeCloseTo(0.48795003647426655, 14);
    expect(dieMean(2)).toBe(1.5);
    expect(dieVariance(1)).toBe(0);
  });

  it('agrees with the sum over its six faces', () => {
    const faces = [1, 2, 3, 4, 5, 6];
    const m = faces.reduce((a, k) => a + k, 0) / 6;
    expect(m).toBe(dieMean());
    expect(faces.reduce((a, k) => a + (k - m) ** 2, 0) / 6).toBeCloseTo(dieVariance(), 14);
  });

  it('shows only the faces 1 to 6, each about a sixth of the time, with the stated moments, for every seed', () => {
    const n = 300000;
    for (const seed of SEEDS) {
      const r = rollDice(n, uniform(seed));
      const count = [0, 0, 0, 0, 0, 0, 0];
      for (const v of r) count[v]++;
      expect(count[0]).toBe(0);
      for (let k = 1; k <= 6; k++) expect(Math.abs(count[k] / n - 1 / 6)).toBeLessThan(5 * Math.sqrt((1 / 6) * (5 / 6) / n));
      expect(Math.abs(mean(r) - 3.5)).toBeLessThan((5 * SIGMA) / Math.sqrt(n));
      // the variance of the variance: kurtosis of a die is 1.7314, so Var(s²) = σ⁴ (κ − 1) / n
      const kurt = 1.7314;
      expect(Math.abs(stdDev(r) ** 2 - 35 / 12)).toBeLessThan(5 * (35 / 12) * Math.sqrt((kurt - 1) / n));
    }
  });

  it('is reproducible: the same seed gives the same rolls, another seed does not', () => {
    expect(Array.from(rollDice(50, uniform(3)))).toEqual(Array.from(rollDice(50, uniform(3))));
    expect(Array.from(rollDice(50, uniform(3)))).not.toEqual(Array.from(rollDice(50, uniform(4))));
  });
});

describe('the N^(-1/2) law', () => {
  it('predicts sigma/mu / sqrt(N) (ThermoLab: 0.0487950 at N = 100, 0.0076242 at N = 4096)', () => {
    expect(predictedRelativeSpread(100)).toBeCloseTo(0.04879500364742666, 14);
    expect(predictedRelativeSpread(4096)).toBeCloseTo(0.007624219319910415, 14);
    expect(predictedAverageSpread(4)).toBeCloseTo(SIGMA / 2, 14);
    expect(predictedSumSpread(4)).toBeCloseTo(SIGMA * 2, 14);
  });

  it('is measured at every N within sampling error, and the fitted exponent is -1/2, for every seed', () => {
    const samples = 2000;
    for (const seed of SEEDS) {
      const rand = uniform(seed * 101);
      const measured = NS.map((n) => relativeSpreadOfAverage(n, samples, rand));
      NS.forEach((n, i) => {
        // the standard error of a standard deviation from `samples` draws is about 1/sqrt(2 samples); 5 of them
        expect(Math.abs(measured[i] / predictedRelativeSpread(n) - 1)).toBeLessThan(5 / Math.sqrt(2 * samples));
      });
      const alpha = scalingExponent(NS, measured);
      expect(Math.abs(alpha + 0.5)).toBeLessThan(0.01);
    }
  });

  it('quadrupling N halves the spread', () => {
    const samples = 4000;
    for (const seed of SEEDS) {
      const rand = uniform(seed * 7);
      const a = relativeSpreadOfAverage(25, samples, rand);
      const b = relativeSpreadOfAverage(100, samples, rand);
      expect(Math.abs(a / b - 2)).toBeLessThan(0.15);
    }
  });
});

describe('the sum', () => {
  it('has a spread that grows as N^(+1/2), exponent 1/2, for every seed', () => {
    const samples = 2000;
    for (const seed of SEEDS) {
      const rand = uniform(seed * 13);
      const spreads = NS.map((n) => stdDev(sampleSums(n, samples, rand)));
      NS.forEach((n, i) => expect(Math.abs(spreads[i] / predictedSumSpread(n) - 1)).toBeLessThan(5 / Math.sqrt(2 * samples)));
      expect(Math.abs(scalingExponent(NS, spreads) - 0.5)).toBeLessThan(0.01);
    }
  });

  it('is N times the average, and has mean 3.5 N', () => {
    const sums = sampleSums(100, 4000, uniform(5));
    const avgs = sampleAverages(100, 4000, uniform(5));
    for (let i = 0; i < 50; i++) expect(avgs[i]).toBeCloseTo(sums[i] / 100, 12);
    expect(Math.abs(mean(sums) - 350)).toBeLessThan((5 * SIGMA * 10) / Math.sqrt(4000));
  });
});

describe('the running average', () => {
  it('is the average of the first k rolls', () => {
    expect(Array.from(runningAverage([2, 4, 6]))).toEqual([2, 3, 4]);
    expect(Array.from(runningExcess([2, 4, 6], 3.5))).toEqual([-1.5, -1, 1.5]);
  });

  it('lies inside 3.5 +/- sigma/sqrt(n) at the rate the central limit theorem gives (68.3%; 95.4% at two sigma)', () => {
    const runs = 2000;
    const checkpoints = [100, 1000];
    for (const seed of SEEDS) {
      const rand = uniform(seed * 31);
      const inside1 = [0, 0];
      const inside2 = [0, 0];
      for (let r = 0; r < runs; r++) {
        const avg = runningAverage(rollDice(1000, rand));
        checkpoints.forEach((n, j) => {
          const dev = Math.abs(avg[n - 1] - 3.5) / (SIGMA / Math.sqrt(n));
          if (dev <= 1) inside1[j]++;
          if (dev <= 2) inside2[j]++;
        });
      }
      // 5 standard errors of a proportion: 5 sqrt(p (1 - p) / runs) = 0.052 at 0.683
      for (const j of [0, 1]) {
        expect(Math.abs(inside1[j] / runs - 0.6827)).toBeLessThan(0.052);
        expect(Math.abs(inside2[j] / runs - 0.9545)).toBeLessThan(0.025);
      }
    }
  });

  it('has an excess sum - 3.5 n of spread sigma sqrt(n), and an early excess is not paid back', () => {
    const runs = 4000;
    for (const seed of SEEDS) {
      const rand = uniform(seed * 17);
      const early: number[] = [];
      const late: number[] = [];
      for (let r = 0; r < runs; r++) {
        const ex = runningExcess(rollDice(1000, rand), 3.5);
        early.push(ex[99]);
        late.push(ex[999] - ex[99]);
      }
      expect(Math.abs(stdDev(early) / (SIGMA * 10) - 1)).toBeLessThan(5 / Math.sqrt(2 * runs));
      // what the next 900 rolls add is independent of what the first 100 did: among the runs that began with a
      // positive excess, the later increment still has mean 0, so nothing compensates
      const afterPositive = late.filter((_, i) => early[i] > 0);
      const spreadLate = SIGMA * Math.sqrt(900);
      expect(Math.abs(mean(afterPositive))).toBeLessThan((5 * spreadLate) / Math.sqrt(afterPositive.length));
      // and the early excess is carried: it is not undone by the end
      const carried = early.map((e, i) => e + late[i]);
      expect(mean(carried.filter((_, i) => early[i] > 0))).toBeGreaterThan(0);
    }
  });
});

describe('the fitted exponent', () => {
  it('recovers a known power law exactly (ThermoLab scaling_exponent: -0.5, 0.2924062866973880)', () => {
    expect(scalingExponent([1, 4, 16, 64], [1, 0.5, 0.25, 0.125])).toBeCloseTo(-0.5, 12);
    expect(scalingExponent([1, 2, 3, 4], [1.0, 1.5, 0.7, 2.2])).toBeCloseTo(0.29240628669738805, 12);
  });
  it('refuses a single point', () => {
    expect(() => scalingExponent([1], [1])).toThrow();
  });
});

/*
 * Lesson 3.1: random walks and the central limit theorem. Deterministic values were checked against ThermoLab's
 * Python (thermolab.sampling with scipy.stats and numpy as the third opinion); every stochastic assertion is made
 * over several seeds against a tolerance several standard errors wide.
 */

// excess-kurtosis-derived κ = E(x − μ)⁴ / σ⁴ of one step: ±1 fair 1, ±1 biased 1.0752/0.9216, uniform 9/5, Student-t(5) 9
const KURTOSIS: Record<StepName, number> = { pm1: 1, biased: 1.0752 / 0.9216, uniform: 9 / 5, heavy: 9 };

describe('the step distributions', () => {
  it('carry their exact moments (ThermoLab: biased mean 0.2 variance 0.96, heavy variance 5/3)', () => {
    expect(STEP_NAMES).toEqual(['pm1', 'biased', 'uniform', 'heavy']);
    const m = (n: StepName) => [stepDistribution(n).mean, stepDistribution(n).variance];
    expect(m('pm1')).toEqual([0, 1]);
    expect(m('biased')[0]).toBe(0.2);
    expect(m('biased')[1]).toBeCloseTo(0.96, 14);
    expect(m('uniform')[1]).toBeCloseTo(1 / 3, 14);
    expect(m('heavy')[1]).toBeCloseTo(5 / 3, 14);
    for (const n of STEP_NAMES) expect(stepDistribution(n).std ** 2).toBeCloseTo(stepDistribution(n).variance, 14);
    expect(() => stepDistribution('cauchy')).toThrow();
    expect(() => stepDistribution('toString')).toThrow();
  });

  it('are what they say they are: the sample mean and variance of each match, for every seed', () => {
    const n = 400000;
    for (const name of STEP_NAMES) {
      const d = stepDistribution(name);
      for (const seed of SEEDS) {
        const x = drawSteps(d, n, uniform(seed));
        expect(Math.abs(mean(x) - d.mean)).toBeLessThan((5 * d.std) / Math.sqrt(n));
        // the 25/n is the fair coin's: its variance has no kurtosis term, only the error of the estimated mean
        expect(Math.abs(stdDev(x) ** 2 / d.variance - 1)).toBeLessThan(5 * Math.sqrt((KURTOSIS[name] - 1) / n) + 25 / n);
      }
    }
  });

  it('draw ±1 only for the coin walks, and [−1, 1] for the uniform one; the biased coin shows +1 six times in ten', () => {
    const pm = drawSteps('pm1', 1000, uniform(1));
    expect(pm.every((v) => v === 1 || v === -1)).toBe(true);
    const un = drawSteps('uniform', 5000, uniform(2));
    expect(Math.min(...un)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...un)).toBeLessThan(1);
    const n = 200000;
    const b = drawSteps('biased', n, uniform(3));
    const up = b.filter((v) => v === 1).length / n;
    expect(Math.abs(up - 0.6)).toBeLessThan(5 * Math.sqrt(0.24 / n));
  });

  it('are reproducible from the seed', () => {
    for (const name of STEP_NAMES) {
      expect(Array.from(drawSteps(name, 40, uniform(5)))).toEqual(Array.from(drawSteps(name, 40, uniform(5))));
      expect(Array.from(drawSteps(name, 40, uniform(5)))).not.toEqual(Array.from(drawSteps(name, 40, uniform(6))));
    }
  });
});

describe('the Student-t built from a seeded normal and chi-square', () => {
  it('has the chi-square and gamma moments (mean ν, variance 2ν; mean a, variance a), for every seed', () => {
    const n = 300000;
    for (const seed of SEEDS) {
      const chi = chiSquareSampler(5, uniform(seed));
      const x = Float64Array.from({ length: n }, chi);
      expect(Math.abs(mean(x) - 5)).toBeLessThan((5 * Math.sqrt(10)) / Math.sqrt(n));
      // Var(s²) = σ⁴ (κ − 1) / n with κ = 3 + 12/ν = 5.4 for a chi-square
      expect(Math.abs(stdDev(x) ** 2 / 10 - 1)).toBeLessThan(5 * Math.sqrt(4.4 / n));
      const g = gammaSampler(2.5, uniform(seed + 100));
      const y = Float64Array.from({ length: n }, g);
      expect(Math.abs(mean(y) - 2.5)).toBeLessThan((5 * Math.sqrt(2.5)) / Math.sqrt(n));
    }
    expect(() => gammaSampler(0.5, uniform(1))).toThrow();
    expect(() => chiSquareSampler(1, uniform(1))).toThrow();
  });

  it('has mean 0, variance 5/3, E(T²) = 5/3, and the tails of the t distribution with 5 degrees of freedom (scipy)', () => {
    const n = 400000;
    for (const seed of SEEDS) {
      const t = Float64Array.from({ length: n }, studentTSampler(5, uniform(seed)));
      expect(Math.abs(mean(t))).toBeLessThan((5 * Math.sqrt(5 / 3)) / Math.sqrt(n));
      // E T⁴ = 3ν² / ((ν − 2)(ν − 4)) = 25, so Var(T²) = 25 − 25/9
      expect(Math.abs(stdDev(t) ** 2 - 5 / 3)).toBeLessThan(5 * Math.sqrt((25 - 25 / 9) / n));
      const frac = (pred: (v: number) => boolean) => t.filter(pred).length / n;
      const within = (p: number, got: number) => expect(Math.abs(got - p)).toBeLessThan(5 * Math.sqrt((p * (1 - p)) / n));
      within(0.9499999761825422, frac((v) => v <= 2.015048)); // scipy t.cdf(2.015048, 5)
      within(0.10193947882985835, frac((v) => Math.abs(v) > 2));
      within(0.030099247897462586, frac((v) => Math.abs(v) > 3));
      within(0.01032341548083145, frac((v) => Math.abs(v) > 4));
    }
  });
});

describe('the random walk', () => {
  it('starts at the origin and is the running sum of its own steps, with exactly ±1 steps for the coin walk', () => {
    const W = 50;
    const T = 30;
    const x = randomWalk(W, T, uniform(7));
    expect(x.length).toBe(W * (T + 1));
    for (let w = 0; w < W; w++) {
      expect(x[w * (T + 1)]).toBe(0);
      for (let t = 1; t <= T; t++) {
        expect(Math.abs(x[w * (T + 1) + t] - x[w * (T + 1) + t - 1])).toBe(1);
        expect(Math.abs(x[w * (T + 1) + t]) % 2).toBe(t % 2); // parity: a ±1 walk sits on the sites t, t−2, …
      }
    }
    expect(() => randomWalk(0, 5, uniform(1))).toThrow();
    expect(() => randomWalk(5, 0, uniform(1))).toThrow();
  });

  it('draws time-major: its steps are the stream laid out step by step', () => {
    const W = 3;
    const T = 5;
    for (const name of STEP_NAMES) {
      const x = randomWalk(W, T, uniform(11), name);
      const steps = drawSteps(name, W * T, uniform(11));
      for (let w = 0; w < W; w++) {
        let s = 0;
        for (let t = 0; t < T; t++) {
          s += steps[t * W + w];
          expect(x[w * (T + 1) + t + 1]).toBeCloseTo(s, 12);
        }
      }
    }
  });

  it('has <x_t> = mu_1 t and Var = sigma_1² t for all four distributions, at several times, for every seed', () => {
    const W = 4000;
    const T = 256;
    for (const name of STEP_NAMES) {
      const d = stepDistribution(name);
      for (const seed of SEEDS) {
        const x = randomWalk(W, T, uniform(seed * 31), d);
        for (const t of [4, 16, 64, 256]) {
          const col = Float64Array.from({ length: W }, (_, w) => x[w * (T + 1) + t]);
          const se = (d.std * Math.sqrt(t)) / Math.sqrt(W);
          expect(Math.abs(mean(col) - d.mean * t)).toBeLessThan(5 * se);
          // excess kurtosis of a sum of t steps is the step's divided by t
          const kappa = 3 + (KURTOSIS[name] - 3) / t;
          expect(Math.abs(stdDev(col) ** 2 / (d.variance * t) - 1)).toBeLessThan(5 * Math.sqrt((kappa - 1) / W));
        }
      }
    }
  });

  it('spreads as sigma_1 sqrt(t): walkerSpread at the last time, and its fitted exponent 1/2', () => {
    const W = 4000;
    const T = 1024;
    for (const name of ['pm1', 'uniform', 'heavy'] as const) {
      const d = stepDistribution(name);
      for (const seed of [1, 2, 3, 4]) {
        const x = randomWalk(W, T, uniform(seed * 7), d);
        const sp = walkerSpread(x, W);
        expect(sp.length).toBe(T + 1);
        expect(sp[0]).toBe(0);
        expect(Math.abs(sp[T] / (d.std * Math.sqrt(T)) - 1)).toBeLessThan(5 * Math.sqrt(1 / (2 * W)) * 1.5);
        const times = [4, 16, 64, 256, 1024];
        expect(scalingExponent(times, times.map((t) => sp[t]))).toBeCloseTo(0.5, 1);
      }
    }
    expect(() => walkerSpread(new Float64Array(3), 1)).toThrow();
  }, 60_000);

  it('drifts at mu_1 t while it spreads at sigma_1 sqrt(t): the biased walk, ensemble mean within 4 standard errors of mu_1 t', () => {
    const W = 4000;
    const T = 400;
    const d = stepDistribution('biased');
    for (const seed of SEEDS) {
      const x = randomWalk(W, T, uniform(seed * 13), d);
      const column = (t: number) => Float64Array.from({ length: W }, (_, w) => x[w * (T + 1) + t]);
      // the mean's excursions from mu_1 t are themselves a random walk, so a 3-standard-error band is left for
      // long stretches by chance; at one fixed time it is left 0.27% of the time, and 4 standard errors 0.006%
      for (const t of [100, 400]) expect(Math.abs(mean(column(t)) - d.mean * t)).toBeLessThan((4 * d.std * Math.sqrt(t)) / Math.sqrt(W));
      const end = column(T);
      expect(mean(end)).toBeGreaterThan(0.9 * d.mean * T);
      expect(stdDev(end) / (d.std * Math.sqrt(T))).toBeCloseTo(1, 1);
    }
  });

  it('is exactly binomial for the ±1 steps: x_t = 2k − t with k ~ Binomial(t, 1/2), by chi-square, for every seed', () => {
    const W = 100000;
    const T = 10;
    const { pmf } = binomialToGaussian(T, 0.5);
    for (const seed of SEEDS) {
      const x = randomWalk(W, T, uniform(seed * 5));
      const counts = new Array<number>(T + 1).fill(0);
      for (let w = 0; w < W; w++) counts[(x[w * (T + 1) + T] + T) / 2]++;
      let chi2 = 0;
      for (let k = 0; k <= T; k++) chi2 += (counts[k] - W * pmf[k]) ** 2 / (W * pmf[k]);
      // 10 degrees of freedom: chi² > 35.6 happens once in 10⁴
      expect(chi2).toBeLessThan(35.6);
    }
  });
});

describe('walkerHistogram', () => {
  it('bins on lattice-aligned edges (ThermoLab: centres −6 −2 2 6, density 0 1/12 1/8 1/24)', () => {
    const h = walkerHistogram([-3, -1, 1, 1, 3, 5], 4, [-8, 8], 2);
    expect(Array.from(h.centres)).toEqual([-6, -2, 2, 6]);
    expect(h.width).toBe(4);
    [0, 1 / 12, 1 / 8, 1 / 24].forEach((v, i) => expect(h.density[i]).toBeCloseTo(v, 14));
  });

  it('rounds the sites per bin as Python does, halves to even (ThermoLab: width 2 not 3 for 2.5 sites)', () => {
    const h = walkerHistogram([-1, 1, 1, 3], 4, [-5, 5], 1);
    expect(h.width).toBe(2);
    expect(Array.from(h.centres)).toEqual([-4.5, -2.5, -0.5, 1.5, 3.5, 5.5]);
    expect(Array.from(h.density)).toEqual([0, 0, 0.125, 0.25, 0.125, 0]);
    const g = walkerHistogram([-1, 1, 1, 3], 2, [-5, 5], 2);
    expect(Array.from(g.centres)).toEqual([-4, 0, 4]);
    expect(Array.from(g.density)).toEqual([0, 0.1875, 0.0625]);
  });

  it('without a lattice bins evenly over the data (ThermoLab: centres −2 0 2 4)', () => {
    const h = walkerHistogram([-3, -1, 1, 1, 3, 5], 4);
    expect(Array.from(h.centres)).toEqual([-2, 0, 2, 4]);
    expect(h.density[2]).toBeCloseTo(1 / 6, 14);
  });

  it('has unit area over what it keeps, also when walkers fall outside the span (as numpy density=True)', () => {
    const h = walkerHistogram([-3, -1, 1, 1, 3, 5, 99], 4, [-8, 8]);
    expect(h.density.reduce((a, d) => a + d * h.width, 0)).toBeCloseTo(1, 12);
    const x = randomWalk(5000, 300, uniform(4242));
    const last = Float64Array.from({ length: 5000 }, (_, w) => x[w * 301 + 300]);
    for (const nBins of [31, 61, 91]) {
      const g = walkerHistogram(last, nBins, [-90, 90], 2);
      expect(g.density.reduce((a, d) => a + d * g.width, 0)).toBeCloseTo(1, 12);
    }
    expect(() => walkerHistogram([1], 4)).toThrow();
    expect(() => walkerHistogram([1, 2], 4, undefined, 0)).toThrow();
  });

  it('with one site per bin reproduces the exact binomial within shot noise (ThermoLab test_limits)', () => {
    const W = 40000;
    const T = 200;
    const x = randomWalk(W, T, uniform(9));
    const last = Float64Array.from({ length: W }, (_, w) => x[w * (T + 1) + T]);
    const h = walkerHistogram(last, 201, [-40, 40], 2);
    expect(h.width).toBe(2);
    const { pmf } = binomialToGaussian(T, 0.5);
    for (let b = 0; b < h.centres.length; b++) {
      if (Math.abs(h.centres[b]) >= 20) continue;
      const exact = pmf[Math.round((h.centres[b] + T) / 2)];
      expect(Math.abs(h.density[b] * h.width - exact)).toBeLessThan(5 * Math.sqrt((exact * (1 - exact)) / W));
    }
  });

  it('leaves only shot noise between neighbouring bins when aligned, and a large zigzag when not (ThermoLab regression)', () => {
    const alternation = (c: Float64Array, d: Float64Array) => {
      const core: number[] = [];
      for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) < 1.5) core.push(d[i]);
      let s = 0;
      for (let i = 1; i < core.length - 1; i++) s += Math.abs(core[i] / (0.5 * (core[i - 1] + core[i + 1])) - 1);
      return s / (core.length - 2);
    };
    for (const n of [250, 600]) {
      const N = 20000;
      const z = cltSumDistribution(n, N, uniform(17), 'pm1');
      const span: [number, number] = [-4, 4];
      const aligned = walkerHistogram(z, 49, span, 2 / Math.sqrt(n));
      const plain = walkerHistogram(z, 49, span);
      const core = Array.from(aligned.centres).map((c, i) => (Math.abs(c) < 1.5 ? i : -1)).filter((i) => i >= 0);
      expect(core.every((i) => aligned.density[i] > 0)).toBe(true);
      const shot = core.reduce((a, i) => a + 1 / Math.sqrt(aligned.density[i] * aligned.width * N), 0) / core.length;
      expect(alternation(aligned.centres, aligned.density)).toBeLessThan(3 * shot);
      expect(alternation(plain.centres, plain.density)).toBeGreaterThan(2 * alternation(aligned.centres, aligned.density));
    }
  });
});

describe('the Gaussian prediction', () => {
  it('is N(mu_1 t, sigma_1² t) from the exact moments (ThermoLab gaussian_limit: 0.18730667 0.2025268 0.16877738)', () => {
    const g = gaussianLimit([0, 1, 2], 4, 'biased');
    [0.18730667, 0.2025268, 0.16877738].forEach((v, i) => expect(g[i]).toBeCloseTo(v, 8));
    expect(gaussianPdf(0, 0, 1)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 14);
    expect(() => gaussianLimit([0], 0)).toThrow();
  });

  it('describes the cloud: the measured density at t = 400 stays within shot noise of it, for every seed and each step', () => {
    const W = 6000;
    const T = 400;
    for (const name of STEP_NAMES) {
      const d = stepDistribution(name);
      for (const seed of [1, 2, 3, 4]) {
        const x = randomWalk(W, T, uniform(seed * 3), d);
        const last = Float64Array.from({ length: W }, (_, w) => x[w * (T + 1) + T]);
        const h = walkerHistogram(last, 40, [d.mean * T - 3 * d.std * 20, d.mean * T + 3 * d.std * 20], d.name === 'pm1' || d.name === 'biased' ? 2 : undefined);
        const pred = gaussianLimit(h.centres, T, d);
        for (let b = 0; b < h.centres.length; b++) {
          const p = pred[b] * h.width;
          if (p < 0.02) continue;
          // the 1/√n correction (skewness, lattice) is small next to the shot noise of a bin of 6000 walkers
          expect(Math.abs(h.density[b] * h.width - p)).toBeLessThan(5 * Math.sqrt(p / W) + 0.15 * p / Math.sqrt(T));
        }
      }
    }
  });

  it('has the standard normal distribution function (scipy: Φ(−2.3), Φ(0.77), erf 0.3, 1.7, 4.2)', () => {
    expect(normalCdf(-2.3)).toBeCloseTo(0.010724110021675809, 14);
    expect(normalCdf(0.77)).toBeCloseTo(0.7793500536573503, 14);
    expect(2 * normalCdf(0.3 * Math.SQRT2) - 1).toBeCloseTo(0.3286267594591274, 14);
    expect(2 * normalCdf(1.7 * Math.SQRT2) - 1).toBeCloseTo(0.9837904585907745, 14);
    expect(2 * normalCdf(4.2 * Math.SQRT2) - 1).toBeCloseTo(0.9999999971445058, 12);
    expect(normalCdf(0)).toBe(0.5);
    expect(normalCdf(9)).toBe(1);
  });

  it('measures a Gaussian sample as close to Gaussian: the Kolmogorov distance sits at the sampling floor, for every seed', () => {
    const N = 20000;
    for (const seed of SEEDS) {
      const g = normal(uniform(seed));
      const z = Float64Array.from({ length: N }, g);
      // P(D > 1.95/√N) is about 0.001
      expect(ksDistanceToGaussian(z)).toBeLessThan(1.95 / Math.sqrt(N));
    }
    // and a shifted sample is not
    expect(ksDistanceToGaussian(Float64Array.from({ length: 1000 }, normal(uniform(1))).map((v) => v + 1))).toBeGreaterThan(0.3);
  });
});

describe('the standardised sums collapse onto the Gaussian (ThermoLab test_convergence)', () => {
  const N = 20000;
  const floor = ksDistanceToGaussian(Float64Array.from({ length: N }, normal(uniform(900))));
  const NS_CLT = [1, 4, 16, 64, 256];

  it('for pm1, uniform and heavy: far from it at n = 1, never farther as n grows, under 0.05 at n = 256, for every seed', () => {
    for (const name of ['pm1', 'uniform', 'heavy'] as const) {
      for (const seed of [17, 18, 19, 20]) {
        const dist = NS_CLT.map((n) => ksDistanceToGaussian(cltSumDistribution(n, N, uniform(seed), name)));
        expect(dist[0]).toBeGreaterThan(5 * floor);
        for (let i = 1; i < dist.length; i++) expect(dist[i]).toBeLessThan(dist[i - 1] + 2 * floor);
        expect(dist[dist.length - 1]).toBeLessThan(0.05);
      }
    }
  }, 60_000);

  it('is standardised: mean 0 and variance 1 at every n, whatever the step (the shape is what is left)', () => {
    for (const name of STEP_NAMES) {
      for (const n of [1, 16, 100]) {
        const z = cltSumDistribution(n, N, uniform(3), name);
        expect(Math.abs(mean(z))).toBeLessThan(5 / Math.sqrt(N));
        expect(Math.abs(stdDev(z) ** 2 - 1)).toBeLessThan(5 * Math.sqrt((3 + (KURTOSIS[name] - 3) / n - 1) / N) + 25 / N);
      }
    }
  });

  it('does NOT collapse for the correlated walk: the distance stalls far from the Gaussian, for every seed', () => {
    for (const seed of [23, 24, 25, 26]) {
      const dist = [16, 64, 256, 1024].map((n) => ksDistanceToGaussian(correlatedSums(n, N, 0.9, uniform(seed)).map((s) => s / Math.sqrt(n))));
      expect(Math.min(...dist)).toBeGreaterThan(0.3);
      expect(dist[dist.length - 1]).toBeGreaterThan(0.5 * dist[0]);
    }
  });

  it('is still Gaussian once the width is corrected: S_n / sqrt(n (1 + q)/(1 − q)) collapses, so only the independence was lost', () => {
    const q = 0.9;
    for (const seed of [23, 24, 25]) {
      const n = 1024;
      const s = correlatedSums(n, N, q, uniform(seed));
      const wrong = ksDistanceToGaussian(s.map((v) => v / Math.sqrt(n)));
      const right = ksDistanceToGaussian(s.map((v) => v / Math.sqrt(n * correlatedVarianceFactor(q, n))));
      expect(wrong).toBeGreaterThan(0.3);
      expect(right).toBeLessThan(0.05);
    }
  });
});

describe('de Moivre–Laplace: the binomial and its Gaussian', () => {
  it('is the exact pmf: C(10, k) / 1024, summing to 1 (ThermoLab: peaks 0.24609375, 0.0795892373871744)', () => {
    const { k, pmf, gaussian } = binomialToGaussian(10, 0.5);
    const choose = [1, 10, 45, 120, 210, 252, 210, 120, 45, 10, 1];
    choose.forEach((c, i) => expect(pmf[i]).toBeCloseTo(c / 1024, 14));
    expect(k[10]).toBe(10);
    expect(gaussian[5]).toBeCloseTo(1 / Math.sqrt(2 * Math.PI * 2.5), 14);
    for (const [n, p] of [[10, 0.5], [100, 0.5], [100, 0.6], [2000, 0.5]] as const) {
      expect(binomialToGaussian(n, p).pmf.reduce((a, v) => a + v, 0)).toBeCloseTo(1, 10);
    }
    const c = binomialToGaussian(100, 0.5);
    expect(c.pmf[50]).toBeCloseTo(0.07958923738717436, 12);
    expect(c.gaussian[50]).toBeCloseTo(1 / Math.sqrt(50 * Math.PI), 14);
    expect(Math.abs(c.gaussian[50] / c.pmf[50] - 1)).toBeLessThan(0.005);
    expect(() => binomialToGaussian(0)).toThrow();
    expect(() => binomialToGaussian(10, 1)).toThrow();
  });

  it('has a mean np and variance np(1 − p) for the pmf, and the ±1 walk is 2k − n', () => {
    for (const [n, p] of [[40, 0.5], [40, 0.3], [400, 0.6]] as const) {
      const { k, pmf } = binomialToGaussian(n, p);
      const m = pmf.reduce((a, v, i) => a + v * k[i], 0);
      const v = pmf.reduce((a, w, i) => a + w * (k[i] - m) ** 2, 0);
      expect(m).toBeCloseTo(n * p, 9);
      expect(v).toBeCloseTo(n * p * (1 - p), 9);
    }
  });

  it('has an error that shrinks with n, as 1/n for sigma times the worst gap (ThermoLab values to 1e-9)', () => {
    const ref: [number, number][] = [[10, 0.009833896435402634], [25, 0.00359015119362642], [100, 0.0009960934655609682], [400, 0.0002492607634780458], [2000, 0.00004986466636485956]];
    for (const [n, scaled] of ref) expect(binomialGaussianError(n).maxAbsScaled).toBeCloseTo(scaled, 9);
    const worst = [25, 100, 400, 1600].map((n) => binomialGaussianError(n).maxAbsScaled);
    for (let i = 1; i < worst.length; i++) expect(worst[i]).toBeLessThan(worst[i - 1]);
    expect(worst[1] / worst[2]).toBeGreaterThan(3.6);
    expect(worst[1] / worst[2]).toBeLessThan(4.4);
    expect(worst[2]).toBeLessThan(0.01);
    expect(binomialGaussianError(400, 0.5).maxAbs).toBeCloseTo(2.4926076347804582e-5, 12);
  });

  it('is relatively worst in the tails: a percent at the peak, tens of percent at 3 sigma for small n, still 0.6% at n = 400', () => {
    const e = (n: number, p = 0.5, z = 3) => binomialGaussianError(n, p, z);
    expect(e(10).tailUpper).toBeCloseTo(0.7408750801961677, 8);
    expect(e(25).tailUpper).toBeCloseTo(0.11957956839964, 8);
    expect(e(100).tailUpper).toBeCloseTo(0.02606224342656316, 8);
    expect(e(400).tailUpper).toBeCloseTo(0.0063142704229246505, 8);
    expect(e(100, 0.6).tailUpper).toBeCloseTo(0.1952513620367593, 8);
    expect(e(100, 0.6).tailLower).toBeCloseTo(0.09545081167430625, 8);
    // out beyond 3 sigma the relative error is bigger, and bigger than at the peak, at every n
    for (const n of [25, 100, 400]) {
      expect(e(n, 0.5, 4).tailUpper).toBeGreaterThan(e(n, 0.5, 3).tailUpper);
      const { pmf, gaussian } = binomialToGaussian(n);
      expect(e(n).tailUpper).toBeGreaterThan(Math.abs(gaussian[Math.floor(n / 2)] / pmf[Math.floor(n / 2)] - 1));
    }
  });
});

describe('the correlated walk', () => {
  it('has correlation exactly q between successive steps: P(same) = (1 + q)/2, lag-k correlation q^k', () => {
    const W = 100000;
    for (const q of [0.5, 0.9]) {
      const x = correlatedWalk(W, 6, q, uniform(4));
      const step = (w: number, t: number) => x[w * 7 + t + 1] - x[w * 7 + t];
      for (const lag of [1, 2, 3]) {
        let prod = 0;
        for (let w = 0; w < W; w++) prod += step(w, 4) * step(w, 4 - lag);
        expect(Math.abs(prod / W - q ** lag)).toBeLessThan(5 / Math.sqrt(W));
      }
      let same = 0;
      for (let w = 0; w < W; w++) if (step(w, 3) === step(w, 2)) same++;
      expect(Math.abs(same / W - (1 + q) / 2)).toBeLessThan(5 * Math.sqrt(0.25 / W));
    }
  });

  it('has Var(S_n) = n(1 + q)/(1 − q) − 2q(1 − q^n)/(1 − q)², exact against enumeration of every path (ThermoLab rule)', () => {
    const exact = (q: number, n: number) => {
      const stay = (1 + q) / 2;
      let m2 = 0;
      for (let bits = 0; bits < 2 ** n; bits++) {
        let pr = 0.5;
        let s = bits & 1 ? 1 : -1;
        let prev = s;
        for (let i = 1; i < n; i++) {
          const c = (bits >> i) & 1 ? 1 : -1;
          pr *= c === prev ? stay : 1 - stay;
          s += c;
          prev = c;
        }
        m2 += pr * s * s; // the mean of S_n is 0 by symmetry
      }
      return m2;
    };
    // ThermoLab's enumeration gave 5.5, 26.00390625 and 98.83731656657
    expect(exact(0.5, 3)).toBeCloseTo(5.5, 12);
    for (const [q, n] of [[0.5, 3], [0.5, 10], [0.9, 12], [0, 8], [0.95, 9]] as const) {
      expect(n * correlatedVarianceFactor(q, n)).toBeCloseTo(exact(q, n), 9);
    }
    expect(correlatedVarianceFactor(0.5, 10) * 10).toBeCloseTo(26.00390625, 10);
    expect(correlatedVarianceFactor(0, 100)).toBe(1);
  });

  it('inflates the variance by (1 + q)/(1 − q) at long times, not by 1 + q or 1/(1 − q) (the brief and ThermoLab agree)', () => {
    expect(correlatedVarianceFactor(0.5)).toBe(3);
    expect(correlatedVarianceFactor(0.9)).toBeCloseTo(19, 12);
    expect(correlatedVarianceFactor(0.5, 1)).toBe(1);
    expect(correlatedVarianceFactor(0.5, 1e6)).toBeCloseTo(3, 5);
    for (let n = 1; n < 50; n++) expect(correlatedVarianceFactor(0.7, n + 1)).toBeGreaterThan(correlatedVarianceFactor(0.7, n));
    expect(() => correlatedVarianceFactor(1)).toThrow();
  });

  it('measures that factor, finite-n included, for q = 0.5 and 0.9, at n = 16, 64 and 256, for every seed', () => {
    const W = 20000;
    for (const q of [0.5, 0.9]) {
      for (const n of [16, 64, 256]) {
        const f = correlatedVarianceFactor(q, n);
        for (const seed of SEEDS) {
          const s = correlatedSums(n, W, q, uniform(seed * 41 + n));
          const ratio = stdDev(s) ** 2 / n / f;
          // the sum is nearly Gaussian, so the relative standard error of a variance is sqrt(2/W)
          expect(Math.abs(ratio - 1)).toBeLessThan(5 * Math.sqrt(2 / W));
        }
      }
    }
  });

  it('is the fair coin walk at q = 0, and refuses q outside [0, 1)', () => {
    const W = 20000;
    const s = correlatedSums(100, W, 0, uniform(2));
    expect(Math.abs(stdDev(s) ** 2 / 100 - 1)).toBeLessThan(5 * Math.sqrt(2 / W));
    expect(s.every((v) => Math.abs(v) % 2 === 0)).toBe(true); // 100 steps of ±1 end on an even site
    expect(() => correlatedWalk(5, 5, 1, uniform(1))).toThrow();
    expect(() => correlatedWalk(5, 5, -0.1, uniform(1))).toThrow();
    expect(() => correlatedSums(0, 5, 0.5, uniform(1))).toThrow();
  });

  it('builds the same walk through correlatedWalk and correlatedSums from one seed', () => {
    const W = 40;
    const T = 25;
    const x = correlatedWalk(W, T, 0.6, uniform(9));
    const s = correlatedSums(T, W, 0.6, uniform(9));
    for (let w = 0; w < W; w++) expect(x[w * (T + 1) + T]).toBe(s[w]);
  });
});
