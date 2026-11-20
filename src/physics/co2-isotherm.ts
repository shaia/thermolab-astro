/**
 * Carbon dioxide at 280 K, the real isotherm lesson 2.1's second figure overlays on the van der Waals curve, and the
 * critical constants that turn it into reduced variables. Copied from the NIST Chemistry WebBook with the file's own
 * header, which reads:
 *
 * CO2 isotherm at 280.00 K, NIST Chemistry WebBook, SRD 69 (Thermophysical Properties of Fluid Systems; Span-Wagner
 * reference equation of state), fetched 2026-11-20 from
 * https://webbook.nist.gov/cgi/fluid.cgi?Action=Load&ID=C124389&Type=IsoTherm&T=280 (PLow 0.4, PHigh 4.2, PInc 0.1;
 * and PLow 4.2, PHigh 12, PInc 0.5). Saturation at 280 K: P = 4.1607 MPa, rho_vap = 121.74, rho_liq = 883.58 kg/m3.
 * Critical point (same source): Tc = 304.1282 K, Pc = 7.3773 MPa, rho_c = 467.600 kg/m3. M = 44.0095 g/mol.
 * pressure_MPa, density_kg_m3, phase
 *
 * Columns below: pressure [MPa], density [kg/m³], phase. The two rows at 4.1607 MPa are the saturated vapour and liquid.
 * This replaces ThermoLab's hand-built data/co2-isotherm-280k.csv, which disagrees with NIST (P_sat 4.1663 against
 * 4.1607 MPa, the liquid density, vapour rows up to 2.9% off).
 */

/** CO2's critical point as the lesson uses it (NIST: T_c = 304.1282 K, rounded to 304.13 K; P_c = 7.3773 MPa) */
export const CO2_CRITICAL = { tC: 304.13, pC: 7.3773e6 } as const;
/** the isotherm's temperature [K] */
export const CO2_T = 280;
/** molar mass of CO2 [kg/mol] (NIST: 44.0095 g/mol) */
export const CO2_MOLAR_MASS = 44.0095e-3;

/** [pressure P [MPa], density [kg/m³], phase] at 280 K, in NIST's order (rising pressure) */
export const CO2_NIST_280K: readonly (readonly [number, number, 'vapor' | 'liquid'])[] = [
  [0.4, 7.7545, 'vapor'],
  [0.5, 9.7568, 'vapor'],
  [0.6, 11.787, 'vapor'],
  [0.7, 13.844, 'vapor'],
  [0.8, 15.932, 'vapor'],
  [0.9, 18.050, 'vapor'],
  [1.0, 20.199, 'vapor'],
  [1.1, 22.382, 'vapor'],
  [1.2, 24.599, 'vapor'],
  [1.3, 26.852, 'vapor'],
  [1.4, 29.142, 'vapor'],
  [1.5, 31.471, 'vapor'],
  [1.6, 33.841, 'vapor'],
  [1.7, 36.254, 'vapor'],
  [1.8, 38.712, 'vapor'],
  [1.9, 41.217, 'vapor'],
  [2.0, 43.772, 'vapor'],
  [2.1, 46.379, 'vapor'],
  [2.2, 49.042, 'vapor'],
  [2.3, 51.763, 'vapor'],
  [2.4, 54.547, 'vapor'],
  [2.5, 57.396, 'vapor'],
  [2.6, 60.316, 'vapor'],
  [2.7, 63.311, 'vapor'],
  [2.8, 66.387, 'vapor'],
  [2.9, 69.549, 'vapor'],
  [3.0, 72.805, 'vapor'],
  [3.1, 76.162, 'vapor'],
  [3.2, 79.630, 'vapor'],
  [3.3, 83.218, 'vapor'],
  [3.4, 86.939, 'vapor'],
  [3.5, 90.807, 'vapor'],
  [3.6, 94.838, 'vapor'],
  [3.7, 99.052, 'vapor'],
  [3.8, 103.48, 'vapor'],
  [3.9, 108.14, 'vapor'],
  [4.0, 113.08, 'vapor'],
  [4.1, 118.35, 'vapor'],
  [4.1607, 121.74, 'vapor'],
  [4.1607, 883.58, 'liquid'],
  [4.2, 884.10, 'liquid'],
  [4.7, 890.37, 'liquid'],
  [5.2, 896.17, 'liquid'],
  [5.7, 901.59, 'liquid'],
  [6.2, 906.68, 'liquid'],
  [6.7, 911.49, 'liquid'],
  [7.2, 916.05, 'liquid'],
  [7.7, 920.40, 'liquid'],
  [8.2, 924.56, 'liquid'],
  [8.7, 928.55, 'liquid'],
  [9.2, 932.38, 'liquid'],
  [9.7, 936.07, 'liquid'],
  [10.2, 939.64, 'liquid'],
];

/** [pressure P [Pa], molar volume V_m [m³/mol]]: V_m = M/ρ */
export const CO2_ISOTHERM_280K: readonly (readonly [number, number])[] = CO2_NIST_280K.map(([p, rho]) => [p * 1e6, CO2_MOLAR_MASS / rho] as const);
