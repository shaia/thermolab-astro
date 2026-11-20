import { describe, expect, it } from 'vitest';
import { dPdvReduced, morphedPressureReduced } from '../../src/physics/gases';
import {
  HALF,
  LEGS,
  P_RANGE,
  T_RANGE,
  V_RANGE,
  backWalls,
  clamp,
  clipPolygonZ,
  clipPolylineZ,
  criticalPoint,
  fitScale,
  foldShare,
  isochoreLine,
  isothermLine,
  legPath,
  legPoint,
  project,
  rotate,
  shadowOf,
  surfaceCells,
  tNodes,
  toBox,
  vNodes,
  volumeAtPressure,
  wrapAzimuth,
  type Vec3,
} from '../../src/sims/core/surface-view';

describe('the box mapping', () => {
  it('sends the ends of each range to ±half-extent and the middle to 0', () => {
    expect(toBox(V_RANGE[0], T_RANGE[0], P_RANGE[0])).toEqual([-HALF[0], -HALF[1], -HALF[2]]);
    const hi = toBox(V_RANGE[1], T_RANGE[1], P_RANGE[1]);
    for (let k = 0; k < 3; k++) expect(hi[k]).toBeCloseTo(HALF[k], 12);
    expect(toBox(2.7, 1.2, 1)).toEqual([expect.closeTo(0, 12), expect.closeTo(0, 12), expect.closeTo(0, 12)]);
  });
});

describe('the projection and the rotation', () => {
  it('at azimuth 0, elevation 0 shows x to the right, z up and y as depth', () => {
    const v = { azimuth: 0, elevation: 0 };
    expect(rotate([1, 0, 0], v)).toEqual({ x: 1, y: 0, depth: 0 });
    const up = rotate([0, 0, 1], v);
    expect([up.x, up.y, up.depth]).toEqual([0, 1, expect.closeTo(0, 12)]);
    expect(rotate([0, 1, 0], v).depth).toBeCloseTo(1, 12);
  });
  it('turns the x axis onto the y axis with a quarter-turn of azimuth', () => {
    const r = rotate([1, 0, 0], { azimuth: 90, elevation: 0 });
    expect(r.x).toBeCloseTo(0, 12);
    expect(r.depth).toBeCloseTo(1, 12);
  });
  it('looks straight down at elevation 90: z is pure depth and y runs up the screen', () => {
    const v = { azimuth: 0, elevation: 90 };
    expect(rotate([0, 0, 1], v).y).toBeCloseTo(0, 12);
    expect(rotate([0, 0, 1], v).depth).toBeCloseTo(-1, 12);
    expect(rotate([0, 1, 0], v).y).toBeCloseTo(1, 12);
  });
  it('preserves the length of an axis vector projected from the side, and returns after 360 degrees', () => {
    const p: Vec3 = [0.3, -0.7, 0.5];
    const a = rotate(p, { azimuth: 25, elevation: 30 });
    const b = rotate(p, { azimuth: 385, elevation: 30 });
    expect(b.x).toBeCloseTo(a.x, 12);
    expect(b.y).toBeCloseTo(a.y, 12);
    expect(Math.hypot(a.x, a.y, a.depth)).toBeCloseTo(Math.hypot(...p), 12);
  });
  it('is orthographic: parallel lines stay parallel and the canvas y runs down', () => {
    const view = { azimuth: -38, elevation: 24 };
    const o = project([0, 0, 0], view, 100, 200, 150);
    expect([o.x, o.y]).toEqual([200, 150]);
    const up = project([0, 0, 1], view, 100, 200, 150);
    expect(up.y).toBeLessThan(150);
    const a = project([0, 0, 0], view, 100, 0, 0);
    const b = project([1, 0, 0], view, 100, 0, 0);
    const c = project([0, 1, 0.5], view, 100, 0, 0);
    const d = project([1, 1, 0.5], view, 100, 0, 0);
    expect([b.x - a.x, b.y - a.y]).toEqual([expect.closeTo(d.x - c.x, 9), expect.closeTo(d.y - c.y, 9)]);
  });
  it('fits the box inside a canvas at every angle', () => {
    const s = fitScale(400, 300);
    for (const az of [0, 37, 90, 200]) for (const el of [-10, 24, 85]) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const r = project([sx * HALF[0], sy * HALF[1], sz * HALF[2]], { azimuth: az, elevation: el }, s, 200, 150);
      expect(Math.abs(r.x - 200)).toBeLessThanOrEqual(150 + 1e-9);
      expect(Math.abs(r.y - 150)).toBeLessThanOrEqual(150 + 1e-9);
    }
  });
  it('clamps and wraps angles', () => {
    expect(clamp(120, -10, 85)).toBe(85);
    expect(wrapAzimuth(190)).toBe(-170);
    expect(wrapAzimuth(-190)).toBe(170);
    expect(wrapAzimuth(180)).toBe(-180);
  });
});

describe('clipping to the pressure window', () => {
  const quad = (z: [number, number, number, number]): Vec3[] => [[0, 0, z[0]], [1, 0, z[1]], [1, 1, z[2]], [0, 1, z[3]]];
  const area = (poly: Vec3[]) => {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  };
  it('leaves a polygon inside the window alone and drops one wholly outside', () => {
    const inside = quad([0, 0.2, 0.4, 0.6]);
    expect(clipPolygonZ(inside, -1, 1)).toEqual(inside);
    expect(clipPolygonZ(quad([2, 3, 2, 3]), -1, 1)).toEqual([]);
    expect(clipPolygonZ(quad([-3, -2, -2, -3]), -1, 1)).toEqual([]);
  });
  it('cuts a polygon on the plane where it leaves the window, keeping every vertex within lo ≤ z ≤ hi', () => {
    // a quad rising linearly in x from z = 0 to 2, clipped at 1: the half with x ≤ 1/2
    const poly = clipPolygonZ(quad([0, 2, 2, 0]), -1, 1);
    for (const v of poly) {
      expect(v[2]).toBeLessThanOrEqual(1 + 1e-12);
      expect(v[2]).toBeGreaterThanOrEqual(-1 - 1e-12);
    }
    expect(area(poly)).toBeCloseTo(0.5, 12);
    expect(Math.max(...poly.map((v) => v[0]))).toBeCloseTo(0.5, 12);
    expect(poly.filter((v) => v[2] === 1).every((v) => Math.abs(v[0] - 0.5) < 1e-12)).toBe(true);
  });
  it('cuts both ends when a polygon spans the window', () => {
    const poly = clipPolygonZ(quad([-2, 2, 2, -2]), -1, 1);
    expect(area(poly)).toBeCloseTo(0.5, 12);
  });
  it('splits a polyline into the runs inside the window, ending exactly on its planes', () => {
    const line: Vec3[] = [[0, 0, 0], [1, 0, 2], [2, 0, 0], [3, 0, -2], [4, 0, 0]];
    const runs = clipPolylineZ(line, -1, 1);
    expect(runs).toHaveLength(3);
    expect(runs[0]).toEqual([[0, 0, 0], [0.5, 0, 1]]);
    expect(runs[1]).toEqual([[1.5, 0, 1], [2, 0, 0], [2.5, 0, -1]]);
    expect(runs[2]).toEqual([[3.5, 0, -1], [4, 0, 0]]);
  });
  it('keeps a polyline inside the window whole, drops one outside and finds a crossing from side to side', () => {
    const whole: Vec3[] = [[0, 0, 0], [1, 0, 0.5], [2, 0, -0.5]];
    expect(clipPolylineZ(whole, -1, 1)).toEqual([whole]);
    expect(clipPolylineZ([[0, 0, 3], [1, 0, 4]], -1, 1)).toEqual([]);
    expect(clipPolylineZ([[0, 0, -3], [1, 0, 3]], -1, 1)).toEqual([[[1 / 3, 0, -1], [2 / 3, 0, 1]]]);
  });
  it('clips an isotherm of the real surface to the window: the steep wall near v_r = 0.4 is cut, nothing leaves the box', () => {
    const runs = clipPolylineZ(isothermLine(1, 1.2, 80), -HALF[2], HALF[2]);
    expect(runs.length).toBeGreaterThanOrEqual(1);
    for (const r of runs) for (const p of r) expect(Math.abs(p[2])).toBeLessThanOrEqual(HALF[2] + 1e-9);
    // the first points of the unclipped line are far above the window, so the clipped line starts later
    const full = isothermLine(1, 1.2, 80);
    expect(full[0][2]).toBeGreaterThan(HALF[2]);
    expect(runs[0][0][0]).toBeGreaterThan(full[0][0]);
  });
});

describe('the surface', () => {
  it('has the nodes in range, increasing, denser at small v_r', () => {
    const v = vNodes(40);
    expect(v[0]).toBe(V_RANGE[0]);
    expect(v[40]).toBeCloseTo(V_RANGE[1], 12);
    expect(v[1] - v[0]).toBeLessThan(v[40] - v[39]);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
    expect(tNodes(8)[0]).toBe(T_RANGE[0]);
    expect(tNodes(8)[8]).toBeCloseTo(T_RANGE[1], 12);
  });
  it('is the equation at the nodes: a corner of the first cell sits at the box position of (v_r, T_r, P_r)', () => {
    const cells = surfaceCells(1, 20, 10);
    expect(cells).toHaveLength(200);
    expect(cells[0].corners[0]).toEqual(toBox(V_RANGE[0], T_RANGE[0], morphedPressureReduced(V_RANGE[0], T_RANGE[0], 1)));
  });
  it('has no fold for the ideal gas, and a fold below T_r = 1 for van der Waals', () => {
    expect(foldShare(surfaceCells(0, 56, 18))).toBe(0);
    const full = surfaceCells(1, 56, 18);
    expect(foldShare(full)).toBeGreaterThan(0.03);
    expect(foldShare(full)).toBeLessThan(0.3);
  });
  it('puts every fold cell below the critical temperature, and every cell above it on the stable side', () => {
    for (const m of [0.5, 1]) {
      const nt = 16;
      const cells = surfaceCells(m, 56, nt);
      cells.forEach((c, k) => {
        const j = Math.floor(k / 56);
        const tMid = (tNodes(nt)[j] + tNodes(nt)[j + 1]) / 2;
        if (c.fold) expect(tMid).toBeLessThan(1);
        if (tMid > 1) expect(c.fold).toBe(false);
      });
    }
  });
  it('lets the fold grow as a and b turn on, appearing inside the window once the critical volume m exceeds about 0.4', () => {
    const shares = [0, 0.1, 0.3, 0.5, 0.8, 1].map((m) => foldShare(surfaceCells(m, 56, 18)));
    expect(shares[0]).toBe(0);
    expect(shares[1]).toBe(0);
    for (let i = 1; i < shares.length; i++) expect(shares[i]).toBeGreaterThanOrEqual(shares[i - 1]);
    expect(shares[5]).toBeGreaterThan(shares[3]);
  });
  it('marks a cell as fold exactly where the analytic slope is positive', () => {
    const cells = surfaceCells(1, 30, 12);
    expect(cells.some((c) => c.fold)).toBe(true);
    const f = cells.find((c) => c.fold)!;
    expect(f.p).toBeGreaterThan(P_RANGE[0]);
    expect(dPdvReduced(1, 0.9)).toBeGreaterThan(0);
  });
  it('finds the critical point at (m, 1, 1/m) inside the box, null once it leaves', () => {
    expect(criticalPoint(1)).toEqual({ v: 1, t: 1, p: 1 });
    expect(criticalPoint(0.5)).toEqual({ v: 0.5, t: 1, p: 2 });
    expect(criticalPoint(0.2)).toBeNull();
    expect(criticalPoint(0)).toBeNull();
  });
  it('has isochores that rise with T_r and isotherms that fall with v_r on the supercritical side', () => {
    const iso = isochoreLine(1, 2, 8);
    for (let i = 1; i < iso.length; i++) expect(iso[i][2]).toBeGreaterThan(iso[i - 1][2]);
    const th = isothermLine(1, 1.4, 40);
    for (let i = 1; i < th.length; i++) expect(th[i][2]).toBeLessThan(th[i - 1][2]);
  });
});

describe('the back walls and the shadows', () => {
  it('picks the faces away from the viewer', () => {
    // the default view has the camera on the −y side, above: the far walls are +y (T_r = 1.6) and the floor
    expect(backWalls({ azimuth: 0, elevation: 24 })).toEqual({ x: expect.any(Number), y: 1, z: -1 });
    expect(backWalls({ azimuth: 180, elevation: 24 }).y).toBe(-1);
    expect(backWalls({ azimuth: 90, elevation: 24 }).x).toBe(1);
    expect(backWalls({ azimuth: -90, elevation: 24 }).x).toBe(-1);
  });
  it('flips the floor to a ceiling when the viewer goes below', () => {
    expect(backWalls({ azimuth: 0, elevation: -10 }).z).toBe(1);
  });
  it('projects a point onto each wall along the axis perpendicular to it', () => {
    const w = backWalls({ azimuth: 0, elevation: 24 });
    const s = shadowOf([0.3, -0.2, 0.1], w);
    expect(s.onY).toEqual([0.3, HALF[1], 0.1]);
    expect(s.onZ).toEqual([0.3, -0.2, -HALF[2]]);
    expect(s.onX).toEqual([w.x * HALF[0], -0.2, 0.1]);
  });
});

describe('the three legs', () => {
  const m = 1;
  const pts = legPath(m, 300);
  it('starts at A, turns at B and C, and stays inside the drawn box', () => {
    expect(legPoint(m, 0)).toEqual({ v: LEGS.vA, t: LEGS.tA, p: expect.closeTo(morphedPressureReduced(LEGS.vA, LEGS.tA, 1), 12) });
    const b = legPoint(m, 1 / 3);
    expect([b.v, b.t]).toEqual([expect.closeTo(LEGS.vB, 12), LEGS.tA]);
    const c = legPoint(m, 2 / 3);
    expect([c.v, c.t]).toEqual([LEGS.vB, expect.closeTo(LEGS.tC, 12)]);
    for (const mm of [0, 0.5, 1]) for (const p of legPath(mm, 90)) {
      expect(p.v).toBeGreaterThanOrEqual(V_RANGE[0]);
      expect(p.v).toBeLessThanOrEqual(V_RANGE[1]);
      expect(p.t).toBeGreaterThanOrEqual(T_RANGE[0]);
      expect(p.t).toBeLessThanOrEqual(T_RANGE[1]);
      expect(p.p).toBeGreaterThanOrEqual(P_RANGE[0]);
      expect(p.p).toBeLessThanOrEqual(P_RANGE[1]);
    }
  });
  it('holds T constant on leg 1, v on leg 2 and P on leg 3, and every point obeys the equation', () => {
    const one = pts.filter((_, i) => i <= 100);
    const two = pts.filter((_, i) => i >= 100 && i <= 200);
    const three = pts.filter((_, i) => i >= 200);
    for (const p of one) expect(p.t).toBeCloseTo(LEGS.tA, 12);
    for (const p of two) expect(p.v).toBeCloseTo(LEGS.vB, 12);
    for (const p of three) expect(p.p).toBeCloseTo(three[0].p, 12);
    for (const p of pts) expect(p.p).toBeCloseTo(morphedPressureReduced(p.v, p.t, m), 9);
  });
  it('is continuous, with each leg the named curve: leg 1 an isotherm falling in P, leg 2 an isochore, leg 3 an isobar rising in T', () => {
    for (let i = 1; i < pts.length; i++) {
      expect(Math.abs(pts[i].v - pts[i - 1].v)).toBeLessThan(0.05);
      expect(Math.abs(pts[i].t - pts[i - 1].t)).toBeLessThan(0.02);
    }
    expect(pts[100].p).toBeGreaterThan(pts[0].p);
    expect(pts[200].p).toBeLessThan(pts[100].p);
    for (let i = 201; i < pts.length; i++) expect(pts[i].t).toBeGreaterThan(pts[i - 1].t);
  });
  it('ends on the starting isotherm, at the volume where the pressure of C meets it (D)', () => {
    const end = legPoint(m, 1);
    expect(end.t).toBeCloseTo(LEGS.tA, 9);
    expect(end.v).toBeCloseTo(volumeAtPressure(legPoint(m, 2 / 3).p, LEGS.tA, m), 9);
    expect(end.v).toBeLessThan(LEGS.vA);
    expect(end.v).toBeGreaterThan(LEGS.vB);
  });
  it('clamps outside [0, 1] and gives a partial path', () => {
    expect(legPoint(m, -1)).toEqual(legPoint(m, 0));
    expect(legPoint(m, 2)).toEqual(legPoint(m, 1));
    const part = legPath(m, 90, 1 / 3);
    expect(part[part.length - 1].v).toBeCloseTo(LEGS.vB, 9);
  });
});
