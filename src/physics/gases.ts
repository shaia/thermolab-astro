/**
 * Equations of state: the ideal gas, the van der Waals correction and the critical point. A TypeScript port of
 * `thermolab.gases`, so the live figures of lesson 2.1 run the model the derivation describes.
 * Tests: tests/physics/gases.test.ts.
 *
 * MODEL SPECIFICATION
 *   System:        a fixed amount of gas described by macroscopic coordinates (P, v, T) alone
 *   Dynamics:      none; every function evaluates equilibrium states
 *   Boundary:      closed, N fixed
 *   Ensemble:      not applicable (macroscopic thermodynamics)
 *   Ignored:       all microscopic detail; a and b are phenomenological constants
 *   Valid when:    dilute classical (ideal) and moderate-density near-critical (vdW) regimes
 *   Failure modes: the sub-critical (∂P/∂v)_T > 0 region (module 14) and quantum-degenerate regimes (module 17)
 *
 * CONVENTION: per-particle volume v = V/N and per-particle constants a = a_m/N_A², b = b_m/N_A, so
 * P = k_B T/(v − b) − a/v².
 *
 * The reduced forms use the critical point of the FULL van der Waals gas as the unit: (v_c, T_c, P_c) = (3b, 8a/27k_Bb,
 * a/27b²). `morphedPressureReduced` is an addition to the Python: it scales a and b by a factor m ∈ [0, 1] while
 * keeping those units fixed, which is what the surface figure morphs.
 */

import { K_B } from './kinetics';

export { K_B };
/** Avogadro constant [1/mol], exact (SI 2019) */
export const N_A = 6.02214076e23;
/** molar gas constant [J/(mol K)] */
export const R_GAS = K_B * N_A;

/** Z_c = P_c v_c/(k_B T_c) for every van der Waals gas */
export const Z_CRITICAL = 3 / 8;

/** P = N k_B T/V */
export function idealGasPressure(nParticles: number, temperature: number, volume: number): number {
  if (!(volume > 0)) throw new RangeError('volume must be positive');
  return (nParticles * K_B * temperature) / volume;
}

/** T = P V/(N k_B) */
export const idealGasTemperature = (nParticles: number, pressure: number, volume: number) => (pressure * volume) / (nParticles * K_B);

/** P = k_B T/(v − b) − a/v², per particle. At a = b = 0 exactly the ideal gas. Throws unless v exceeds the excluded volume b. */
export function vdwPressure(v: number, temperature: number, a: number, b: number): number {
  if (!(v > b)) throw new RangeError(`per-particle volume must exceed the excluded volume b = ${b.toExponential(6)} m^3`);
  return (K_B * temperature) / (v - b) - a / (v * v);
}

export interface CriticalPoint {
  vC: number;
  tC: number;
  pC: number;
}

/** (v_c, T_c, P_c) = (3b, 8a/(27 k_B b), a/(27 b²)): properties of the substance alone, with no particle count in them. */
export function vdwCriticalPoint(a: number, b: number): CriticalPoint {
  if (!(a > 0) || !(b > 0)) throw new RangeError('a and b must be positive for a critical point to exist');
  return { vC: 3 * b, tC: (8 * a) / (27 * K_B * b), pC: a / (27 * b * b) };
}

/** Invert `vdwCriticalPoint`: a = 27 (k_B T_c)²/(64 P_c), b = k_B T_c/(8 P_c). The way a substance's a and b are fitted from its measured critical point. */
export function vdwConstantsFromCritical(tC: number, pC: number): { a: number; b: number } {
  return { a: (27 * (K_B * tC) ** 2) / (64 * pC), b: (K_B * tC) / (8 * pC) };
}

/** (P_r, v_r, T_r) = (P/P_c, v/v_c, T/T_c), each in units of its own critical value. */
export function reducedVariables(pressure: number, v: number, temperature: number, a: number, b: number): { pR: number; vR: number; tR: number } {
  const { vC, tC, pC } = vdwCriticalPoint(a, b);
  return { pR: pressure / pC, vR: v / vC, tR: temperature / tC };
}

/** The law of corresponding states, parameter-free: P_r = 8 T_r/(3 v_r − 1) − 3/v_r². a and b have scaled out. */
export const vdwPressureReduced = (vR: number, tR: number) => (8 * tR) / (3 * vR - 1) - 3 / (vR * vR);

/**
 * The reduced equation with a and b both multiplied by m, in the units of the full gas: P_r = 8 T_r/(3 v_r − m) − 3m/v_r².
 * m = 1 is `vdwPressureReduced`; m = 0 is the ideal gas, P_r = 8 T_r/(3 v_r). The critical point moves to
 * (v_r, T_r, P_r) = (m, 1, 1/m): the critical temperature is unchanged, a/b being unchanged.
 */
export const morphedPressureReduced = (vR: number, tR: number, m: number) => (8 * tR) / (3 * vR - m) - (3 * m) / (vR * vR);

/** ∂P_r/∂v_r at fixed T_r, for the morphed equation (m = 1 is van der Waals): −24 T_r/(3 v_r − m)² + 6m/v_r³. */
export const dPdvReduced = (vR: number, tR: number, m = 1) => (-24 * tR) / (3 * vR - m) ** 2 + (6 * m) / vR ** 3;

/** Z = P v/(k_B T): exactly 1 for an ideal gas, and a real gas's distance from it. */
export const compressibilityFactor = (pressure: number, v: number, temperature: number) => (pressure * v) / (K_B * temperature);

/** Z from reduced variables: Z = Z_c P_r v_r/T_r, with Z_c = 3/8 */
export const compressibilityReduced = (pR: number, vR: number, tR: number) => (Z_CRITICAL * pR * vR) / tR;

/** Pressure at every (temperature, v): rows are temperatures, columns volumes. Defaults to the ideal-gas family. */
export function isothermFamily(vGrid: ArrayLike<number>, temperatures: ArrayLike<number>, a = 0, b = 0): Float64Array[] {
  return Array.from(temperatures, (t) => Float64Array.from(vGrid, (v) => vdwPressure(v, t, a, b)));
}

/** (V, T, P) grids over v × T for surface rendering: each is `t.length` rows of `v.length` values. Defaults to the ideal-gas surface. */
export function pvtSurface(vGrid: ArrayLike<number>, tGrid: ArrayLike<number>, a = 0, b = 0): { v: Float64Array[]; t: Float64Array[]; p: Float64Array[] } {
  const vRow = Float64Array.from(vGrid);
  return {
    v: Array.from(tGrid, () => vRow.slice()),
    t: Array.from(tGrid, (t) => new Float64Array(vRow.length).fill(t)),
    p: isothermFamily(vRow, tGrid, a, b),
  };
}

/* ------------------------------------------------------------------ the flatness scan (laboratory Parts 4 and 8) */

/** The smallest |∂P/∂v| found anywhere along one isotherm, by central differences with h = hFraction · v. */
export function isothermMinAbsSlope(temperature: number, vGrid: ArrayLike<number>, a: number, b: number, hFraction = 1e-4): number {
  let best = Infinity;
  for (let i = 0; i < vGrid.length; i++) {
    const v = vGrid[i];
    const h = hFraction * v;
    const slope = Math.abs((vdwPressure(v + h, temperature, a, b) - vdwPressure(v - h, temperature, a, b)) / (2 * h));
    if (slope < best) best = slope;
  }
  return best;
}

export interface FlatnessScan {
  /** the first temperature, sweeping down from 1.3 T_c, whose flattest point is below the threshold [K] */
  tc: number;
  /** half a temperature-grid spacing: the DISCRETISATION uncertainty only [K] */
  uncertainty: number;
  /** the threshold on |∂P/∂v| that stopped the scan [Pa per m³ per particle] */
  threshold: number;
}

/**
 * Measure T_c without the closed form: sweep `nTemperatures` isotherms down from 1.3 T_c to 0.7 T_c over v from 1.2 b to
 * 6 v_c, and stop at the first whose flattest point has |∂P/∂v| below `thresholdFraction` · P_c/v_c. (Below T_c the loop
 * makes ∂P/∂v cross zero at ordinary points, so the scan trusts only the supercritical sweep.) The same scan as the
 * laboratory's `scan_for_t_c`. `uncertainty` covers the grid only: the threshold adds a bias of its own, so the threshold
 * must be tightened in step with the grid.
 */
export function flatnessScan(a: number, b: number, nTemperatures = 200, thresholdFraction = 0.01, nV = 2000): FlatnessScan {
  const { vC, tC, pC } = vdwCriticalPoint(a, b);
  const step = (0.7 * tC - 1.3 * tC) / (nTemperatures - 1);
  const vGrid = Float64Array.from({ length: nV }, (_, i) => 1.2 * b + ((6 * vC - 1.2 * b) * i) / (nV - 1));
  const threshold = thresholdFraction * (pC / vC);
  for (let i = 0; i < nTemperatures; i++) {
    const t = 1.3 * tC + step * i;
    if (isothermMinAbsSlope(t, vGrid, a, b) < threshold) return { tc: t, uncertainty: 0.5 * Math.abs(step), threshold };
  }
  return { tc: 0.7 * tC, uncertainty: 0.5 * Math.abs(step), threshold };
}
