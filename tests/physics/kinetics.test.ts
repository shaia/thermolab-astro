/**
 * The claims lesson 4.1 makes about the kinetic model, each as a test, mirroring the Python suite
 * of the original course (tests/physics in thermolab): the equation of state across independent
 * seeds, exact energy conservation, equipartition, the cancelling mass, dt independence of the exact
 * reflection, and the N^(-1/2) law for the relative pressure fluctuation.
 */

import { describe, expect, it } from 'vitest';
import {
  ARGON_MASS,
  K_B,
  area,
  cloneGas,
  idealPressure,
  initialiseGas,
  kineticEnergy,
  kineticTemperature,
  longTimePressure,
  maxStableDt,
  measuredPressure,
  pressureSpread,
  rmsSpeed,
  simulate,
  step,
  uniform,
  wallLength,
} from '../../src/physics/kinetics';

const SIDE = 1e-6;
const T = 300;

/** A run long enough for every particle to cross the box about `crossings` times. */
function measure(n: number, seed: number, m = ARGON_MASS, side = SIDE, crossings = 60) {
  const g = initialiseGas(n, [side, side], T, m, uniform(seed));
  const dt = maxStableDt(g);
  const steps = Math.ceil((crossings * side) / rmsSpeed(T, m) / dt);
  const run = simulate(g, dt, steps);
  return { g, run, measured: measuredPressure(run, wallLength(g)), predicted: idealPressure(n, T, area(g)) };
}

describe('the equation of state', () => {
  it('the measured wall pressure agrees with N k_B T / A across eight independent seeds', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { measured, predicted } = measure(200, seed);
      expect(Math.abs(measured / predicted - 1)).toBeLessThan(0.03);
    }
  });

  it('the long-time pressure of a gas with energy exactly N k_B T is the ideal value exactly', () => {
    const g = initialiseGas(500, [SIDE, SIDE], T, ARGON_MASS, uniform(3));
    expect(longTimePressure(g) / idealPressure(500, T, area(g))).toBeCloseTo(1, 12);
  });

  it('the simulation converges on the long-time pressure, also in a box that is not square', () => {
    const g = initialiseGas(300, [2 * SIDE, 0.5 * SIDE], T, ARGON_MASS, uniform(11));
    const dt = maxStableDt(g);
    const run = simulate(g, dt, 6000);
    expect(measuredPressure(run, wallLength(g)) / longTimePressure(g)).toBeCloseTo(1, 1);
  });
});

describe('conservation and equipartition', () => {
  it('elastic reflection conserves the kinetic energy to machine precision', () => {
    const { run, g } = measure(100, 5);
    const e0 = kineticEnergy(g);
    for (const e of run.energies) expect(Math.abs(e / e0 - 1)).toBeLessThan(1e-12);
  });

  it('a gas drawn at T carries mean energy k_B T per particle in two dimensions', () => {
    const g = initialiseGas(1000, [SIDE, SIDE], T, ARGON_MASS, uniform(9));
    expect(kineticTemperature(g)).toBeCloseTo(T, 9);
    expect(kineticEnergy(g) / 1000).toBeCloseTo(K_B * T, 30);
  });

  it('removing the drift leaves no net momentum', () => {
    const g = initialiseGas(50, [SIDE, SIDE], T, ARGON_MASS, uniform(2));
    const px = g.vx.reduce((s, v) => s + v, 0);
    const py = g.vy.reduce((s, v) => s + v, 0);
    expect(Math.abs(px) + Math.abs(py)).toBeLessThan(1e-9);
  });
});

describe('the mass cancels', () => {
  it('four times the mass at the same temperature: half the speed, the same pressure', () => {
    expect(rmsSpeed(T, 4 * ARGON_MASS) / rmsSpeed(T, ARGON_MASS)).toBeCloseTo(0.5, 12);
    const light = measure(200, 4);
    const heavy = measure(200, 4, 4 * ARGON_MASS);
    expect(heavy.predicted).toBe(light.predicted);
    expect(Math.abs(heavy.measured / light.measured - 1)).toBeLessThan(0.04);
  });

  it('half the area, twice the pressure', () => {
    const big = measure(200, 6);
    const small = measure(200, 6, ARGON_MASS, SIDE / Math.SQRT2);
    expect(small.measured / big.measured).toBeCloseTo(2, 1);
  });
});

describe('the exact reflection', () => {
  it('does not depend on the step: one step of dt or two of dt/2 land every particle in the same place', () => {
    const g = initialiseGas(100, [SIDE, SIDE], T, ARGON_MASS, uniform(8));
    const dt = maxStableDt(g, 0.2);
    const a = cloneGas(g);
    const b = cloneGas(g);
    for (let k = 0; k < 400; k++) step(a, dt);
    for (let k = 0; k < 800; k++) step(b, dt / 2);
    for (let i = 0; i < 100; i++) {
      expect(Math.abs(a.x[i] - b.x[i])).toBeLessThan(1e-9 * SIDE);
      expect(Math.abs(a.vy[i] - b.vy[i])).toBeLessThan(1e-9);
    }
  });

  it('refuses a step long enough for a particle to cross the whole box', () => {
    const g = initialiseGas(10, [SIDE, SIDE], T, ARGON_MASS, uniform(1));
    expect(() => simulate(g, 10 * maxStableDt(g, 1), 5)).toThrow(/cross the box/);
  });
});

describe('fluctuations', () => {
  it('the relative pressure spread across freshly drawn gases is N^(-1/2)', () => {
    const rand = uniform(2024);
    const ns = [10, 100, 1000];
    const rel = ns.map((n) => {
      const { mean, sd } = pressureSpread(n, 600, rand);
      return sd / mean;
    });
    rel.forEach((r, i) => expect(r * Math.sqrt(ns[i])).toBeGreaterThan(0.88));
    rel.forEach((r, i) => expect(r * Math.sqrt(ns[i])).toBeLessThan(1.12));
    // the fitted exponent on a log-log plot
    const slope = Math.log(rel[2] / rel[0]) / Math.log(ns[2] / ns[0]);
    expect(slope).toBeGreaterThan(-0.56);
    expect(slope).toBeLessThan(-0.44);
  });

  it('the spread does not depend on the temperature or the mass', () => {
    const a = pressureSpread(100, 800, uniform(1), 300, ARGON_MASS);
    const b = pressureSpread(100, 800, uniform(1), 1000, 4 * ARGON_MASS);
    expect((b.sd / b.mean) / (a.sd / a.mean)).toBeCloseTo(1, 6);
  });
});
