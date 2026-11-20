/**
 * Pure helpers for the FormPaths figure: where a point a given fraction of the way along a path is, the
 * direction field to draw, and the readout numbers. Unit-tested in tests/unit/form-view.test.ts.
 */

import { FORMS, isExact, mixedPartials, type FormName } from '~/physics/forms';

/** Cumulative arclength along a polyline, 0 at its first point. */
export function arclength(x: ArrayLike<number>, y: ArrayLike<number>): Float64Array {
  const out = new Float64Array(x.length);
  for (let i = 1; i < x.length; i++) out[i] = out[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]);
  return out;
}

/** The index of the last point at or before the fraction `s` ∈ [0, 1] of the path's length, and the position within the next segment. */
export function locate(cum: ArrayLike<number>, s: number): { i: number; f: number } {
  const total = cum[cum.length - 1];
  const target = Math.min(1, Math.max(0, s)) * total;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= target) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo];
  return { i: lo, f: seg > 0 ? Math.min(1, (target - cum[lo]) / seg) : 0 };
}

/** The point a fraction `s` of the way along the polyline, by arclength. */
export function pointAlong(x: ArrayLike<number>, y: ArrayLike<number>, cum: ArrayLike<number>, s: number): { x: number; y: number; i: number } {
  const { i, f } = locate(cum, s);
  const j = Math.min(i + 1, x.length - 1);
  return { x: x[i] + (x[j] - x[i]) * f, y: y[i] + (y[j] - y[i]) * f, i };
}

export interface FormMeta {
  /** axis titles; the plane is (V, T) for the thermodynamic forms */
  xLabel: string;
  yLabel: string;
}

export const FORM_META: Record<FormName, FormMeta> = {
  exact: { xLabel: 'x', yLabel: 'y' },
  inexact: { xLabel: 'x', yLabel: 'y' },
  heat: { xLabel: 'V', yLabel: 'T' },
  entropy: { xLabel: 'V', yLabel: 'T' },
};

export interface Arrow {
  x: number;
  y: number;
  /** unit direction of (M, N) in the plane; zero where the field vanishes */
  ux: number;
  uy: number;
}

/** A `cols` × `rows` grid of unit direction arrows of the field (M, N) over [lo, hi]². */
export function fieldArrows(form: FormName, cols: number, rows: number, lo = 0.5, hi = 2.5): Arrow[] {
  const { m, n } = FORMS[form];
  const out: Arrow[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = lo + ((hi - lo) * (c + 0.5)) / cols;
      const y = lo + ((hi - lo) * (r + 0.5)) / rows;
      const M = m(x, y);
      const N = n(x, y);
      const L = Math.hypot(M, N);
      out.push({ x, y, ux: L > 0 ? M / L : 0, uy: L > 0 ? N / L : 0 });
    }
  }
  return out;
}

const GRID = (() => {
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i <= 20; i++)
    for (let j = 0; j <= 20; j++) {
      x.push(0.5 + i / 10);
      y.push(0.5 + j / 10);
    }
  return { x, y };
})();

/** Whether the mixed partials agree everywhere on the plane drawn, [0.5, 2.5]². */
export function formIsExact(form: FormName): boolean {
  return isExact(FORMS[form].m, FORMS[form].n, GRID.x, GRID.y);
}

/** ∂M/∂y and ∂N/∂x at a point, and the verdict for the whole form. */
export function exactnessReadout(form: FormName, x: number, y: number): { dMdy: number; dNdx: number; exact: boolean } {
  const { m, n } = FORMS[form];
  return { ...mixedPartials(m, n, x, y), exact: formIsExact(form) };
}
