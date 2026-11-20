import { describe, expect, it } from 'vitest';
import { uniform } from '../../src/physics/kinetics';
import { randomWalk, stepDistribution, STEP_NAMES, walkerSpread } from '../../src/physics/sampling';
import {
  cleanCount,
  cleanStep,
  drawIndices,
  latticeOf,
  positionSpan,
  sliderFromWalkers,
  stepChunk,
  taskTime,
  walkersFromSlider,
  WalkerEnsemble,
  walkRate,
} from '../../src/sims/core/walker-view';

describe('the walkers slider', () => {
  it('runs from 100 to 10 000 on a log scale, in tidy numbers, and inverts', () => {
    expect(walkersFromSlider(0)).toBe(100);
    expect(walkersFromSlider(1)).toBe(10000);
    expect(walkersFromSlider(0.5)).toBe(1000);
    expect(walkersFromSlider(-3)).toBe(100);
    expect(walkersFromSlider(9)).toBe(10000);
    for (const n of [100, 400, 1000, 4000, 10000]) expect(walkersFromSlider(sliderFromWalkers(n))).toBe(n);
    expect(walkersFromSlider(0.3)).toBe(Math.round(walkersFromSlider(0.3) / 10) * 10);
  });
});

describe('what comes from outside', () => {
  it('is cleaned to a legal count or name, or the default', () => {
    expect(cleanCount(50, 100, 10000, 4000)).toBe(100);
    expect(cleanCount(1e9, 100, 10000, 4000)).toBe(10000);
    expect(cleanCount(399.6, 10, 2000, 400)).toBe(400);
    expect(cleanCount('3', 10, 2000, 400)).toBe(400);
    expect(cleanCount(NaN, 10, 2000, 400)).toBe(400);
    expect(cleanStep('heavy', 'pm1')).toBe('heavy');
    expect(cleanStep('cauchy', 'pm1')).toBe('pm1');
    expect(cleanStep(undefined, 'biased')).toBe('biased');
  });
});

describe('the pace of a run', () => {
  it('takes about ten seconds, between 12 and 200 steps a second; a Step is a fortieth of the run', () => {
    expect(walkRate(400)).toBe(40);
    expect(walkRate(10)).toBe(12);
    expect(walkRate(2000)).toBe(200);
    expect(walkRate(100000)).toBe(200);
    expect(stepChunk(400)).toBe(10);
    expect(stepChunk(10)).toBe(1);
    expect(stepChunk(2000)).toBe(50);
    expect(taskTime(400)).toBe(200);
    expect(taskTime(100)).toBe(100);
  });
});

describe('the position axis', () => {
  it('is mu_1 T +- 3.6 sigma_1 sqrt(T) and always holds the origin', () => {
    expect(positionSpan(stepDistribution('pm1'), 400)).toEqual([-72, 72]);
    const [lo, hi] = positionSpan(stepDistribution('biased'), 400);
    expect(lo).toBeCloseTo(-3.6 * Math.sqrt(0.96) * 20, 10);
    expect(hi).toBeCloseTo(80 + 3.6 * Math.sqrt(0.96) * 20, 10);
    for (const name of STEP_NAMES) {
      const [a, b] = positionSpan(stepDistribution(name), 50);
      expect(a).toBeLessThan(0);
      expect(b).toBeGreaterThan(0);
    }
  });
  it('has a lattice only for the ±1 steps', () => {
    expect(STEP_NAMES.map((n) => latticeOf(stepDistribution(n)))).toEqual([2, 2, undefined, undefined]);
  });
});

describe('the walker ensemble', () => {
  it('is randomWalk advanced a step at a time: the same numbers, for every step distribution', () => {
    const W = 300;
    const T = 60;
    for (const name of STEP_NAMES) {
      const e = new WalkerEnsemble(W, T, name, 5);
      const x = randomWalk(W, T, uniform(5 * 100003 + 17), name);
      e.advance(7);
      e.advance(30);
      e.advance(100);
      expect(e.t).toBe(T);
      expect(e.done).toBe(true);
      for (let w = 0; w < W; w++) expect(e.pos[w]).toBe(x[w * (T + 1) + T]);
      for (let w = 0; w < e.nPaths; w++) for (let t = 0; t <= T; t++) expect(e.paths[w * (T + 1) + t]).toBe(x[w * (T + 1) + t]);
      const sp = walkerSpread(x, W);
      for (let t = 0; t <= T; t++) expect(e.spread[t]).toBeCloseTo(sp[t], 10);
      let m = 0;
      for (let w = 0; w < W; w++) m += x[w * (T + 1) + T];
      expect(e.mean[T]).toBeCloseTo(m / W, 10);
    }
  });

  it('takes no more than the run has left, never a negative or fractional number of steps, and starts at the origin', () => {
    const e = new WalkerEnsemble(100, 20, 'pm1', 1);
    expect(e.t).toBe(0);
    expect(e.pos.every((v) => v === 0)).toBe(true);
    expect(e.spread[0]).toBe(0);
    expect(e.advance(-4)).toBe(0);
    expect(e.advance(2.9)).toBe(2);
    expect(e.advance(1000)).toBe(18);
    expect(e.advance(1)).toBe(0);
    expect(e.t).toBe(20);
  });

  it('keeps at most 120 paths and fewer for fewer walkers; walker 0 is the highlighted one', () => {
    expect(new WalkerEnsemble(10000, 10, 'pm1', 1).nPaths).toBe(120);
    expect(new WalkerEnsemble(100, 10, 'pm1', 1).nPaths).toBe(100);
    expect(new WalkerEnsemble(5, 10, 'pm1', 1).nPaths).toBe(5);
    expect(() => new WalkerEnsemble(1, 10, 'pm1', 1)).toThrow();
  });

  it('differs between seeds and repeats for the same seed', () => {
    const run = (seed: number) => {
      const e = new WalkerEnsemble(200, 30, 'heavy', seed);
      e.advance(30);
      return Array.from(e.pos);
    };
    expect(run(2)).toEqual(run(2));
    expect(run(2)).not.toEqual(run(3));
  });

  it('measures its spread against sigma_1 sqrt(t) and its mean against mu_1 t within sampling error, for every distribution', () => {
    const W = 4000;
    const T = 100;
    for (const name of STEP_NAMES) {
      const d = stepDistribution(name);
      for (const seed of [1, 2, 3, 4]) {
        const e = new WalkerEnsemble(W, T, d, seed);
        e.advance(T);
        expect(Math.abs(e.spread[T] / (d.std * 10) - 1)).toBeLessThan(0.08);
        expect(Math.abs(e.mean[T] - d.mean * T)).toBeLessThan((5 * d.std * 10) / Math.sqrt(W));
        expect(e.standardError).toBeCloseTo(e.spread[T] / Math.sqrt(W), 12);
      }
    }
  });

  it("bins the cloud on the run's fixed span, with unit area and no empty bin across the core of a ±1 cloud", () => {
    const e = new WalkerEnsemble(4000, 400, 'pm1', 1);
    e.advance(101);
    const h = e.histogram();
    expect(h.density.reduce((a, d) => a + d * h.width, 0)).toBeCloseTo(1, 10);
    expect(h.width % 2).toBe(0); // a whole number of lattice sites
    for (let b = 0; b < h.centres.length; b++) if (Math.abs(h.centres[b]) < 10) expect(h.density[b]).toBeGreaterThan(0);
    // the same bins at another time: the width does not follow the cloud
    e.advance(100);
    expect(e.histogram().width).toBe(h.width);
  });
});

describe('drawIndices', () => {
  it('is sorted, includes 0 and t, and thins a long path to about 300 points', () => {
    expect(drawIndices(0)).toEqual([0]);
    expect(drawIndices(5)).toEqual([0, 1, 2, 3, 4, 5]);
    const idx = drawIndices(2000);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(2000);
    expect(idx.length).toBeLessThanOrEqual(302);
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
  });
});
