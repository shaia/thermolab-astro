/**
 * The claims module 15 makes about the Ising model, each as a test, mirroring "Verify computationally" of
 * the original course (items 1-10) at a scale that keeps the whole file well under 30 s. Seeds are fixed;
 * assertions are written to hold for any seed, not for a lucky one (every stochastic comparison is made
 * against a seed-to-seed standard error, 4 of them wide).
 */

import { describe, expect, it } from 'vitest';
import {
  acceptance,
  alignedState,
  autocorrelation,
  autocorrelationTime,
  bondSum,
  branchFlips,
  cloneState,
  effectiveSamples,
  hysteresisFields,
  hysteresisSweep,
  ising1dExact,
  latticeEnergy,
  loopArea,
  meanFieldMagnetization,
  meanFieldTc,
  meanWithError,
  observables,
  onsagerMagnetization,
  onsagerTc,
  parabolaPeak,
  randomState,
  simulate,
  sweep,
  temperatureScan,
  uniform,
  withField,
  type Rule,
} from '../../src/physics/ising';

const RULES: Rule[] = ['metropolis', 'glauber'];
/** An independent generator per (study, run). */
const rng = (study: number, run = 0) => uniform(study * 1009 + run * 7 + 1);

/** The mean over independent runs, with its seed-to-seed standard error. */
function seedStudy(runs: number, measure: (r: number) => number) {
  const v = Array.from({ length: runs }, (_, r) => measure(r));
  const mean = v.reduce((a, b) => a + b, 0) / runs;
  const se = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (runs - 1) / runs);
  return { mean, se, values: v, agrees: (x: number, nSigma = 4) => Math.abs(mean - x) <= nSigma * se };
}

const sumSpins = (l: Int8Array) => l.reduce((a, b) => a + b, 0);

describe('bookkeeping (item 1)', () => {
  for (const rule of RULES) {
    it(`${rule}: the running energy and spin total equal a recount exactly at h = 0, after 1000 sweeps`, () => {
      const r = rng(1);
      const st = randomState(16, r);
      sweep(st, 2.3, r, rule, 1000);
      expect(st.energy).toBe(latticeEnergy(st.lattice, 16, 0));
      expect(st.magnetization).toBe(sumSpins(st.lattice));
    });

    it(`${rule}: in a field the energy agrees to rounding, and the ring keeps its books too`, () => {
      const r = rng(2);
      const st = randomState(16, r, 0.3);
      sweep(st, 2.3, r, rule, 1000);
      expect(Math.abs(st.energy - latticeEnergy(st.lattice, 16, 0.3))).toBeLessThan(1e-9 * 256);
      expect(st.magnetization).toBe(sumSpins(st.lattice));
      const ring = randomState(64, r, 0, 1);
      sweep(ring, 1.5, r, rule, 500);
      expect(ring.energy).toBe(latticeEnergy(ring.lattice, 64, 0, 1));
    });
  }

  it('withField changes only the field term: the energy is even under spin reversal at h = 0 and not in a field', () => {
    const st = randomState(16, rng(3), 0.2);
    withField(st, -0.7);
    expect(st.energy).toBeCloseTo(latticeEnergy(st.lattice, 16, -0.7), 10);
    const flipped = Int8Array.from(st.lattice, (s) => -s);
    expect(latticeEnergy(flipped, 16, 0)).toBeCloseTo(latticeEnergy(st.lattice, 16, 0), 12);
    const up = alignedState(16, true, 0.5);
    const down = alignedState(16, false, 0.5);
    expect(up.energy).toBe(-2 * 256 - 0.5 * 256);
    expect(down.energy).toBe(-2 * 256 + 0.5 * 256);
    expect(cloneState(up).lattice).not.toBe(up.lattice);
  });

  it('bond counts: N on a ring, 2N on a square lattice; the aligned square lattice has E = -2N', () => {
    expect(bondSum(new Int8Array(10).fill(1), 10, 1)).toBe(10);
    expect(bondSum(new Int8Array(64).fill(1), 8, 2)).toBe(128);
    expect(alignedState(8).energy).toBe(-128);
  });

  it('at effectively infinite temperature one sweep flips every spin exactly once (the checkerboard visits each site once)', () => {
    const st = randomState(8, rng(4));
    const before = st.lattice.slice();
    sweep(st, 1e300, rng(5));
    expect(Array.from(st.lattice)).toEqual(Array.from(before, (s) => -s));
  });

  it('rejects odd or tiny sides, which would break the periodic checkerboard', () => {
    expect(() => randomState(7, rng(6))).toThrow(RangeError);
    expect(() => alignedState(2)).toThrow(RangeError);
  });
});

describe('detailed balance (item 2 premise)', () => {
  for (const rule of RULES) {
    it(`${rule}: A(dE) / A(-dE) = exp(-dE / T)`, () => {
      for (const T of [0.7, 2.269, 5]) {
        for (const dE of [0, 0.5, 2, 4, 8, 8.6]) {
          expect(acceptance(dE, T, rule) / acceptance(-dE, T, rule)).toBeCloseTo(Math.exp(-dE / T), 12);
        }
      }
    });
  }
  it('Metropolis accepts a zero-cost move for sure, Glauber with probability 1/2', () => {
    expect(acceptance(0, 2, 'metropolis')).toBe(1);
    expect(acceptance(0, 2, 'glauber')).toBe(0.5);
  });
});

describe('the chain against its exact solutions (items 2, 3, 4)', () => {
  it.each([
    [1, 0],
    [2, 0],
    [1, 0.3],
  ])('the Glauber ring at T = %d, h = %d matches the transfer matrix within 4 standard errors', (T, h) => {
    const exact = ising1dExact(T, h);
    const traces = Array.from({ length: 16 }, (_, run) => {
      const r = rng(10, run);
      return simulate(randomState(1024, r, h, 1), T, 1000, r, { burnIn: 300, rule: 'glauber' });
    });
    const e = seedStudy(16, (k) => traces[k].e.reduce((a, b) => a + b, 0) / traces[k].e.length);
    expect(e.agrees(exact.e)).toBe(true);
    if (h) {
      const m = seedStudy(16, (k) => traces[k].m.reduce((a, b) => a + b, 0) / traces[k].m.length);
      expect(m.agrees(exact.m)).toBe(true);
    }
  });

  it('after 100 sweeps of burn-in Metropolis on the zero-field ring still remembers a cold start; Glauber does not', () => {
    const T = 1;
    const exact = ising1dExact(T).e;
    const run = (rule: Rule) =>
      seedStudy(16, (k) => {
        const r = rng(11, k);
        const { e } = simulate(alignedState(4096, true, 0, 1), T, 200, r, { burnIn: 100, rule });
        return e.reduce((a, b) => a + b, 0) / e.length;
      });
    expect(run('glauber').agrees(exact)).toBe(true);
    const metro = run('metropolis');
    expect(metro.mean).toBeLessThan(exact - 3 * metro.se);
  });

  it.each([1.5, 1.9, 2.0])('the 32 x 32 lattice at T = %d reproduces the Onsager-Yang magnetization', (T) => {
    const study = seedStudy(16, (k) => {
      const r = rng(12, k);
      const { m } = simulate(alignedState(32), T, 400, r, { burnIn: 100 });
      return m.reduce((a, b) => a + Math.abs(b), 0) / m.length;
    });
    expect(study.agrees(onsagerMagnetization(T))).toBe(true);
    // mean field is visibly off at 2.0: 0.958 against the exact 0.9113
    if (T === 2) expect(Math.abs(meanFieldMagnetization(T) - onsagerMagnetization(T))).toBeGreaterThan(0.04);
  });

  it('at T = 20 the response follows the high-temperature series (1.235), not the free spin (1)', () => {
    const T = 20;
    const h = 0.2;
    const v = Math.tanh(1 / T);
    const series = 1 + 4 * v + 12 * v ** 2 + 36 * v ** 3 + 100 * v ** 4;
    expect(series).toBeCloseTo(1.235, 2);
    const study = seedStudy(16, (k) => {
      const r = rng(13, k);
      const { m } = simulate(randomState(64, r, h), T, 500, r, { burnIn: 50 });
      return m.reduce((a, b) => a + b, 0) / m.length;
    });
    expect(study.agrees((series * h) / T)).toBe(true);
    expect(study.agrees(Math.tanh(h / T))).toBe(false);
    const chiT = (study.mean * T) / h;
    expect(chiT).toBeGreaterThan(1.15);
  });
});

describe('the transition, located (items 5, 6)', () => {
  // an annealing ladder from above, as in the lesson, on a grid of 0.05
  const temps = Array.from({ length: 15 }, (_, i) => 2.9 - 0.05 * i);
  const scan = (size: number, seed: number) => {
    const obs = temperatureScan(size, temps, 3000, rng(14, seed), { burnIn: 300 }).reverse();
    return { T: [...temps].reverse(), chi: obs.map((o) => o.susceptibility) };
  };

  it('the susceptibility peak lies above T_c and moves toward it from L = 8 to L = 16, growing as it goes', () => {
    const peak = (size: number) => {
      // average three independent scans, then locate the peak by a parabola
      const runs = [0, 1, 2].map((s) => scan(size, s));
      const chi = runs[0].chi.map((_, i) => runs.reduce((a, r) => a + r.chi[i], 0) / runs.length);
      return parabolaPeak(runs[0].T, chi);
    };
    const p8 = peak(8);
    const p16 = peak(16);
    expect(p8.x).toBeGreaterThan(onsagerTc());
    expect(p16.x).toBeGreaterThan(onsagerTc() - 0.02);
    expect(p16.x).toBeLessThan(p8.x);
    expect(p16.y).toBeGreaterThan(2 * p8.y);
  });

  it('tau of |m| is largest at T_c across the scan (L = 32) and grows with L there', () => {
    const grid = [1.5, 2.0, 2.27, 2.5, 3.0, 3.5];
    const tauAt = (size: number) => {
      const r = rng(15, size);
      const obs = temperatureScan(size, [...grid].reverse(), 8000, r, { burnIn: 500 }).reverse();
      return obs.map((o) => o.tauAbsMagnetization);
    };
    const t32 = tauAt(32);
    expect(t32.indexOf(Math.max(...t32))).toBe(grid.indexOf(2.27));
    expect(t32[grid.indexOf(2.27)]).toBeGreaterThan(1.5 * t32[grid.indexOf(2.5)]);
    expect(t32[grid.indexOf(1.5)]).toBeLessThan(3);
    expect(t32[grid.indexOf(3.5)]).toBeLessThan(3);
    const at = (size: number) => {
      const r = rng(16, size);
      const { m } = simulate(alignedState(size), 2.27, 12000, r, { burnIn: 500 });
      return autocorrelationTime(m.map(Math.abs));
    };
    const [a, b, c] = [at(8), at(16), at(32)];
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(c).toBeGreaterThan(2 * a);
  });
});

describe('who chooses the direction (item 7)', () => {
  it('below T_c a small lattice reverses its magnetization many times; a larger one almost never does', () => {
    const flips = [8, 16].map((L) => {
      const { m } = simulate(alignedState(L), 2.0, 40000, rng(17, L), { burnIn: 0 });
      return branchFlips(m);
    });
    // the lesson: in 1e5 sweeps a 16 x 16 lattice reverses rarely if at all (none in most runs, a few in some)
    expect(flips[0]).toBeGreaterThanOrEqual(5);
    expect(flips[1]).toBeLessThanOrEqual(3);
    expect(flips[1]).toBeLessThan(flips[0] / 3);
  });

  it('branchFlips counts full traverses only', () => {
    expect(branchFlips([0.9, 0.2, -0.3, 0.4, -0.8, -0.9, 0.1, 0.7, 0.8])).toBe(2);
    expect(branchFlips([0.3, -0.3, 0.4, -0.2])).toBe(0);
    expect(() => branchFlips([0], 1)).toThrow(RangeError);
  });
});

describe('hysteresis (item 8)', () => {
  const loop = (T: number, sweepsPerStep: number, seed: number) => {
    const r = rng(18, seed);
    const fields = hysteresisFields(1, 81);
    const { m } = hysteresisSweep(randomState(32, r, 1), T, fields, sweepsPerStep, r, { burnIn: 200 });
    return loopArea(fields, m);
  };

  it('the loop is clearly open at T = 1.5 and closes at T = 3.0', () => {
    expect(loop(1.5, 20, 1)).toBeGreaterThan(1.0);
    expect(loop(3.0, 20, 1)).toBeLessThan(0.15);
  });

  it('slower sweeps narrow the loop, which stays open (T = 1.5, 5 against 80 sweeps per step)', () => {
    const fast = loop(1.5, 5, 2);
    const slow = loop(1.5, 80, 2);
    expect(slow).toBeLessThan(fast);
    expect(slow).toBeGreaterThan(0.5);
  });

  it('the field ladder is closed, and a square loop has its area', () => {
    const f = hysteresisFields(1, 11);
    expect(f.length).toBe(21);
    expect(f[0]).toBe(1);
    expect(f[f.length - 1]).toBe(1);
    expect(Math.min(...f)).toBe(-1);
    expect(loopArea([1, -1, -1, 1], [1, 1, -1, -1])).toBe(4);
  });
});

describe('two update rules, one equilibrium (item 9)', () => {
  it('Metropolis and Glauber agree on the energy at T = 2.8 (within combined standard errors)', () => {
    const study = (rule: Rule) =>
      seedStudy(8, (k) => {
        const r = rng(19, k);
        const { e } = simulate(randomState(16, r), 2.8, 1500, r, { burnIn: 300, rule });
        return e.reduce((a, b) => a + b, 0) / e.length;
      });
    const a = study('metropolis');
    const b = study('glauber');
    expect(Math.abs(a.mean - b.mean)).toBeLessThan(3.5 * Math.hypot(a.se, b.se));
  });

  it('after a quench to T = 1.5 Glauber is still visibly higher in energy than Metropolis', () => {
    const e = (rule: Rule, sweeps: number) =>
      seedStudy(8, (k) => {
        const r = rng(20, k);
        const st = randomState(32, r);
        sweep(st, 1.5, r, rule, sweeps);
        return st.energy / 1024;
      }).mean;
    for (const n of [5, 20]) expect(e('glauber', n) - e('metropolis', n)).toBeGreaterThan(0.05);
  });
});

describe('the error bar (item 10)', () => {
  it('the tau-corrected error matches the seed-to-seed scatter; the naive sigma / sqrt(n) is far too small', () => {
    const means: number[] = [];
    const errors: number[] = [];
    const naive: number[] = [];
    for (let k = 0; k < 16; k++) {
      const r = rng(21, k);
      const { m } = simulate(randomState(16, r), 2.35, 3000, r, { burnIn: 500 });
      const a = m.map(Math.abs);
      const { mean, error } = meanWithError(a);
      means.push(mean);
      errors.push(error);
      const sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / (a.length - 1));
      naive.push(sd / Math.sqrt(a.length));
    }
    const mu = means.reduce((x, y) => x + y, 0) / means.length;
    const scatter = Math.sqrt(means.reduce((x, y) => x + (y - mu) ** 2, 0) / (means.length - 1));
    const avg = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
    expect(avg(errors) / scatter).toBeGreaterThan(0.6);
    expect(avg(errors) / scatter).toBeLessThan(2.5);
    expect(avg(naive)).toBeLessThan(0.5 * scatter);
  });

  it('the autocorrelation time of an AR(1) process is (1 + phi) / (2 (1 - phi)); white noise has 1/2', () => {
    const r = rng(22);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    const phi = 0.9;
    const x = new Float64Array(100_000);
    for (let i = 1; i < x.length; i++) x[i] = phi * x[i - 1] + gauss();
    const exact = (1 + phi) / (2 * (1 - phi));
    expect(Math.abs(autocorrelationTime(x) / exact - 1)).toBeLessThan(0.15);
    const white = Float64Array.from({ length: 50_000 }, gauss);
    expect(Math.abs(autocorrelationTime(white) - 0.5)).toBeLessThan(0.05);
  });

  it('autocorrelation is 1 at lag 0 and matches a direct sum; effective samples are N / 2 tau', () => {
    const x = Float64Array.from({ length: 200 }, (_, i) => Math.sin(i / 7) + 0.1 * Math.cos(i * 3.1));
    const rho = autocorrelation(x, 5);
    expect(rho[0]).toBeCloseTo(1, 12);
    const mean = x.reduce((a, b) => a + b, 0) / x.length;
    let c0 = 0;
    let c3 = 0;
    for (let i = 0; i < x.length; i++) c0 += (x[i] - mean) ** 2;
    for (let i = 0; i + 3 < x.length; i++) c3 += (x[i] - mean) * (x[i + 3] - mean);
    expect(rho[3]).toBeCloseTo(c3 / c0, 10);
    expect(effectiveSamples(1000, 5)).toBe(100);
    expect(() => effectiveSamples(10, 0.2)).toThrow(RangeError);
  });

  it('observables of a constant trace has zero variance and tau 1/2', () => {
    const o = observables(new Float64Array(50).fill(0.5), new Float64Array(50).fill(-1), 2, 64);
    expect(o.susceptibility).toBe(0);
    expect(o.tauAbsMagnetization).toBe(0.5);
  });
});

describe('the exact anchors', () => {
  it("Onsager's T_c to machine precision, and the magnetization vanishes with exponent 1/8", () => {
    expect(Math.abs(onsagerTc() - 2.269185314213022)).toBeLessThan(1e-14);
    expect(onsagerTc()).toBe(2 / Math.log(1 + Math.sqrt(2)));
    expect(onsagerMagnetization(onsagerTc() * 1.01)).toBe(0);
    const [g1, g2] = [1e-4, 1e-5];
    const slope = Math.log(onsagerMagnetization(onsagerTc() * (1 - g1)) / onsagerMagnetization(onsagerTc() * (1 - g2))) / Math.log(g1 / g2);
    expect(Math.abs(slope - 0.125)).toBeLessThan(1e-3);
    expect(onsagerMagnetization(1.5)).toBeCloseTo(0.9865, 4);
    expect(onsagerMagnetization(2)).toBeCloseTo(0.9113, 4);
    expect(onsagerMagnetization(2.2)).toBeCloseTo(0.7848, 4);
  });

  it('the one-dimensional energy is -tanh(1/T) at h = 0, with no magnetization; the chain has no transition', () => {
    for (const T of [0.5, 1, 3, 10]) {
      const { e, m } = ising1dExact(T);
      expect(e).toBeCloseTo(-Math.tanh(1 / T), 12);
      expect(m).toBe(0);
    }
    expect(ising1dExact(1, 0.3).m).toBeCloseTo(0.91382, 4);
  });

  it('the one-dimensional energy in a field is minus the beta derivative of ln lambda', () => {
    const [h, beta, step] = [0.4, 0.8, 1e-5];
    const logLambda = (b: number) => b + Math.log(Math.cosh(b * h) + Math.sqrt(Math.sinh(b * h) ** 2 + Math.exp(-4 * b)));
    const numeric = -(logLambda(beta + step) - logLambda(beta - step)) / (2 * step);
    expect(Math.abs(ising1dExact(1 / beta, h).e / numeric - 1)).toBeLessThan(1e-9);
  });

  it('mean field orders below q J with exponent 1/2, solves its own equation, is odd in h, and invents a transition on the chain', () => {
    expect(meanFieldTc()).toBe(4);
    expect(meanFieldMagnetization(4.0001)).toBe(0);
    expect(meanFieldMagnetization(3)).toBeCloseTo(0.776, 3);
    const [g1, g2] = [1e-4, 1e-6];
    const slope = Math.log(meanFieldMagnetization(4 * (1 - g1)) / meanFieldMagnetization(4 * (1 - g2))) / Math.log(g1 / g2);
    expect(Math.abs(slope - 0.5)).toBeLessThan(1e-3);
    for (const [T, h] of [[3, 0.2], [5, 0.5], [1, 0.01]]) {
      const m = meanFieldMagnetization(T, h);
      expect(Math.abs(m - Math.tanh((4 * m + h) / T))).toBeLessThan(1e-14);
      expect(meanFieldMagnetization(T, -h)).toBe(-m);
    }
    expect(meanFieldMagnetization(1, 0, 2)).toBeGreaterThan(0.9);
    expect(ising1dExact(1).m).toBe(0);
  });
});

describe('parabolaPeak', () => {
  it('finds the vertex of a parabola between the grid points, exactly', () => {
    const x = [0, 1, 2, 3, 4];
    const y = x.map((v) => 5 - (v - 2.3) ** 2);
    const p = parabolaPeak(x, y);
    expect(p.x).toBeCloseTo(2.3, 12);
    expect(p.y).toBeCloseTo(5, 12);
  });
  it('falls back to the highest sample at an edge or on a non-uniform grid it still handles', () => {
    expect(parabolaPeak([0, 1, 2], [3, 2, 1])).toEqual({ x: 0, y: 3 });
    const x = [0, 0.5, 2, 3];
    const p = parabolaPeak(x, x.map((v) => 1 - (v - 1.4) ** 2));
    expect(p.x).toBeCloseTo(1.4, 12);
  });
});
