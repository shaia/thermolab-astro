/**
 * The claims lesson 0.1 makes about dice, each as a test: the die's moments, the N^(-1/2) law with its fitted
 * exponent, the sum's N^(+1/2) growth, and the running average inside its envelope at the expected rate.
 * Every stochastic assertion is made over several seeds, against a tolerance several standard errors wide.
 * The deterministic values were checked against ThermoLab's Python (thermolab.sampling, validation).
 */

import { describe, expect, it } from 'vitest';
import {
  dieMean,
  dieRelativeSpread,
  dieVariance,
  mean,
  predictedAverageSpread,
  predictedRelativeSpread,
  predictedSumSpread,
  relativeSpreadOfAverage,
  rollDice,
  runningAverage,
  runningExcess,
  sampleAverages,
  sampleSums,
  scalingExponent,
  stdDev,
} from '../../src/physics/sampling';
import { uniform } from '../../src/physics/kinetics';

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
