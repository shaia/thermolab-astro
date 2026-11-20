/**
 * The claims lesson 2.1 makes about equations of state, each as a test: the ideal-gas limit as a, b → 0, the critical
 * point in closed form against a numerical flatness scan (with the scan's honest uncertainty: the threshold must be
 * tightened with the grid, and refining the grid alone leaves a bias), Z → 1 as v → ∞, the parameter-free reduced
 * equation, Z_c = 3/8 and the CO₂ constants fitted from its critical data.
 * The deterministic values were checked against ThermoLab's Python (thermolab.gases).
 */

import { describe, expect, it } from 'vitest';
import {
  K_B,
  N_A,
  compressibilityFactor,
  compressibilityReduced,
  dPdvReduced,
  flatnessScan,
  idealGasPressure,
  idealGasTemperature,
  isothermFamily,
  morphedPressureReduced,
  pvtSurface,
  reducedVariables,
  vdwConstantsFromCritical,
  vdwCriticalPoint,
  vdwPressure,
  vdwPressureReduced,
} from '../../src/physics/gases';
import { CO2_CRITICAL } from '../../src/physics/co2-isotherm';

const rel = (x: number, y: number) => Math.abs(x - y) / Math.abs(y);
/** argon per molecule (molar a = 0.1355 Pa m⁶/mol², b = 3.201e-5 m³/mol, as ThermoLab's tests write them) */
const ARGON = { a: 3.736e-49, b: 5.317e-29 };
const CO2 = vdwConstantsFromCritical(CO2_CRITICAL.tC, CO2_CRITICAL.pC);

describe('the ideal gas', () => {
  it('has P = N k_B T/V and inverts it', () => {
    expect(idealGasPressure(5e22, 300, 2e-3)).toBeCloseTo(103548.675, 6);
    expect(idealGasTemperature(5e22, idealGasPressure(5e22, 300, 2e-3), 2e-3)).toBeCloseTo(300, 9);
    expect(() => idealGasPressure(1, 300, 0)).toThrow(RangeError);
  });
});

describe('the ideal-gas limit', () => {
  it('is exact at a = b = 0', () => {
    const v = 2e-3 / 1000;
    expect(rel(vdwPressure(v, 300, 0, 0), idealGasPressure(1000, 300, 2e-3))).toBeLessThan(1e-12);
  });
  it('is approached, a decade at a time, as a and b shrink (argon at 300 K, 5e22 molecules in 2 L)', () => {
    const v = 2e-3 / 5e22;
    const ideal = idealGasPressure(5e22, 300, 2e-3);
    // the first value is ThermoLab's: 103453.00028049784 Pa against 103548.675 Pa
    expect(vdwPressure(v, 300, ARGON.a, ARGON.b)).toBeCloseTo(103453.00028049784, 4);
    const errors = [1, 0.1, 0.01, 0.001].map((f) => rel(vdwPressure(v, 300, ARGON.a * f, ARGON.b * f), ideal));
    for (let i = 1; i < errors.length; i++) expect(errors[i]).toBeLessThan(errors[i - 1] / 5);
    expect(errors[0]).toBeLessThan(1e-2);
    expect(errors[3]).toBeLessThan(1e-4);
  });
  it('is the m → 0 end of the morphed reduced equation, P_r = 8 T_r/(3 v_r)', () => {
    for (const [v, t] of [[0.5, 0.8], [1, 1], [3.3, 1.6]]) {
      expect(morphedPressureReduced(v, t, 0)).toBeCloseTo((8 * t) / (3 * v), 12);
      expect(morphedPressureReduced(v, t, 1)).toBeCloseTo(vdwPressureReduced(v, t), 12);
    }
  });
  it('refuses a volume that does not exceed the excluded volume', () => {
    expect(() => vdwPressure(ARGON.b, 300, ARGON.a, ARGON.b)).toThrow(RangeError);
    expect(() => vdwPressure(0.5 * ARGON.b, 300, ARGON.a, ARGON.b)).toThrow(RangeError);
  });
});

describe('the critical point in closed form', () => {
  it('is (3b, 8a/27 k_B b, a/27 b²), checked against ThermoLab for argon', () => {
    const c = vdwCriticalPoint(ARGON.a, ARGON.b);
    expect(rel(c.vC, 1.5951000000000001e-28)).toBeLessThan(1e-12);
    expect(rel(c.tC, 150.7936825858366)).toBeLessThan(1e-12);
    expect(rel(c.pC, 4894516.340710285)).toBeLessThan(1e-12);
    // CRC: T_c = 150.9 K, P_c = 4.87 MPa
    expect(rel(c.tC, 150.9)).toBeLessThan(0.02);
    expect(rel(c.pC, 4.87e6)).toBeLessThan(0.02);
  });
  it('is where the isotherm is flat and has an inflection: ∂P/∂v = ∂²P/∂v² = 0, to second order in h', () => {
    const { vC, tC } = vdwCriticalPoint(ARGON.a, ARGON.b);
    const p = (v: number) => vdwPressure(v, tC, ARGON.a, ARGON.b);
    const first = (h: number) => Math.abs((p(vC + h) - p(vC - h)) / (2 * h));
    const second = (h: number) => Math.abs((p(vC + h) - 2 * p(vC) + p(vC - h)) / (h * h));
    const scale = vdwPressure(vC, tC, ARGON.a, ARGON.b) / vC;
    // the central first difference of a function with a vanishing second derivative is O(h²)
    const h1 = 0.1 * vC;
    const h2 = 0.05 * vC;
    expect(first(h1) / scale).toBeLessThan(0.02);
    expect(first(h1) / first(h2)).toBeGreaterThan(3.5);
    expect(first(h1) / first(h2)).toBeLessThan(4.5);
    expect(second(h2) / (scale / vC)).toBeLessThan(0.15);
    expect(dPdvReduced(1, 1)).toBeCloseTo(0, 12);
  });
  it('gives P_c back when the pressure formula is evaluated there', () => {
    const { vC, tC, pC } = vdwCriticalPoint(ARGON.a, ARGON.b);
    expect(rel(vdwPressure(vC, tC, ARGON.a, ARGON.b), pC)).toBeLessThan(1e-10);
  });
  it('is intensive: scaling the particle count never enters', () => {
    expect(vdwCriticalPoint(ARGON.a, ARGON.b)).toEqual(vdwCriticalPoint(ARGON.a, ARGON.b));
    expect(() => vdwCriticalPoint(0, 1)).toThrow(RangeError);
    expect(() => vdwCriticalPoint(1, -1)).toThrow(RangeError);
  });
  it('moves to (m, 1, 1/m) when a and b are both scaled by m (T_c is a/b, unchanged)', () => {
    for (const m of [0.25, 0.5, 1]) {
      expect(morphedPressureReduced(m, 1, m)).toBeCloseTo(1 / m, 12);
      expect(dPdvReduced(m, 1, m)).toBeCloseTo(0, 10);
    }
  });
});

describe('the critical point against a numerical flatness scan', () => {
  const { tC } = vdwCriticalPoint(CO2.a, CO2.b);
  const sigma = (s: { tc: number; uncertainty: number }) => Math.abs(s.tc - tC) / s.uncertainty;

  it('reproduces ThermoLab: 304.59 ± 0.46 K at 200 temperatures, against the closed-form 304.13 K', () => {
    expect(rel(tC, CO2_CRITICAL.tC)).toBeLessThan(1e-12);
    const s = flatnessScan(CO2.a, CO2.b);
    expect(s.tc).toBeCloseTo(304.58848743718596, 6);
    expect(s.uncertainty).toBeCloseTo(0.4584874371859371, 9);
    expect(sigma(s)).toBeLessThanOrEqual(1.0001);
  });

  it('with the threshold tightened in step with the grid, converges: error and error bar fall together, always about 1 sigma', () => {
    const runs = [
      [200, 0.01],
      [400, 0.005],
      [800, 0.0025],
      [1600, 0.00125],
    ].map(([n, f]) => flatnessScan(CO2.a, CO2.b, n, f));
    // ThermoLab's second table
    expect(runs.map((r) => r.tc - tC)).toEqual(
      [0.4584874371859655, 0.2286691729323138, 0.11419148936170131, 0.05706003752345623].map((x) => expect.closeTo(x, 6)),
    );
    for (const r of runs) expect(sigma(r)).toBeLessThanOrEqual(1.0001);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i].uncertainty).toBeCloseTo(runs[i - 1].uncertainty / 2, 2);
      expect(Math.abs(runs[i].tc - tC)).toBeLessThan(Math.abs(runs[i - 1].tc - tC));
    }
    expect(runs[3].tc - tC).toBeLessThan(0.06);
  });

  it('refining the temperature grid ALONE leaves a bias: the error bar shrinks eightfold and the error does not', () => {
    const runs = [200, 400, 800, 1600].map((n) => flatnessScan(CO2.a, CO2.b, n, 0.01));
    // ThermoLab's first table: errors 0.458, 0.229, 0.343, 0.399 K against error bars 0.458, 0.229, 0.114, 0.057 K
    expect(runs[3].uncertainty).toBeCloseTo(runs[0].uncertainty / 8, 3);
    const errors = runs.map((r) => r.tc - tC);
    expect(errors[1]).toBeCloseTo(0.2286691729323138, 6);
    expect(errors[3]).toBeCloseTo(0.3994202626641936, 6);
    // the bias is the threshold's: the error never falls below what the threshold alone allows,
    // and never exceeds it either. Near T_c, |∂P/∂v|_min = 6 (T_r − 1) P_c/v_c, so the scan stops at
    // T − T_c ≈ θ T_c/6 = 0.51 K whatever the grid
    const bias = (0.01 * tC) / 6;
    for (const e of errors) expect(e).toBeLessThanOrEqual(bias + 1e-9);
    // so the honest-looking measurement drifts from 1 sigma to many sigma from the closed form
    expect(sigma(runs[0])).toBeLessThanOrEqual(1.0001);
    expect(sigma(runs[2])).toBeGreaterThan(2.5);
    expect(sigma(runs[3])).toBeGreaterThan(6);
    // and the error at the finest grid is many times what the tightened scan achieves with the same grid
    const tight = flatnessScan(CO2.a, CO2.b, 1600, 0.00125);
    expect(errors[3]).toBeGreaterThan(6 * (tight.tc - tC));
  });
});

describe('Z → 1 as v → ∞', () => {
  it('holds for argon at 300 K, the error falling monotonically (checked against ThermoLab at v = 1e-26)', () => {
    const vs = [1e-26, 1e-24, 1e-22, 1e-20];
    const errors = vs.map((v) => Math.abs(compressibilityFactor(vdwPressure(v, 300, ARGON.a, ARGON.b), v, 300) - 1));
    for (let i = 1; i < errors.length; i++) expect(errors[i]).toBeLessThan(errors[i - 1]);
    expect(errors[3]).toBeLessThan(1e-6);
    expect(compressibilityFactor(vdwPressure(1e-26, 300, ARGON.a, ARGON.b), 1e-26, 300)).toBeCloseTo(0.9963255089907078, 12);
  });
  it('holds in reduced variables: Z = (3/8) P_r v_r/T_r tends to 1 on every isotherm', () => {
    for (const t of [0.8, 1, 1.5]) {
      let prev = Infinity;
      for (const v of [10, 100, 1000, 1e5]) {
        const err = Math.abs((3 / 8) * (vdwPressureReduced(v, t) * v) / t - 1);
        expect(err).toBeLessThan(prev);
        prev = err;
      }
      expect(prev).toBeLessThan(1e-3);
    }
  });
});

describe('the reduced equation has no parameters', () => {
  it('gives P_r = 1 at the critical point, and ThermoLab’s value at (v_r, T_r) = (1.7, 0.85)', () => {
    expect(vdwPressureReduced(1, 1)).toBeCloseTo(1, 12);
    expect(vdwPressureReduced(1.7, 0.85)).toBeCloseTo(0.6204743016288294, 12);
  });
  it('is the same for argon and for CO₂: the same reduced state has the same P_r', () => {
    for (const [vR, tR] of [[1.7, 0.85], [0.6, 1.3], [4, 0.9]]) {
      const pR = vdwPressureReduced(vR, tR);
      for (const s of [ARGON, CO2]) {
        const c = vdwCriticalPoint(s.a, s.b);
        const p = vdwPressure(vR * c.vC, tR * c.tC, s.a, s.b);
        expect(reducedVariables(p, vR * c.vC, tR * c.tC, s.a, s.b).pR).toBeCloseTo(pR, 9);
        expect(p / c.pC).toBeCloseTo(pR, 9);
      }
    }
  });
  it('is the van der Waals equation rescaled: reducedVariables undoes the critical-point scaling', () => {
    const c = vdwCriticalPoint(ARGON.a, ARGON.b);
    const r = reducedVariables(c.pC * 0.7, c.vC * 2.1, c.tC * 0.9, ARGON.a, ARGON.b);
    expect([r.pR, r.vR, r.tR].map((x) => Number(x.toPrecision(12)))).toEqual([0.7, 2.1, 0.9]);
  });
});

describe('Z_c = 3/8', () => {
  it('holds for every substance, to rounding', () => {
    for (const s of [ARGON, CO2, { a: 1e-48, b: 3e-29 }, { a: 7e-50, b: 1e-29 }]) {
      const c = vdwCriticalPoint(s.a, s.b);
      expect(rel(compressibilityFactor(c.pC, c.vC, c.tC), 3 / 8)).toBeLessThan(1e-12);
    }
  });
  it('is Z of the reduced critical state: (3/8)·1·1/1', () => {
    expect(compressibilityReduced(1, 1, 1)).toBe(3 / 8);
    expect(compressibilityReduced(vdwPressureReduced(1, 1), 1, 1)).toBe(0.375);
  });
});

describe('the CO₂ constants from its critical data', () => {
  it('give a = 1.008e-48 Pa m⁶ and b = 7.115e-29 m³ per molecule (ThermoLab), i.e. 0.3657 Pa m⁶/mol² and 4.285e-5 m³/mol', () => {
    expect(rel(CO2.a, 1.008257438878698e-48)).toBeLessThan(1e-12);
    expect(rel(CO2.b, 7.114675768404429e-29)).toBeLessThan(1e-12);
    expect(CO2.a * N_A ** 2).toBeCloseTo(0.3657, 4);
    expect(CO2.b * N_A).toBeCloseTo(4.2846e-5, 9);
  });
  it('round-trip through the critical point: fit then read the critical point back', () => {
    const c = vdwCriticalPoint(CO2.a, CO2.b);
    expect(rel(c.tC, 304.13)).toBeLessThan(1e-12);
    expect(rel(c.pC, 7.3773e6)).toBeLessThan(1e-12);
    expect(rel(c.vC, 2.134402730521329e-28)).toBeLessThan(1e-12);
    const back = vdwConstantsFromCritical(vdwCriticalPoint(ARGON.a, ARGON.b).tC, vdwCriticalPoint(ARGON.a, ARGON.b).pC);
    expect(rel(back.a, ARGON.a)).toBeLessThan(1e-10);
    expect(rel(back.b, ARGON.b)).toBeLessThan(1e-10);
  });
  it('fits the textbook argon constants from the measured critical point to a few percent (ThermoLab: 3.760e-49, 5.348e-29)', () => {
    const f = vdwConstantsFromCritical(150.9, 4.87e6);
    expect(rel(f.a, 3.760104144639995e-49)).toBeLessThan(1e-12);
    expect(rel(f.b, 5.347534242813142e-29)).toBeLessThan(1e-12);
    expect(rel(f.a, ARGON.a)).toBeLessThan(0.02);
    expect(rel(f.b, ARGON.b)).toBeLessThan(0.02);
  });
});

describe('the reduced slope and the grids', () => {
  it('has ∂P_r/∂v_r that matches a central difference of the reduced equation', () => {
    for (const [v, t, m] of [[0.9, 0.85, 1], [2, 1.2, 0.6], [1.3, 1, 0.3]]) {
      const h = 1e-6;
      const num = (morphedPressureReduced(v + h, t, m) - morphedPressureReduced(v - h, t, m)) / (2 * h);
      expect(dPdvReduced(v, t, m)).toBeCloseTo(num, 5);
    }
  });
  it('makes an isotherm family and a surface of the right shape, ideal by default', () => {
    const vs = [1e-27, 2e-27, 4e-27];
    const ts = [200, 300];
    const fam = isothermFamily(vs, ts);
    expect(fam).toHaveLength(2);
    expect(fam[1][2]).toBeCloseTo((K_B * 300) / 4e-27, 6);
    const s = pvtSurface(vs, ts, ARGON.a, ARGON.b);
    expect(s.p[1][0]).toBeCloseTo(vdwPressure(1e-27, 300, ARGON.a, ARGON.b), 6);
    expect(s.v[0][1]).toBe(2e-27);
    expect(s.t[1][1]).toBe(300);
  });
});
