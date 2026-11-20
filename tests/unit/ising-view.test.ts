import { describe, expect, it } from 'vitest';
import { ladder, niceMax, peakOf } from '../../src/sims/core/ising-view';

describe('niceMax: an axis that grows in 1-2-5 steps', () => {
  it('never shrinks below its floor and always covers the value', () => {
    expect(niceMax(0)).toBe(100);
    expect(niceMax(99)).toBe(100);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(101)).toBe(200);
    expect(niceMax(201)).toBe(500);
    expect(niceMax(501)).toBe(1000);
    expect(niceMax(12000)).toBe(20000);
    expect(niceMax(0.3, 0.1)).toBe(0.5);
  });
  it('is monotone', () => {
    let last = 0;
    for (let v = 0; v < 30000; v += 37) {
      const m = niceMax(v);
      expect(m).toBeGreaterThanOrEqual(v);
      expect(m).toBeGreaterThanOrEqual(last);
      last = m;
    }
  });
});

describe('ladder', () => {
  it('runs from hot to cold in exact steps', () => {
    const l = ladder(3.5, 1.5, 0.05);
    expect(l.length).toBe(41);
    expect(l[0]).toBe(3.5);
    expect(l[40]).toBe(1.5);
    expect(l[1]).toBe(3.45);
  });
});

describe('peakOf', () => {
  it('finds a peak between grid points whatever the order of the ladder', () => {
    const T = [3, 2.5, 2, 1.5];
    const y = T.map((t) => 10 - (t - 2.2) ** 2);
    const p = peakOf(T, y)!;
    expect(p.T).toBeCloseTo(2.2, 12);
    expect(p.y).toBeCloseTo(10, 12);
  });
  it('needs three points', () => {
    expect(peakOf([1, 2], [1, 2])).toBeNull();
  });
});
