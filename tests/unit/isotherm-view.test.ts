import { describe, expect, it } from 'vitest';
import { CO2_ISOTHERM_280K, CO2_NIST_280K } from '../../src/physics/co2-isotherm';
import { dPdvReduced, vdwPressureReduced } from '../../src/physics/gases';
import { TR_CO2, co2Constants, co2Reduced, dataAt, idealReduced, pressureSpan, slopeReadout, T_NO_INFLECTION, unstableInterval, zVdw } from '../../src/sims/core/isotherm-view';

describe('the CO₂ data in reduced variables (NIST)', () => {
  const pts = co2Reduced();
  it('has T_r = 280/304.13 and the constants fitted from the critical point (ThermoLab’s function)', () => {
    expect(TR_CO2).toBeCloseTo(0.920658928747575, 12);
    expect(co2Constants().vC).toBeCloseTo(2.134402730521329e-28, 40);
  });
  it('holds NIST’s 53 rows, and converts V_m = M/ρ', () => {
    expect(CO2_NIST_280K).toHaveLength(53);
    expect(pts).toHaveLength(CO2_ISOTHERM_280K.length);
    expect(CO2_ISOTHERM_280K[0][1]).toBeCloseTo(44.0095e-3 / 7.7545, 12);
  });
  it('maps the first, the saturated-vapour, the saturated-liquid and the last row to the values the Python gives', () => {
    const want = [[0, 0.05422037872934542, 44.15352324495331, 0.9751252653763899], [38, 0.5639868244479688, 2.81245684247569, 0.6460815267560358], [39, 0.5639868244479688, 0.3875014101756383, 0.08901736692464722], [52, 1.382619657598308, 0.364382631649345, 0.20520734131604768]];
    for (const [i, pR, vR, z] of want) {
      expect(pts[i].pR).toBeCloseTo(pR, 10);
      expect(pts[i].vR).toBeCloseTo(vR, 8);
      expect(pts[i].z).toBeCloseTo(z, 10);
    }
  });
  it('has the saturated vapour and liquid at the same pressure, P_sat/P_c = 0.5640, and v_r falling along the compression', () => {
    expect(pts[38].pR).toBe(pts[39].pR);
    for (let i = 1; i < pts.length; i++) expect(pts[i].vR).toBeLessThan(pts[i - 1].vR);
  });
  it('has Z equal to (3/8) P_r v_r/T_r, because the fitted critical point has Z_c = 3/8', () => {
    for (const p of pts) expect(p.z).toBeCloseTo((3 / 8) * (p.pR * p.vR) / TR_CO2, 10);
  });
  it('lies near the ideal curve in the dilute limit: Z of the first row is 0.975', () => {
    expect(pts[0].z).toBeGreaterThan(0.97);
    expect(pts[0].pR / idealReduced(pts[0].vR, TR_CO2)).toBeCloseTo(pts[0].z, 10);
  });
});

describe('dataAt', () => {
  const pts = co2Reduced();
  it('returns the data at their own volumes and interpolates P_r in log v_r between them', () => {
    expect(dataAt(pts, pts[2].vR)!.pR).toBeCloseTo(pts[2].pR, 12);
    const mid = Math.sqrt(pts[2].vR * pts[3].vR);
    expect(dataAt(pts, mid)!.pR).toBeCloseTo((pts[2].pR + pts[3].pR) / 2, 10);
  });
  it('is flat on the plateau and null outside the data', () => {
    expect(dataAt(pts, 1.2)!.pR).toBeCloseTo(4.1607e6 / 7.3773e6, 12);
    expect(dataAt(pts, 100)).toBeNull();
    expect(dataAt(pts, 0.3)).toBeNull();
  });
});

describe('the stretch where ∂P/∂v > 0', () => {
  it('is absent at and above T_r = 1', () => {
    for (const t of [1, 1.01, 1.2, 1.5]) expect(unstableInterval(t)).toBeNull();
  });
  it('matches the roots of 4 T v³ − (3v − 1)² = 0, as numpy finds them (T_r = 0.8: 0.6352 to 1.9212)', () => {
    const [a, b] = unstableInterval(0.8)!;
    expect(a).toBeCloseTo(0.6352104316992135, 10);
    expect(b).toBeCloseTo(1.921221815224632, 10);
    expect(unstableInterval(0.9)![0]).toBeCloseTo(0.7185971889532528, 10);
    expect(unstableInterval(0.9)![1]).toBeCloseTo(1.528504964267178, 10);
  });
  it('has ∂P/∂v = 0 at its ends, > 0 inside and < 0 outside', () => {
    for (const t of [0.8, 0.9, 0.95, 0.99, TR_CO2]) {
      const [a, b] = unstableInterval(t)!;
      expect(dPdvReduced(a, t)).toBeCloseTo(0, 9);
      expect(dPdvReduced(b, t)).toBeCloseTo(0, 9);
      expect(dPdvReduced((a + b) / 2, t)).toBeGreaterThan(0);
      expect(dPdvReduced(a * 0.95, t)).toBeLessThan(0);
      expect(dPdvReduced(b * 1.05, t)).toBeLessThan(0);
    }
  });
  it('shrinks onto the critical volume v_r = 1 as T_r → 1', () => {
    let width = Infinity;
    for (const t of [0.8, 0.9, 0.99, 0.9999]) {
      const [a, b] = unstableInterval(t)!;
      expect(b - a).toBeLessThan(width);
      width = b - a;
      expect(a).toBeLessThan(1);
      expect(b).toBeGreaterThan(1);
    }
    expect(width).toBeLessThan(0.05);
  });
  it('has the stretch where ∂P/∂v > 0 at T_r = 280/304.13 run from v_r ≈ 0.74 to 1.45', () => {
    const [a, b] = unstableInterval(TR_CO2)!;
    expect(a).toBeGreaterThan(0.7);
    expect(a).toBeLessThan(0.8);
    expect(b).toBeGreaterThan(1.4);
    expect(b).toBeLessThan(1.6);
  });
});

describe('the slope readout', () => {
  it('is exactly zero on the critical isotherm, at the inflection v_r = 1', () => {
    const r = slopeReadout(1);
    expect(r.kind).toBe('slope');
    if (r.kind === 'slope') {
      expect(r.vR).toBeCloseTo(1, 9);
      expect(r.slope).toBeCloseTo(0, 9);
    }
  });
  it('is the slope where ∂²P/∂v² = 0, positive and shrinking to zero as T_r → 1 from above', () => {
    let prev = Infinity;
    for (const t of [1.06, 1.04, 1.02, 1.005, 1.0001]) {
      const r = slopeReadout(t);
      expect(r.kind).toBe('slope');
      if (r.kind !== 'slope') continue;
      expect(144 * t / (3 * r.vR - 1) ** 3 - 18 / r.vR ** 4).toBeCloseTo(0, 8);
      expect(r.slope).toBeGreaterThan(0);
      expect(r.slope).toBeLessThan(prev);
      prev = r.slope;
    }
    expect(prev).toBeLessThan(1e-3);
  });
  it('has no inflection above T_r = 1.0678: the isotherm is convex everywhere there', () => {
    expect(T_NO_INFLECTION).toBeCloseTo(1.06787, 5);
    expect(slopeReadout(1.07)).toEqual({ kind: 'convex' });
    expect(slopeReadout(1.5)).toEqual({ kind: 'convex' });
    for (const t of [1.07, 1.2, 1.5]) for (let v = 0.4; v < 20; v *= 1.1) expect(144 * t / (3 * v - 1) ** 3 - 18 / v ** 4).toBeGreaterThan(0);
  });
  it('is the interval of ∂P/∂v > 0 below T_r = 1', () => {
    expect(slopeReadout(0.8)).toEqual({ kind: 'interval', from: expect.closeTo(0.6352104316992135, 10), to: expect.closeTo(1.921221815224632, 10) });
  });
});

describe('Z and the pressure span', () => {
  it('has Z_c = 3/8 at the critical point, and tends to 1 in the dilute limit', () => {
    expect(zVdw(1, 1)).toBeCloseTo(3 / 8, 12);
    expect(zVdw(1e4, 1.2)).toBeCloseTo(1, 3);
  });
  it('spans the wiggle: negative P_r below T_r ≈ 0.85, none above T_r = 1', () => {
    expect(pressureSpan(0.8, 0.4, 10).lo).toBeLessThan(-0.3);
    expect(pressureSpan(1.2, 0.4, 10).lo).toBeGreaterThan(0);
    expect(pressureSpan(1.2, 0.4, 10).hi).toBe(3);
  });
});
