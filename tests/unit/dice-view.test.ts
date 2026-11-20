import { describe, expect, it } from 'vitest';
import { uniform } from '../../src/physics/kinetics';
import { sampleAverages, sampleSums } from '../../src/physics/sampling';
import { latticeHistogram, nFromSlider, N_MAX, plotIndices, sliderFromN } from '../../src/sims/core/dice-view';

describe('plotIndices', () => {
  it('is sorted, unique, inside [1, n] and contains both ends', () => {
    for (const n of [1, 2, 100, 1000, 100000]) {
      const idx = plotIndices(n);
      expect(idx[0]).toBe(1);
      expect(idx[idx.length - 1]).toBe(n);
      for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
      expect(idx.every(Number.isInteger)).toBe(true);
    }
  });
  it('keeps the early rolls dense and the long run bounded', () => {
    const idx = plotIndices(100000);
    expect(idx.slice(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(idx.length).toBeLessThan(1000);
    for (let i = 1; i < idx.length; i++) expect(idx[i] - idx[i - 1]).toBeLessThanOrEqual(100000 / 400 + 1);
  });
});

describe('the N slider', () => {
  it('runs from 1 to 10 000 on a log scale and inverts', () => {
    expect(nFromSlider(0)).toBe(1);
    expect(nFromSlider(1)).toBe(N_MAX);
    expect(nFromSlider(0.5)).toBe(100);
    expect(nFromSlider(-1)).toBe(1);
    expect(nFromSlider(2)).toBe(N_MAX);
    for (const n of [1, 4, 100, 1024, 10000]) expect(nFromSlider(sliderFromN(n))).toBe(n);
  });
});

describe('latticeHistogram', () => {
  it('counts every value of a lattice exactly once when the range covers them', () => {
    const sums = sampleSums(20, 3000, uniform(2));
    const h = latticeHistogram(sums, 20, 120, 1);
    expect(h.counts.reduce((a, c) => a + c, 0)).toBe(3000);
    expect(h.width).toBe(2); // 100 sites wide, 60 bins at most: 2 sites per bin
  });
  it('puts one site in each bin when the lattice is coarse', () => {
    const avgs = sampleAverages(1, 6000, uniform(3)); // faces 1 to 6
    const h = latticeHistogram(avgs, 0.5, 6.5, 1);
    expect(h.width).toBe(1);
    expect(h.counts.length).toBe(6);
    for (const c of h.counts) expect(Math.abs(c / 1000 - 1)).toBeLessThan(0.15);
    expect(h.start).toBeCloseTo(0.5, 12);
  });
  it('does not alternate tall and short on an average lattice 1/N wide', () => {
    const avgs = sampleAverages(10, 30000, uniform(4));
    const h = latticeHistogram(avgs, 1, 6, 0.1, 60);
    const peak = h.counts.indexOf(Math.max(...h.counts));
    expect(Math.abs(h.counts[peak] - h.counts[peak + 1]) / h.counts[peak]).toBeLessThan(0.15);
  });
  it('ignores values outside the range', () => {
    const h = latticeHistogram([0, 5, 100], 4, 6, 1);
    expect(h.counts.reduce((a, c) => a + c, 0)).toBe(1);
  });
});
