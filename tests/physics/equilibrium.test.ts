/**
 * The claims lesson 1.1 makes about two bodies exchanging quanta, each as a test: the exact conservation of
 * energy, T_eq from the capacities, the mean gap following (1 − 1/Q)^n, τ → Q, no systematic overshoot, the hop
 * rule's stationary law binomial (the 1:4:6:4:1 example) and the scatter around the mean falling as N^(−1/2).
 * Every stochastic assertion is made over several seeds, against a tolerance several standard errors wide.
 * The deterministic values were checked against ThermoLab's Python (thermolab.equilibrium).
 */

import { describe, expect, it } from 'vitest';
import {
  countQuanta,
  equilibriumTemperature,
  fromTemperatures,
  hopQuantum,
  placeQuanta,
  predictedRelaxation,
  relaxationScatter,
  relaxationTime,
  simulateEnergyExchange,
  temperatureA,
  temperatureB,
  temperatureSeries,
  totalQuanta,
  twoBodyState,
} from '../../src/physics/equilibrium';
import { uniform } from '../../src/physics/kinetics';

const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const meanOf = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const seOf = (a: number[]) => {
  const m = meanOf(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1) / a.length);
};

/** the figure's default pair: 100 and 300 oscillators at T = 4 and 1 */
const DEFAULT = fromTemperatures(100, 300, 4, 1);

describe('the state', () => {
  it('rounds the starting temperatures to whole quanta', () => {
    expect(DEFAULT).toEqual({ nA: 100, nB: 300, qA: 400, qB: 300 });
    expect(temperatureA(DEFAULT)).toBe(4);
    expect(temperatureB(DEFAULT)).toBe(1);
    const s = fromTemperatures(10, 10, 3.04, 0.55);
    expect([s.qA, s.qB]).toEqual([30, 6]);
  });
  it('rejects what is not a pair of bodies', () => {
    expect(() => twoBodyState(0, 5, 1, 1)).toThrow(RangeError);
    expect(() => twoBodyState(5, 5, -1, 1)).toThrow(RangeError);
    expect(() => twoBodyState(5, 5, 1.5, 1)).toThrow(RangeError);
    expect(() => fromTemperatures(5, 5, 0, 1)).toThrow(RangeError);
  });
});

describe('the equilibrium temperature', () => {
  it('is the capacity-weighted mean (checked against ThermoLab)', () => {
    expect(equilibriumTemperature(5, 400, 5, 300)).toBeCloseTo(350, 12);
    expect(equilibriumTemperature(1e6, 400, 1, 100)).toBeCloseTo(400, 1);
    expect(equilibriumTemperature(100, 4, 300, 1)).toBe(1.75);
    expect(() => equilibriumTemperature(0, 1, 1, 1)).toThrow(RangeError);
  });
  it('equals the shared temperature Q / N of the conserved quanta, for any start', () => {
    for (const [nA, nB, tA, tB] of [[100, 300, 4, 1], [37, 211, 0.7, 5.3], [2000, 10, 9, 0.5]] as const) {
      const s = fromTemperatures(nA, nB, tA, tB);
      expect(equilibriumTemperature(nA, temperatureA(s), nB, temperatureB(s))).toBeCloseTo(totalQuanta(s) / (nA + nB), 12);
    }
  });
  it('is where a long run settles (mean over seeds, 3.5 standard errors)', () => {
    const s = fromTemperatures(150, 50, 4, 2);
    const target = equilibriumTemperature(s.nA, temperatureA(s), s.nB, temperatureB(s));
    const steps = Math.round(8 * relaxationTime(s));
    const finals = seeds(24).map((seed) => temperatureSeries(simulateEnergyExchange(s, steps, uniform(seed))).tA[steps - 1]);
    expect(Math.abs(meanOf(finals) - target)).toBeLessThan(3.5 * seOf(finals));
  });
});

describe('energy', () => {
  it('is conserved exactly by the counts chain, whatever the sizes and the start', () => {
    for (const [nA, nB, qA, qB, steps] of [[3, 5, 0, 9, 500], [50, 2, 30, 1, 2000], [1, 1, 5, 5, 300], [40, 60, 200, 0, 5000]] as const) {
      const s = twoBodyState(nA, nB, qA, qB);
      const r = simulateEnergyExchange(s, steps, uniform(7));
      const q = qA + qB;
      for (let i = 0; i < r.qA.length; i++) {
        expect(r.qA[i]).toBeGreaterThanOrEqual(0);
        expect(r.qA[i]).toBeLessThanOrEqual(q);
        expect(Math.abs(r.qA[i] - (i ? r.qA[i - 1] : qA))).toBeLessThanOrEqual(1);
      }
      const { tA, tB } = temperatureSeries(r);
      for (let i = 0; i < steps; i += 97) expect(nA * tA[i] + nB * tB[i]).toBeCloseTo(q, 9);
    }
  });
  it('is conserved exactly oscillator by oscillator, and the two chains agree on qA', () => {
    const s = DEFAULT;
    const rand = uniform(3);
    const pos = placeQuanta(s, rand);
    const n = s.nA + s.nB;
    let qA = s.qA;
    for (let i = 0; i < 20000; i++) {
      const { from, to } = hopQuantum(pos, n, rand);
      qA += (to < s.nA ? 1 : 0) - (from < s.nA ? 1 : 0);
    }
    const counts = countQuanta(pos, n);
    expect(counts.reduce((a, c) => a + c, 0)).toBe(totalQuanta(s));
    expect(counts.slice(0, s.nA).reduce((a, c) => a + c, 0)).toBe(qA);
  });
  it('is placed as asked: qA quanta on A, qB on B', () => {
    const counts = countQuanta(placeQuanta(DEFAULT, uniform(1)), 400);
    expect(counts.slice(0, 100).reduce((a, c) => a + c, 0)).toBe(400);
    expect(counts.slice(100).reduce((a, c) => a + c, 0)).toBe(300);
  });
  it('is reproducible from the seed', () => {
    const a = simulateEnergyExchange(DEFAULT, 500, uniform(11));
    const b = simulateEnergyExchange(DEFAULT, 500, uniform(11));
    const c = simulateEnergyExchange(DEFAULT, 500, uniform(12));
    expect(Array.from(a.qA)).toEqual(Array.from(b.qA));
    expect(Array.from(a.qA)).not.toEqual(Array.from(c.qA));
  });
});

describe('the relaxation time', () => {
  it('matches ThermoLab and tends to Q', () => {
    expect(relaxationTime(DEFAULT)).toBeCloseTo(699.4998808672616, 9);
    expect(relaxationTime(fromTemperatures(10, 10, 3.04, 0.55))).toBeCloseTo(35.49765245796934, 9);
    expect(relaxationTime(twoBodyState(5, 5, 2, 0))).toBeCloseTo(1.4426950408889634, 12);
    expect(relaxationTime(twoBodyState(5, 5, 10, 0))).toBeCloseTo(9.491221581029905, 12);
    for (const q of [100, 1000, 100000]) {
      const tau = relaxationTime(twoBodyState(5, 5, q, 0));
      expect(tau / q).toBeGreaterThan(1 - 1 / q);
      expect(Math.abs(tau - (q - 0.5))).toBeLessThan(1 / q);
    }
    expect(() => relaxationTime(twoBodyState(5, 5, 1, 0))).toThrow(RangeError);
  });
  it('makes (1 − 1/Q)^n and exp(−n/τ) the same curve, as the closed form (checked against ThermoLab)', () => {
    const tau = relaxationTime(DEFAULT);
    const steps = [0, 1, 700, 2100, 4200];
    const p = predictedRelaxation(DEFAULT, steps);
    const want = [3, 2.99571429, 1.10284954, 0.14904118, 0.00740442];
    steps.forEach((n, i) => {
      expect(p[i]).toBeCloseTo(want[i], 8);
      expect(p[i]).toBeCloseTo(3 * Math.exp(-n / tau), 12);
    });
  });
});

describe('the mean gap', () => {
  it('follows (1 − 1/Q)^n over many seeds, at several checkpoints (4 standard errors)', () => {
    const s = fromTemperatures(60, 20, 4, 1);
    const tau = relaxationTime(s);
    const checkpoints = [1, 0.25, 0.5, 1, 2, 3].map((x) => Math.max(1, Math.round(x * tau)));
    const last = Math.max(...checkpoints);
    const gaps = seeds(96).map((seed) => {
      const { tA, tB } = temperatureSeries(simulateEnergyExchange(s, last, uniform(seed)));
      return checkpoints.map((n) => tA[n - 1] - tB[n - 1]);
    });
    const predicted = predictedRelaxation(s, checkpoints);
    checkpoints.forEach((_, j) => {
      const col = gaps.map((g) => g[j]);
      expect(Math.abs(meanOf(col) - predicted[j])).toBeLessThan(4 * seOf(col));
    });
  });
  it('is not an approximation: the same law holds for a tiny pair at one step', () => {
    const s = twoBodyState(2, 3, 7, 1);
    const one = seeds(4000).map((seed) => {
      const r = simulateEnergyExchange(s, 1, uniform(seed));
      return r.qA[0] / s.nA - (8 - r.qA[0]) / s.nB;
    });
    expect(Math.abs(meanOf(one) - predictedRelaxation(s, [1])[0])).toBeLessThan(4 * seOf(one));
  });
});

describe('no overshoot', () => {
  it('the mean gap keeps the sign of the starting gap, for either body hotter', () => {
    for (const [tA, tB] of [[4, 1], [1, 4]] as const) {
      const s = fromTemperatures(100, 300, tA, tB);
      const sign = Math.sign(tA - tB);
      const n = Math.round(8 * relaxationTime(s));
      for (const v of predictedRelaxation(s, [0, 1, 10, 100, 1000, n])) expect(Math.sign(v)).toBe(sign);
    }
  });
  it('each body approaches T_eq from its own side (mean over seeds, never beyond 3 standard errors)', () => {
    const s = DEFAULT;
    const teq = totalQuanta(s) / (s.nA + s.nB);
    const tau = relaxationTime(s);
    const checkpoints = [0.5, 1, 2, 3, 4, 6].map((x) => Math.round(x * tau));
    const last = checkpoints[checkpoints.length - 1];
    const runs = seeds(64).map((seed) => temperatureSeries(simulateEnergyExchange(s, last, uniform(seed))));
    for (const n of checkpoints) {
      const a = runs.map((r) => r.tA[n - 1] - teq);
      const b = runs.map((r) => r.tB[n - 1] - teq);
      expect(meanOf(a) + 3 * seOf(a)).toBeGreaterThan(0);
      expect(meanOf(b) - 3 * seOf(b)).toBeLessThan(0);
    }
  });
});

describe('the stationary law of the hop rule', () => {
  const binomial = [1, 4, 6, 4, 1].map((c) => c / 16);
  const einstein = [5, 8, 9, 8, 5].map((c) => c / 35);
  const maxDiff = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

  it('is binomial, 1:4:6:4:1 for 2 + 2 oscillators and 4 quanta, not the Einstein count 5:8:9:8:5', () => {
    const r = simulateEnergyExchange(twoBodyState(2, 2, 4, 0), 400000, uniform(1));
    const visits = [0, 0, 0, 0, 0];
    for (let i = 1000; i < r.qA.length; i++) visits[r.qA[i]]++;
    const p = visits.map((v) => v / (r.qA.length - 1000));
    expect(maxDiff(p, binomial)).toBeLessThan(0.01);
    expect(maxDiff(p, einstein)).toBeGreaterThan(0.05);
  });
  it('is the same law for the labelled quanta moved oscillator by oscillator', () => {
    const s = twoBodyState(2, 2, 4, 0);
    const rand = uniform(2);
    const pos = placeQuanta(s, rand);
    let qA = 4;
    const visits = [0, 0, 0, 0, 0];
    const steps = 400000;
    for (let i = 0; i < steps; i++) {
      const { from, to } = hopQuantum(pos, 4, rand);
      qA += (to < 2 ? 1 : 0) - (from < 2 ? 1 : 0);
      if (i >= 1000) visits[qA]++;
    }
    expect(maxDiff(visits.map((v) => v / (steps - 1000)), binomial)).toBeLessThan(0.01);
  });
});

describe('the scatter around the mean', () => {
  /** the mean over seeds of a run's RMS deviation from the prediction, for nA = n, nB = 3n at T = 4 and 1 */
  const rms = (n: number, count: number) => {
    const s = fromTemperatures(n, 3 * n, 4, 1);
    const steps = 6 * totalQuanta(s);
    const v = seeds(count).map((seed) => relaxationScatter(simulateEnergyExchange(s, steps, uniform(seed))));
    return { mean: meanOf(v), se: seOf(v) };
  };

  it('falls as N^(−1/2): a factor of ten in size divides it by √10 (checked against ThermoLab: 3.13 and 3.24)', () => {
    const small = rms(20, 48);
    const mid = rms(200, 48);
    const big = rms(2000, 48);
    expect(small.mean).toBeGreaterThan(mid.mean);
    expect(mid.mean).toBeGreaterThan(big.mean);
    for (const [a, b] of [[small, mid], [mid, big]]) {
      expect(Math.abs(a.mean / b.mean - Math.sqrt(10)) / Math.sqrt(10)).toBeLessThan(0.1);
    }
    const slope = Math.log(big.mean / small.mean) / Math.log(100);
    expect(Math.abs(slope + 0.5)).toBeLessThan(0.03);
  });
  it('refuses a pair that starts at one temperature', () => {
    expect(() => relaxationScatter(simulateEnergyExchange(fromTemperatures(10, 10, 2, 2), 10, uniform(1)))).toThrow(RangeError);
  });
});
