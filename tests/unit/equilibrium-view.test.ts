import { describe, expect, it } from 'vitest';
import {
  Trace,
  blockLayout,
  cleanCount,
  cleanNumber,
  logOfN,
  logRange,
  nFromLog,
  panelPairs,
  runLength,
  runPanel,
  shadeOf,
  stepsPerFrame,
  successiveRatios,
  thinIndices,
} from '../../src/sims/core/equilibrium-view';
import { fromTemperatures, totalQuanta } from '../../src/physics/equilibrium';

describe('the size slider', () => {
  it('runs from 10 to 2000 on a log scale and inverts', () => {
    expect(nFromLog(logOfN(10))).toBe(10);
    expect(nFromLog(logOfN(2000))).toBe(2000);
    expect(nFromLog(2)).toBe(100);
    expect(nFromLog(-3)).toBe(10);
    expect(nFromLog(9)).toBe(2000);
    for (const n of [10, 37, 100, 300, 1024, 2000]) expect(nFromLog(logOfN(n))).toBe(n);
  });
});

describe('prop cleaning', () => {
  it('clamps numbers and falls back for anything else', () => {
    expect(cleanNumber(99, 0.5, 10, 4)).toBe(10);
    expect(cleanNumber('x', 0.5, 10, 4)).toBe(4);
    expect(cleanNumber(NaN, 0.5, 10, 4)).toBe(4);
    expect(cleanCount(12.6, 10, 2000, 100)).toBe(13);
    expect(cleanCount(undefined, 10, 2000, 100)).toBe(100);
  });
});

describe('runLength', () => {
  it('is six times the quanta by default and the prop when it is usable', () => {
    const s = fromTemperatures(100, 300, 4, 1);
    expect(runLength(s)).toBe(6 * totalQuanta(s));
    expect(runLength(s, 1000.4)).toBe(1000);
    expect(runLength(s, 0)).toBe(6 * totalQuanta(s));
    expect(runLength(s, 'x')).toBe(6 * totalQuanta(s));
    expect(runLength(s, 1e12)).toBe(1_000_000);
  });
  it('takes a run about 420 frames', () => {
    expect(stepsPerFrame(4200)).toBe(10);
    expect(stepsPerFrame(5)).toBe(1);
    expect(Math.ceil(1_000_000 / stepsPerFrame(1_000_000))).toBeLessThanOrEqual(420);
  });
});

describe('blockLayout', () => {
  it('holds every oscillator inside the box with one square cell for both bodies', () => {
    for (const [nA, nB, w, h] of [[100, 300, 280, 300], [10, 2000, 340, 120], [2000, 2000, 700, 300], [10, 10, 100, 400]] as const) {
      const l = blockLayout(nA, nB, w, h, 10);
      expect(l.cell).toBeGreaterThan(0);
      expect(l.colsA * l.rows).toBeGreaterThanOrEqual(nA);
      expect(l.colsB * l.rows).toBeGreaterThanOrEqual(nB);
      expect((l.colsA + l.colsB) * l.cell + 10).toBeLessThanOrEqual(w + 1e-9);
      expect(l.rows * l.cell).toBeLessThanOrEqual(h + 1e-9);
    }
  });
  it('keeps the areas in proportion to the sizes, up to a column', () => {
    const l = blockLayout(100, 300, 280, 300, 10);
    expect(l.colsB / l.colsA).toBeGreaterThan(2.5);
    expect(l.colsB / l.colsA).toBeLessThan(3.5);
  });
});

describe('shadeOf', () => {
  it('rises from 0 to 1 and saturates', () => {
    expect(shadeOf(0, 8)).toBe(0);
    expect(shadeOf(4, 8)).toBe(0.5);
    expect(shadeOf(20, 8)).toBe(1);
  });
});

describe('Trace', () => {
  it('keeps the first point, thins past its limit, and stays aligned across series', () => {
    const t = new Trace(100, 2);
    for (let n = 0; n <= 5000; n++) t.push(n, n * 2, n * 3);
    expect(t.xs[0]).toBe(0);
    expect(t.xs.length).toBeLessThanOrEqual(101);
    expect(t.stride).toBeGreaterThan(1);
    t.xs.forEach((x, i) => {
      expect(t.series[0][i]).toBe(2 * x);
      expect(t.series[1][i]).toBe(3 * x);
    });
    for (let i = 1; i < t.xs.length; i++) expect(t.xs[i] - t.xs[i - 1]).toBe(i === 1 ? t.xs[1] : t.stride);
  });
});

describe('logRange', () => {
  it('spans whole decades and always at least one', () => {
    expect(logRange(0.0123, 3)).toEqual({ min: 0.01, max: 10 });
    expect(logRange(0.5, 0.9)).toEqual({ min: 0.1, max: 1 });
    expect(logRange(1, 1)).toEqual({ min: 1, max: 10 });
  });
});

describe('the panels of the scale figure', () => {
  it('grow by the factor with nB = ratio nA', () => {
    const p = panelPairs(20, 10, 3, 4, 1);
    expect(p.map((q) => q.nA)).toEqual([20, 200, 2000]);
    expect(p.map((q) => q.nB)).toEqual([60, 600, 6000]);
    expect(p[0].tau).toBeCloseTo(p[0].state.qA + p[0].state.qB - 0.5, 1);
  });
  it('thins a run to at most about maxPoints and keeps its last step', () => {
    const idx = thinIndices(10000, 480);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(9999);
    expect(idx.length).toBeLessThanOrEqual(482);
    expect(thinIndices(5, 480)).toEqual([0, 1, 2, 3, 4]);
  });
  it('runs a panel for 6 τ in units of τ, starting near 1 and ending near 0, deterministically', () => {
    const [p] = panelPairs(20, 10, 3, 4, 1);
    const a = runPanel(p, 5, 4);
    const b = runPanel(p, 5, 4);
    expect(a).toEqual(b);
    expect(a.x[a.x.length - 1]).toBeCloseTo(Math.round(6 * p.tau) / p.tau, 12);
    expect(Math.abs(a.gap[0] - 1)).toBeLessThan(0.3);
    expect(Math.abs(a.gap[a.gap.length - 1])).toBeLessThan(0.5);
    expect(a.rms).toBeGreaterThan(0);
    expect(runPanel(p, 6, 4).gap).not.toEqual(a.gap);
  });
  it('shows the N^(−1/2) law in the averaged RMS: √factor between successive panels, within 15 %', () => {
    const means = panelPairs(20, 10, 3, 4, 1).map((p) => runPanel(p, 3, 16).rmsMean);
    for (const r of successiveRatios(means)) expect(Math.abs(r / Math.sqrt(10) - 1)).toBeLessThan(0.15);
  });
  it('divides successive values', () => {
    expect(successiveRatios([8, 4, 1])).toEqual([2, 4]);
  });
});
