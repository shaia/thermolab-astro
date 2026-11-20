/**
 * Pure helpers for the VdwIsotherm figure (lesson 2.1, fig-2-1b): where ∂P/∂v > 0 on a sub-critical isotherm, the
 * flattest slope on a curve, Z along it, and ThermoLab's CO₂ isotherm in reduced variables. No canvas in here; unit-tested
 * in tests/unit/isotherm-view.test.ts.
 *
 * Everything is in reduced variables (P_r, v_r, T_r), measured in units of the gas's own critical point, so one curve
 * serves every van der Waals substance. CO₂ enters only through its critical constants.
 */

import { CO2_CRITICAL, CO2_ISOTHERM_280K, CO2_T } from '~/physics/co2-isotherm';
import { compressibilityReduced, dPdvReduced, N_A, R_GAS, vdwConstantsFromCritical, vdwCriticalPoint, vdwPressureReduced } from '~/physics/gases';

/** T_r of the CO₂ data: 280 K over the critical temperature 304.13 K */
export const TR_CO2 = CO2_T / CO2_CRITICAL.tC;

export interface DataPoint {
  /** v_r = (V_m/N_A)/v_c */
  vR: number;
  /** P_r = P/P_c */
  pR: number;
  /** Z = P V_m/(R T) */
  z: number;
}

/** CO₂'s van der Waals constants (per particle), fitted from its critical point, and its critical volume per particle [m³] */
export function co2Constants() {
  const { a, b } = vdwConstantsFromCritical(CO2_CRITICAL.tC, CO2_CRITICAL.pC);
  return { a, b, vC: vdwCriticalPoint(a, b).vC };
}

/** The 280 K CO₂ data in reduced variables, in the CSV's order (v_r falls as the gas is compressed). */
export function co2Reduced(): DataPoint[] {
  const { vC } = co2Constants();
  return CO2_ISOTHERM_280K.map(([p, vm]) => ({ vR: vm / N_A / vC, pR: p / CO2_CRITICAL.pC, z: (p * vm) / (R_GAS * CO2_T) }));
}

/** The datum at v_r by linear interpolation of P_r in log v_r between the neighbouring data; null outside the data's range. */
export function dataAt(points: DataPoint[], vR: number): { pR: number; z: number } | null {
  const sorted = [...points].sort((p, q) => p.vR - q.vR);
  if (!(vR >= sorted[0].vR) || !(vR <= sorted[sorted.length - 1].vR)) return null;
  let i = 0;
  while (i < sorted.length - 2 && sorted[i + 1].vR < vR) i++;
  const lo = sorted[i];
  const hi = sorted[i + 1];
  const s = (Math.log(vR) - Math.log(lo.vR)) / (Math.log(hi.vR) - Math.log(lo.vR));
  const pR = lo.pR + (hi.pR - lo.pR) * s;
  return { pR, z: compressibilityReduced(pR, vR, TR_CO2) };
}

/** The ideal-gas isotherm in reduced variables, P_r = 8 T_r/(3 v_r): Z = 1 everywhere */
export const idealReduced = (vR: number, tR: number) => (8 * tR) / (3 * vR);

/** Z = P v/(k_B T) on the van der Waals isotherm, at v_r > 1/3 */
export const zVdw = (vR: number, tR: number) => compressibilityReduced(vdwPressureReduced(vR, tR), vR, tR);

/**
 * The stretch v_1 < v_r < v_2 of the isotherm T_r where (∂P/∂v)_T > 0, or null when there is none (T_r ≥ 1, where the
 * isotherm falls steadily). The ends solve 4 T_r v³ = (3v − 1)², whose left side minus right changes sign twice for
 * T_r < 1; T_r = (3v − 1)²/(4v³) peaks at v = 1 with value 1, so one root lies in (1/3, 1) and the other beyond 1.
 */
export function unstableInterval(tR: number): [number, number] | null {
  if (!(tR < 1) || !(tR > 0)) return null;
  const h = (v: number) => (3 * v - 1) ** 2 / (4 * v ** 3) - tR; // positive between the roots
  const bisect = (lo: number, hi: number) => {
    const rising = h(lo) < 0;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (h(mid) < 0 === rising) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  let far = 2;
  while (h(far) > 0) far *= 2;
  return [bisect(1 / 3, 1), bisect(1, far)];
}

/** T_r above which the isotherm has no inflection point: the maximum of (3v − 1)³/(8v⁴), at v_r = 4/3, is 1.0678 */
export const T_NO_INFLECTION = (3 * (4 / 3) - 1) ** 3 / (8 * (4 / 3) ** 4);

export type SlopeReadout =
  /** 1 ≤ T_r ≤ 1.068: −∂P_r/∂v_r at the inflection point (∂²P_r/∂v_r² = 0) nearest the critical volume; zero at T_r = 1 (v_r = 1), shrinking to zero as T_r → 1 from above */
  | { kind: 'slope'; slope: number; vR: number }
  /** T_r > 1.068: the isotherm is convex everywhere and has no inflection point */
  | { kind: 'convex' }
  /** T_r < 1: the stretch of v_r where ∂P_r/∂v_r > 0 */
  | { kind: 'interval'; from: number; to: number };

/**
 * What the figure reads off the isotherm's flatness, following ThermoLab: below T_r = 1 the interval where ∂P/∂v > 0;
 * from T_r = 1 up to 1.068 the slope at the inflection point, where ∂²P/∂v² = 0 means T_r = (3v − 1)³/(8v⁴) (the root
 * on the side below v_r = 4/3, where that function rises to its maximum 1.068); above that there is no inflection.
 */
export function slopeReadout(tR: number): SlopeReadout {
  const band = unstableInterval(tR);
  if (band) return { kind: 'interval', from: band[0], to: band[1] };
  if (tR > T_NO_INFLECTION) return { kind: 'convex' };
  const g = (v: number) => (3 * v - 1) ** 3 / (8 * v ** 4);
  let lo = 1 / 3;
  let hi = 4 / 3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) < tR) lo = mid;
    else hi = mid;
  }
  const v = (lo + hi) / 2;
  return { kind: 'slope', slope: -dPdvReduced(v, tR), vR: v };
}

/** The lowest and highest P_r (clamped to [floor, cap]) of the vdW isotherm over [vLo, vHi], for choosing the y axis. */
export function pressureSpan(tR: number, vLo: number, vHi: number, floor = -2, cap = 3): { lo: number; hi: number } {
  let lo = Infinity;
  let hi = -Infinity;
  const v0 = Math.max(vLo, 1 / 3 + 1e-3);
  for (let i = 0; i <= 400; i++) {
    const v = v0 * (vHi / v0) ** (i / 400);
    const p = vdwPressureReduced(v, tR);
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  return { lo: Math.max(floor, lo), hi: Math.min(cap, hi) };
}
