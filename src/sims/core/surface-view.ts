/**
 * Pure helpers for the PvtSurface figure (lesson 2.1, fig-2-1a): the van der Waals surface in (v_r, T_r, P_r) on a 2D
 * canvas. A projection with drag-to-rotate angles, the clipping of the surface to a pressure window, the cells where
 * ∂P/∂v > 0 (the fold), the three back walls with the shadows of a state point, and the three legs the point travels.
 * No canvas in here; unit-tested in tests/unit/surface-view.test.ts.
 *
 * The surface lives in a box. Its axes: x is v_r, y is T_r (into the page at the default view) and z is P_r (up). Every
 * coordinate is mapped to [−h, h] along its axis with half-extents HALF, so the box is slightly wider than deep.
 * The projection is orthographic: rotate about the vertical axis by the azimuth, then tilt by the elevation.
 */

import { dPdvReduced, morphedPressureReduced } from '~/physics/gases';

export type Vec3 = [number, number, number];

/** the ranges drawn: v_r, T_r and the pressure window P_r the surface is clipped to */
export const V_RANGE = [0.4, 5] as const;
export const T_RANGE = [0.8, 1.6] as const;
export const P_RANGE = [-0.5, 2.5] as const;
/** half-extents of the box along x, y, z */
export const HALF: Vec3 = [1.2, 0.9, 0.8];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const toUnit = (x: number, r: readonly [number, number]) => (2 * (x - r[0])) / (r[1] - r[0]) - 1;

/** (v_r, T_r, P_r) to box coordinates; P_r outside the window lands outside the box in z */
export const toBox = (v: number, t: number, p: number): Vec3 => [toUnit(v, V_RANGE) * HALF[0], toUnit(t, T_RANGE) * HALF[1], toUnit(p, P_RANGE) * HALF[2]];

export interface ViewAngles {
  /** degrees, rotation about the vertical axis */
  azimuth: number;
  /** degrees, 0 looks along the T axis from the side, 90 looks straight down */
  elevation: number;
}

export const DEFAULT_VIEW: ViewAngles = { azimuth: -38, elevation: 24 };
export const ELEVATION_RANGE = [-10, 85] as const;

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** the azimuth in [−180, 180) */
export const wrapAzimuth = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

const rad = (d: number) => (d * Math.PI) / 180;

/** Screen-plane coordinates of a box point: x to the right, y up, and `depth` growing away from the viewer. */
export function rotate(p: Vec3, view: ViewAngles): { x: number; y: number; depth: number } {
  const a = rad(view.azimuth);
  const e = rad(view.elevation);
  const x1 = p[0] * Math.cos(a) - p[1] * Math.sin(a);
  const y1 = p[0] * Math.sin(a) + p[1] * Math.cos(a);
  return { x: x1, y: p[2] * Math.cos(e) + y1 * Math.sin(e), depth: y1 * Math.cos(e) - p[2] * Math.sin(e) };
}

/** Canvas coordinates (y down) of a box point: `scale` px per box unit, the box centre at (cx, cy). */
export function project(p: Vec3, view: ViewAngles, scale: number, cx: number, cy: number): { x: number; y: number; depth: number } {
  const r = rotate(p, view);
  return { x: cx + r.x * scale, y: cy - r.y * scale, depth: r.depth };
}

/** The scale (px per box unit) at which the whole box fits a w × h canvas at any angle. */
export function fitScale(w: number, h: number, margin = 0): number {
  const radius = Math.hypot(...HALF);
  return Math.max(1, Math.min(w, h) - 2 * margin) / (2 * radius);
}

/* ------------------------------------------------------------------ clipping to the pressure window */

/** The polygon cut to lo ≤ z ≤ hi (Sutherland–Hodgman, one plane at a time); empty when nothing is inside. */
export function clipPolygonZ(poly: Vec3[], lo: number, hi: number): Vec3[] {
  const cut = (pts: Vec3[], keep: (z: number) => boolean, at: number): Vec3[] => {
    const out: Vec3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const ka = keep(a[2]);
      const kb = keep(b[2]);
      if (ka) out.push(a);
      if (ka !== kb) {
        const s = (at - a[2]) / (b[2] - a[2]);
        out.push([lerp(a[0], b[0], s), lerp(a[1], b[1], s), at]);
      }
    }
    return out;
  };
  const above = cut(poly, (z) => z >= lo, lo);
  return cut(above, (z) => z <= hi, hi);
}

/** The runs of a polyline that lie within lo ≤ z ≤ hi, each ending exactly on the plane where the line leaves the window. */
export function clipPolylineZ(pts: Vec3[], lo: number, hi: number): Vec3[][] {
  const runs: Vec3[][] = [];
  let run: Vec3[] = [];
  const inside = (z: number) => z >= lo && z <= hi;
  const flush = () => {
    if (run.length > 1) runs.push(run);
    run = [];
  };
  for (let i = 0; i < pts.length; i++) {
    const b = pts[i];
    if (i === 0) {
      if (inside(b[2])) run.push(b);
      continue;
    }
    const a = pts[i - 1];
    const ia = inside(a[2]);
    const ib = inside(b[2]);
    if (ia && ib) {
      run.push(b);
      continue;
    }
    // the segment crosses one or both planes: take the part of it inside, ordered along the segment
    const ts: number[] = [];
    for (const plane of [lo, hi]) {
      const s = (plane - a[2]) / (b[2] - a[2]);
      if (s > 0 && s < 1) ts.push(s);
    }
    ts.sort((u, v) => u - v);
    const at = (s: number): Vec3 => [lerp(a[0], b[0], s), lerp(a[1], b[1], s), lerp(a[2], b[2], s)];
    if (ia && !ib) {
      run.push(at(ts[0]));
      flush();
    } else if (!ia && ib) {
      run = [at(ts[ts.length - 1]), b];
    } else if (ts.length === 2) {
      // from one side of the window to the other: a run of its own
      runs.push([at(ts[0]), at(ts[1])]);
    }
  }
  flush();
  return runs;
}

/* ------------------------------------------------------------------ the surface */

/** The v_r nodes: denser where the surface climbs steeply, near the excluded volume. */
export function vNodes(n: number): number[] {
  return Array.from({ length: n + 1 }, (_, i) => V_RANGE[0] + (V_RANGE[1] - V_RANGE[0]) * (i / n) ** 1.6);
}
/** the T_r nodes, evenly spaced */
export const tNodes = (n: number): number[] => Array.from({ length: n + 1 }, (_, j) => lerp(T_RANGE[0], T_RANGE[1], j / n));

export interface Cell {
  /** the quadrilateral in box coordinates, unclipped (P_r may lie outside the window) */
  corners: [Vec3, Vec3, Vec3, Vec3];
  /** P_r at the cell centre */
  p: number;
  /** ∂P_r/∂v_r > 0 at the centre: not a stable state */
  fold: boolean;
}

/** The cells of the surface P_r(v_r, T_r) for a and b at the fraction m of their values. */
export function surfaceCells(m: number, nv: number, nt: number): Cell[] {
  const vs = vNodes(nv);
  const ts = tNodes(nt);
  const grid = ts.map((t) => vs.map((v) => morphedPressureReduced(v, t, m)));
  const cells: Cell[] = [];
  for (let j = 0; j < nt; j++)
    for (let i = 0; i < nv; i++) {
      const vc = (vs[i] + vs[i + 1]) / 2;
      const tc = (ts[j] + ts[j + 1]) / 2;
      cells.push({
        corners: [toBox(vs[i], ts[j], grid[j][i]), toBox(vs[i + 1], ts[j], grid[j][i + 1]), toBox(vs[i + 1], ts[j + 1], grid[j + 1][i + 1]), toBox(vs[i], ts[j + 1], grid[j + 1][i])],
        p: morphedPressureReduced(vc, tc, m),
        fold: dPdvReduced(vc, tc, m) > 0,
      });
    }
  return cells;
}

/** The share of the surface's cells (by count) where ∂P/∂v > 0 */
export const foldShare = (cells: Cell[]) => cells.filter((c) => c.fold).length / cells.length;

/** The fold cells the figure paints: those that keep at least three corners inside the pressure window, the draw loop's own test. */
export const drawnFoldCells = (cells: Cell[]): Cell[] => cells.filter((c) => c.fold && clipPolygonZ(c.corners, -HALF[2], HALF[2]).length >= 3);

/**
 * What the figure can honestly say about the fold: 'drawn' when fold cells are painted, 'outside' when the gas has a fold
 * (any m > 0 does, at every T_r < 1) but it lies outside the drawn box and its pressure window, 'none' for the ideal gas (m = 0).
 */
export type FoldState = 'drawn' | 'outside' | 'none';
export function foldState(cells: Cell[], m: number): FoldState {
  if (drawnFoldCells(cells).length > 0) return 'drawn';
  return m > 0 ? 'outside' : 'none';
}

/** An isotherm (constant T_r) across the v range, in box coordinates and unclipped. */
export function isothermLine(m: number, t: number, nv: number): Vec3[] {
  return vNodes(nv).map((v) => toBox(v, t, morphedPressureReduced(v, t, m)));
}
/** An isochore (constant v_r) across the T range, in box coordinates and unclipped. */
export function isochoreLine(m: number, v: number, nt: number): Vec3[] {
  return tNodes(nt).map((t) => toBox(v, t, morphedPressureReduced(v, t, m)));
}

/** The critical point (v_r, T_r, P_r) = (m, 1, 1/m) of the morphed equation, or null when it falls outside the drawn box. */
export function criticalPoint(m: number): { v: number; t: number; p: number } | null {
  if (!(m > 0)) return null;
  const c = { v: m, t: 1, p: 1 / m };
  const inside = c.v >= V_RANGE[0] && c.v <= V_RANGE[1] && c.p >= P_RANGE[0] && c.p <= P_RANGE[1];
  return inside ? c : null;
}

/* ------------------------------------------------------------------ the back walls and the shadows */

/** The side (−1 or +1) of each axis whose face of the box is farther from the viewer: the back walls. */
export function backWalls(view: ViewAngles): { x: -1 | 1; y: -1 | 1; z: -1 | 1 } {
  const far = (axis: 0 | 1 | 2): -1 | 1 => {
    const lo: Vec3 = [0, 0, 0];
    const hi: Vec3 = [0, 0, 0];
    lo[axis] = -HALF[axis];
    hi[axis] = HALF[axis];
    return rotate(hi, view).depth >= rotate(lo, view).depth ? 1 : -1;
  };
  return { x: far(0), y: far(1), z: far(2) };
}

/** The shadow of a box point on each back wall: the P–T wall (x fixed), the P–v wall (y fixed) and the v–T wall (z fixed). */
export function shadowOf(p: Vec3, walls: { x: -1 | 1; y: -1 | 1; z: -1 | 1 }): { onX: Vec3; onY: Vec3; onZ: Vec3 } {
  return {
    onX: [walls.x * HALF[0], p[1], p[2]],
    onY: [p[0], walls.y * HALF[1], p[2]],
    onZ: [p[0], p[1], walls.z * HALF[2]],
  };
}

/* ------------------------------------------------------------------ the three legs */

export interface StatePoint {
  v: number;
  t: number;
  p: number;
}

/** the corners of the journey, in reduced variables: A to B at constant T, B to C at constant v, C to D at constant P */
export const LEGS = { vA: 3.6, vB: 1.5, tA: 1.4, tC: 1.0 } as const;

const at = (v: number, t: number, m: number): StatePoint => ({ v, t, p: morphedPressureReduced(v, t, m) });

/** The v_r on the isotherm T_r with pressure p (T_r > 1, where P falls steadily with v), found by bisection. */
export function volumeAtPressure(p: number, t: number, m: number): number {
  let lo = m / 3 + 1e-9;
  let hi = 1e6;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (morphedPressureReduced(mid, t, m) > p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The state point a fraction s ∈ [0, 1] of the way through its three legs, a third each: an isotherm from A = (3.6, 1.4) to
 * B (v_r = 1.5), an isochore from B down to T_r = 1 at C, and an isobar from C out to the volume where the pressure of C
 * meets the first isotherm again, D. The pressure is the equation's own (a, b at the fraction m).
 */
export function legPoint(m: number, s: number): StatePoint {
  const f = clamp(s, 0, 1);
  const leg = Math.min(2, Math.floor(3 * f));
  const u = 3 * f - leg;
  const { vA, vB, tA, tC } = LEGS;
  if (leg === 0) return at(lerp(vA, vB, u), tA, m);
  if (leg === 1) return at(vB, lerp(tA, tC, u), m);
  const pC = morphedPressureReduced(vB, tC, m);
  const vD = volumeAtPressure(pC, tA, m);
  const v = lerp(vB, vD, u);
  // on the isobar T follows from solving the equation for T at the fixed pressure
  const t = ((pC + (3 * m) / (v * v)) * (3 * v - m)) / 8;
  return { v, t, p: pC };
}

/** `n + 1` points along the whole journey, or along the part of it up to the fraction `upTo` */
export function legPath(m: number, n: number, upTo = 1): StatePoint[] {
  const count = Math.max(1, Math.round(n * clamp(upTo, 0, 1)));
  return Array.from({ length: count + 1 }, (_, i) => legPoint(m, (i / count) * clamp(upTo, 0, 1)));
}
