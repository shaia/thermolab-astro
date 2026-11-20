/**
 * Differential forms in the plane: when does an integral depend on the path? A port of `thermolab.forms`
 * (line_integral, mixed_partials_gap, is_exact), plus the four forms and three paths of lesson 0.1's
 * figure. Pure mathematics: no gas, no units, nothing modelled. Tests: tests/physics/forms.test.ts.
 *
 * A form M dx + N dy is exact when it is the total differential of a potential, which happens exactly when
 * ∂M/∂y = ∂N/∂x. The integral of an exact form depends only on the endpoints.
 */

export type Field = (x: number, y: number) => number;

/** The integral from the start of the polyline up to each of its points (0 at the first); trapezoid rule on each segment. */
export function cumulativeLineIntegral(m: Field, n: Field, x: ArrayLike<number>, y: ArrayLike<number>): Float64Array {
  if (x.length !== y.length) throw new RangeError('x and y must describe the same points');
  if (x.length < 2) throw new RangeError('a path needs at least two points');
  const out = new Float64Array(x.length);
  let prevM = m(x[0], y[0]);
  let prevN = n(x[0], y[0]);
  for (let i = 1; i < x.length; i++) {
    const mi = m(x[i], y[i]);
    const ni = n(x[i], y[i]);
    out[i] = out[i - 1] + 0.5 * (prevM + mi) * (x[i] - x[i - 1]) + 0.5 * (prevN + ni) * (y[i] - y[i - 1]);
    prevM = mi;
    prevN = ni;
  }
  return out;
}

/** Integrate M dx + N dy along the polyline through (x, y). */
export function lineIntegral(m: Field, n: Field, x: ArrayLike<number>, y: ArrayLike<number>): number {
  const c = cumulativeLineIntegral(m, n, x, y);
  return c[c.length - 1];
}

/** ∂M/∂y and ∂N/∂x at one point, by central differences. */
export function mixedPartials(m: Field, n: Field, x: number, y: number, h = 1e-5): { dMdy: number; dNdx: number } {
  if (!(h > 0)) throw new RangeError('h must be positive');
  return {
    dMdy: (m(x, y + h) - m(x, y - h)) / (2 * h),
    dNdx: (n(x + h, y) - n(x - h, y)) / (2 * h),
  };
}

/** The exactness test ∂M/∂y − ∂N/∂x at each sampled point. */
export function mixedPartialsGap(m: Field, n: Field, x: ArrayLike<number>, y: ArrayLike<number>, h = 1e-5): Float64Array {
  if (x.length !== y.length) throw new RangeError('x and y must describe the same points');
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const p = mixedPartials(m, n, x[i], y[i], h);
    out[i] = p.dMdy - p.dNdx;
  }
  return out;
}

/** True when the gap is negligible at every sampled point (the verdict covers only the points given). */
export function isExact(m: Field, n: Field, x: ArrayLike<number>, y: ArrayLike<number>, tolerance = 1e-6): boolean {
  return mixedPartialsGap(m, n, x, y).every((v) => Math.abs(v) <= tolerance);
}

/* ------------------------------------------------------------------ the four forms */

export type FormName = 'exact' | 'inexact' | 'heat' | 'entropy';
export type PathName = 'a' | 'b' | 'c' | 'loop';

export interface Form {
  m: Field;
  n: Field;
  /** the integral from A to B along path a, b or c, in closed form (tests and the figure check against it) */
  closedForm: { a: number; b: number; c: number };
}

/** In units with N k_B = 1 (an ideal monatomic gas); the plane is (x, y) = (V, T) for 'heat' and 'entropy'. */
export const FORMS: Record<FormName, Form> = {
  // y dx + x dy = d(xy)
  exact: { m: (_x, y) => y, n: (x) => x, closedForm: { a: 3, b: 3, c: 3 } },
  // y dx
  inexact: { m: (_x, y) => y, n: () => 0, closedForm: { a: 1, b: 2, c: 1.5 } },
  // δQ = (3/2) dT + (T/V) dV
  heat: {
    m: (x, y) => y / x,
    n: () => 1.5,
    closedForm: { a: 1.5 + Math.LN2, b: 1.5 + 2 * Math.LN2, c: 2.5 },
  },
  // δQ / T = (3/2) dT/T + dV/V = dS
  entropy: {
    m: (x) => 1 / x,
    n: (_x, y) => 1.5 / y,
    closedForm: { a: 2.5 * Math.LN2, b: 2.5 * Math.LN2, c: 2.5 * Math.LN2 },
  },
};

/**
 * A polyline from A = (1, 1) to B = (2, 2), `perLeg` segments on each straight leg.
 * a: x first, then y. b: y first, then x. c: the straight line. loop: a out, then b back.
 */
export function pathPoints(path: PathName, perLeg = 2000): { x: Float64Array; y: Float64Array } {
  const xs: number[] = [];
  const ys: number[] = [];
  const leg = (x0: number, y0: number, x1: number, y1: number) => {
    for (let i = xs.length === 0 ? 0 : 1; i <= perLeg; i++) {
      const t = i / perLeg;
      xs.push(x0 + (x1 - x0) * t);
      ys.push(y0 + (y1 - y0) * t);
    }
  };
  if (path === 'a') {
    leg(1, 1, 2, 1);
    leg(2, 1, 2, 2);
  } else if (path === 'b') {
    leg(1, 1, 1, 2);
    leg(1, 2, 2, 2);
  } else if (path === 'c') {
    leg(1, 1, 2, 2);
  } else {
    leg(1, 1, 2, 1);
    leg(2, 1, 2, 2);
    leg(2, 2, 1, 2);
    leg(1, 2, 1, 1);
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys) };
}

/** The line integral of a named form along a named path (the loop is a − b). */
export function formIntegral(form: FormName, path: PathName, perLeg = 2000): number {
  const f = FORMS[form];
  const p = pathPoints(path, perLeg);
  return lineIntegral(f.m, f.n, p.x, p.y);
}
