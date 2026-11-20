import { describe, expect, it } from 'vitest';
import { uniform } from '../../src/physics/kinetics';
import { cltSumDistribution, correlatedSums, correlatedVarianceFactor } from '../../src/physics/sampling';
import {
  binomialFrame,
  CLT_DISTS,
  CltEnsemble,
  cleanDists,
  cleanN,
  cleanP,
  cleanPersistence,
  errorStrip,
  latticeFloor,
  expectedVarianceRatio,
  measure,
  N_MAX,
  nFromSlider,
  sliderFromN,
  standardisation,
  standardisedDensity,
  type CltDist,
} from '../../src/sims/core/clt-view';

describe('the n slider', () => {
  it('runs from 1 to 400 on a log scale and inverts', () => {
    expect(nFromSlider(0)).toBe(1);
    expect(nFromSlider(1)).toBe(N_MAX);
    expect(nFromSlider(-1)).toBe(1);
    expect(nFromSlider(3)).toBe(N_MAX);
    for (const n of [1, 2, 10, 64, 100, 400]) expect(nFromSlider(sliderFromN(n))).toBe(n);
  });
});

describe('what comes from outside', () => {
  it('is cleaned to a legal n, list, persistence or p, or the default', () => {
    expect(cleanN(0, 1)).toBe(1);
    expect(cleanN(1e6, 1)).toBe(400);
    expect(cleanN(63.7, 1)).toBe(64);
    expect(cleanN('3', 7)).toBe(7);
    expect(cleanDists(['heavy', 'pm1', 'pm1', 'nope'], CLT_DISTS)).toEqual(['pm1', 'heavy']);
    expect(cleanDists([], CLT_DISTS)).toEqual([...CLT_DISTS]);
    expect(cleanDists('pm1', ['uniform'])).toEqual(['uniform']);
    expect(cleanPersistence(1, 0.5)).toBe(0.95);
    expect(cleanPersistence(-1, 0.5)).toBe(0);
    expect(cleanPersistence(0.666, 0.5)).toBe(0.67);
    expect(cleanPersistence(undefined, 0.5)).toBe(0.5);
    expect(cleanP(0, 0.5)).toBe(0.05);
    expect(cleanP(0.6, 0.5)).toBe(0.6);
  });
});

describe('the ensemble of sums', () => {
  const S = 500;

  it("standardises with the step's own mean and spread, and with ±1's for the correlated walk", () => {
    expect(standardisation('uniform').std).toBeCloseTo(Math.sqrt(1 / 3), 14);
    expect(standardisation('heavy').std).toBeCloseTo(Math.sqrt(5 / 3), 14);
    expect(standardisation('correlated')).toEqual({ mean: 0, std: 1 });
  });

  it("is the physics module's sums, built a term at a time: the same numbers as cltSumDistribution and correlatedSums", () => {
    const e = new CltEnsemble(S, 3, 0.6);
    expect(e.advanceTo(40, CLT_DISTS, 1e9)).toBe(true);
    const idx = { pm1: 0, uniform: 1, heavy: 2 } as const;
    for (const d of ['pm1', 'uniform', 'heavy'] as const) {
      const ref = cltSumDistribution(40, S, uniform(3 * 100003 + 7919 * (idx[d] + 1)), d);
      const got = e.standardised(d);
      for (let i = 0; i < S; i++) expect(got[i]).toBeCloseTo(ref[i], 10);
    }
    const ref = correlatedSums(40, S, 0.6, uniform(3 * 100003 + 7919 * 4));
    const got = e.standardised('correlated');
    for (let i = 0; i < S; i++) expect(got[i]).toBeCloseTo(ref[i] / Math.sqrt(40), 10);
  });

  it('gives the same S_n however n was reached: forward in steps, or back after going past', () => {
    const fresh = new CltEnsemble(S, 4, 0.5);
    fresh.advanceTo(16, CLT_DISTS, 1e9);
    const walked = new CltEnsemble(S, 4, 0.5);
    walked.advanceTo(4, CLT_DISTS, 1e9);
    walked.advanceTo(16, CLT_DISTS, 1e9);
    walked.advanceTo(64, CLT_DISTS, 1e9);
    walked.advanceTo(16, CLT_DISTS, 1e9);
    for (const d of CLT_DISTS) expect(Array.from(walked.standardised(d))).toEqual(Array.from(fresh.standardised(d)));
  });

  it('works in slices: a spent budget returns false, keeps its progress, and finishing needs more calls, not more work', () => {
    const e = new CltEnsemble(S, 1, 0.5);
    let clock = 0;
    const tick = () => (clock += 1); // every look at the clock costs 1 ms
    let calls = 0;
    while (!e.advanceTo(30, ['heavy', 'pm1'], 5, tick)) {
      calls++;
      expect(calls).toBeLessThan(100);
    }
    expect(calls).toBeGreaterThan(1);
    expect(e.ready(['heavy', 'pm1'], 30)).toBe(true);
    expect(e.termsOf('uniform')).toBe(0); // not asked for, not grown
    const whole = new CltEnsemble(S, 1, 0.5);
    whole.advanceTo(30, ['heavy', 'pm1'], 1e9);
    expect(Array.from(e.standardised('heavy'))).toEqual(Array.from(whole.standardised('heavy')));
  });

  it('restarts only the correlated chain when the persistence changes', () => {
    const e = new CltEnsemble(S, 2, 0.5);
    e.advanceTo(20, CLT_DISTS, 1e9);
    const before = Array.from(e.standardised('pm1'));
    e.setPersistence(0.9);
    expect(e.termsOf('correlated')).toBe(0);
    expect(e.termsOf('pm1')).toBe(20);
    expect(Array.from(e.standardised('pm1'))).toEqual(before);
    e.advanceTo(20, CLT_DISTS, 1e9);
    const direct = new CltEnsemble(S, 2, 0.9);
    direct.advanceTo(20, ['correlated'], 1e9);
    expect(Array.from(e.standardised('correlated'))).toEqual(Array.from(direct.standardised('correlated')));
    expect(() => new CltEnsemble(S, 2, 0.5).standardised('pm1')).toThrow();
  });
});

describe('the distance from the Gaussian', () => {
  const S = 4000;
  it('falls for the independent walks and stalls for the correlated one, as the figure reads out', () => {
    const e = new CltEnsemble(S, 1, 0.9);
    const at = (n: number) => {
      e.advanceTo(n, CLT_DISTS, 1e9);
      return Object.fromEntries(CLT_DISTS.map((d) => [d, measure(e.standardised(d))])) as Record<CltDist, ReturnType<typeof measure>>;
    };
    const one = at(1);
    const big = at(256);
    for (const d of ['pm1', 'uniform', 'heavy'] as const) {
      expect(big[d].ks).toBeLessThan(one[d].ks);
      expect(big[d].ks).toBeLessThan(0.05);
      expect(Math.abs(big[d].varianceRatio - 1)).toBeLessThan(0.15);
    }
    expect(big.correlated.ks).toBeGreaterThan(0.3);
    const ratio = big.correlated.varianceRatio / expectedVarianceRatio('correlated', 256, 0.9);
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });

  it('expects 1 for the independent walks and the exact finite-n factor for the correlated one', () => {
    expect(expectedVarianceRatio('heavy', 50, 0.9)).toBe(1);
    expect(expectedVarianceRatio('correlated', 50, 0.5)).toBe(correlatedVarianceFactor(0.5, 50));
  });
});

describe('the density polyline', () => {
  it('has unit area over the span, and no empty bin across the core for the ±1 walk on its lattice', () => {
    const e = new CltEnsemble(4000, 1, 0.5);
    for (const n of [1, 4, 64, 250]) {
      e.advanceTo(n, ['pm1', 'uniform', 'correlated'], 1e9);
      for (const d of ['pm1', 'uniform', 'correlated'] as const) {
        const { x, y } = standardisedDensity(e.standardised(d), d, n);
        const w = x[1] - x[0];
        const area = y.reduce((a, v) => a + v * w, 0);
        // the density is normalised to the sums inside the span
        expect(area).toBeCloseTo(1, 8);
        if (d === 'pm1' && n >= 4) for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) < 1) expect(y[i]).toBeGreaterThan(0);
      }
    }
  });
});

describe('the binomial frame', () => {
  it('frames about 4.5 sigma either side of np, inside 0 to n, with the exact pmf and its error', () => {
    const f = binomialFrame(100, 0.5);
    expect(f.mean).toBe(50);
    expect(f.sigma).toBe(5);
    expect(f.kLo).toBe(27);
    expect(f.kHi).toBe(73);
    expect(f.pmf.length).toBe(101);
    expect(f.error.maxAbsScaled).toBeCloseTo(0.0009960934655609682, 9);
    const small = binomialFrame(3, 0.5);
    expect(small.kLo).toBe(0);
    expect(small.kHi).toBe(3);
    expect(binomialFrame(100, 0.6).mean).toBeCloseTo(60, 12);
  });

  it('has a strip that is tiny in absolute terms and large in relative terms out in the tails', () => {
    const f = binomialFrame(100, 0.5);
    const abs = errorStrip(f, false);
    const rel = errorStrip(f, true);
    expect(Math.max(...abs.map(Math.abs))).toBeCloseTo(f.error.maxAbsScaled, 14);
    expect(Math.max(...abs.map(Math.abs))).toBeLessThan(0.002);
    expect(Math.abs(rel[50])).toBeLessThan(0.005);
    expect(Math.abs(rel[65])).toBeCloseTo(0.026062243426559, 6);
    expect(Math.max(...rel.map(Math.abs))).toBe(1); // far tails: clipped
  });
});

describe('the lattice floor of the distance', () => {
  it('is half the central binomial probability: 0.25 at n = 1, about 0.4/sqrt(n) later, and what a coin sum cannot get under', () => {
    expect(latticeFloor(1)).toBe(0.25);
    expect(latticeFloor(2)).toBeCloseTo(0.25, 14);
    expect(latticeFloor(100)).toBeCloseTo(0.5 * 0.07958923738717436, 12);
    expect(latticeFloor(400) * Math.sqrt(400)).toBeCloseTo(0.3989, 3);
    const e = new CltEnsemble(20000, 1, 0.5);
    e.advanceTo(64, ['pm1', 'uniform'], 1e9);
    const coin = measure(e.standardised('pm1')).ks;
    expect(coin).toBeGreaterThan(latticeFloor(64) * 0.95);
    expect(coin).toBeLessThan(latticeFloor(64) + 0.015);
    // the uniform sum has no lattice: its distance is the sampling floor
    expect(measure(e.standardised('uniform')).ks).toBeLessThan(0.015);
  });
});
