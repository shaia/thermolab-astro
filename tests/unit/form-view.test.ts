import { describe, expect, it } from 'vitest';
import { cumulativeLineIntegral, FORMS, pathPoints } from '../../src/physics/forms';
import { arclength, exactnessReadout, fieldArrows, formIsExact, locate, pointAlong } from '../../src/sims/core/form-view';

describe('arclength and pointAlong', () => {
  const p = pathPoints('a', 100);
  const cum = arclength(p.x, p.y);
  it('measures path a as two unit legs', () => {
    expect(cum[0]).toBe(0);
    expect(cum[cum.length - 1]).toBeCloseTo(2, 12);
  });
  it('finds the corner halfway, and the ends at 0 and 1', () => {
    const mid = pointAlong(p.x, p.y, cum, 0.5);
    expect(mid.x).toBeCloseTo(2, 12);
    expect(mid.y).toBeCloseTo(1, 12);
    const a = pointAlong(p.x, p.y, cum, 0);
    expect([a.x, a.y]).toEqual([1, 1]);
    const b = pointAlong(p.x, p.y, cum, 1);
    expect([b.x, b.y]).toEqual([2, 2]);
  });
  it('clamps outside [0, 1] and interpolates inside a segment', () => {
    expect(pointAlong(p.x, p.y, cum, -3).x).toBe(1);
    expect(pointAlong(p.x, p.y, cum, 7).y).toBe(2);
    const q = pointAlong(p.x, p.y, cum, 0.25);
    expect(q.x).toBeCloseTo(1.5, 12);
    expect(q.y).toBe(1);
  });
  it('locates the last point at or before the fraction', () => {
    const { i, f } = locate(cum, 0.5);
    expect(i).toBeGreaterThan(0);
    expect(f).toBeGreaterThanOrEqual(0);
    expect(f).toBeLessThanOrEqual(1);
  });
});

describe('the accumulated integral at a traced point', () => {
  it('is the integral up to the corner at s = 1/2 and of the whole path at s = 1', () => {
    const f = FORMS.heat;
    const p = pathPoints('a', 1000);
    const c = cumulativeLineIntegral(f.m, f.n, p.x, p.y);
    const cum = arclength(p.x, p.y);
    expect(c[locate(cum, 0.5).i]).toBeCloseTo(Math.LN2, 6);
    expect(c[c.length - 1]).toBeCloseTo(1.5 + Math.LN2, 6);
  });
});

describe('the direction field', () => {
  it('has unit arrows, all horizontal for y dx', () => {
    const a = fieldArrows('inexact', 6, 6);
    expect(a.length).toBe(36);
    for (const r of a) {
      expect(Math.hypot(r.ux, r.uy)).toBeCloseTo(1, 12);
      expect(r.uy).toBe(0);
    }
  });
  it('points along (y, x) for the exact form', () => {
    const [r] = fieldArrows('exact', 1, 1, 1, 3); // the point (2, 2)
    expect(r.ux).toBeCloseTo(Math.SQRT1_2, 12);
    expect(r.uy).toBeCloseTo(Math.SQRT1_2, 12);
  });
});

describe('exactness readout', () => {
  it('is exact for the exact and entropy forms, not for the others, with the partials at the point', () => {
    expect(formIsExact('exact')).toBe(true);
    expect(formIsExact('entropy')).toBe(true);
    expect(formIsExact('inexact')).toBe(false);
    expect(formIsExact('heat')).toBe(false);
    const h = exactnessReadout('heat', 1.5, 1.5);
    expect(h.dMdy).toBeCloseTo(1 / 1.5, 8);
    expect(h.dNdx).toBeCloseTo(0, 8);
    expect(h.exact).toBe(false);
    const e = exactnessReadout('entropy', 1.5, 1.5);
    expect(e.dMdy).toBeCloseTo(0, 8);
    expect(e.dNdx).toBeCloseTo(0, 8);
  });
});
