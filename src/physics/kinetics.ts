/**
 * Kinetic theory: a gas of free particles in a rigid two-dimensional box, and the pressure it exerts.
 * A TypeScript port of `thermolab.kinetics` (the Python library behind the original course), so the
 * live figures run the same model the derivation describes. Tests: tests/physics/kinetics.test.ts.
 *
 * MODEL SPECIFICATION
 *   System:        N point particles of mass m in a rectangular 2D container, sides Lx × Ly
 *   Dynamics:      free flight between perfectly elastic collisions with the walls;
 *                  particles do not interact with one another
 *   Boundary:      rigid, fixed walls (a piston is modelled by changing the box size)
 *   Ensemble:      energy is exactly conserved; initial velocities are Maxwell–Boltzmann at T,
 *                  rescaled to the exact energy N k_B T (fixTemperature) or left as drawn
 *   Ignored:       intermolecular forces, particle size, quantum effects, gravity
 *   Valid when:    dilute classical gas: mean free path ≫ particle size, de Broglie wavelength ≪ spacing
 *   Failure modes: high density, low temperature, strong interactions
 *
 * In two dimensions "volume" is an area and the "area" of a wall is a length, so pressure is a
 * force per unit length (N/m). The ideal gas law keeps its form, P A = N k_B T.
 *
 * Because the particles never collide with each other, the model cannot *establish* a Maxwell–
 * Boltzmann distribution, only preserve one; that is why the distribution is imposed at t = 0.
 */

export const K_B = 1.380649e-23; // J/K, exact (SI 2019)
export const AMU = 1.6605390666e-27; // kg
export const ARGON_MASS = 39.948 * AMU;

/* ------------------------------------------------------------------ random numbers */

/** A seeded uniform generator on [0, 1): mulberry32. Same seed, same gas, on every machine. */
export function uniform(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal deviates from a uniform source, by Box–Muller (both values used). */
export function normal(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    const th = 2 * Math.PI * rand();
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
}

/* ------------------------------------------------------------------ the gas */

export interface Gas {
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  /** box sides [m] */
  lx: number;
  ly: number;
  /** mass per particle [kg] */
  m: number;
}

export const count = (g: Gas) => g.x.length;
/** Box area, the 2D "volume" [m²]. */
export const area = (g: Gas) => g.lx * g.ly;
/** Total wall length the pressure acts on, the 2D "wall area" [m]. */
export const wallLength = (g: Gas) => 2 * (g.lx + g.ly);

export function kineticEnergy(g: Gas): number {
  let s = 0;
  for (let i = 0; i < g.vx.length; i++) s += g.vx[i] * g.vx[i] + g.vy[i] * g.vy[i];
  return 0.5 * g.m * s;
}

/** Temperature read off the mean kinetic energy by equipartition: in 2D, ⟨E⟩ = k_B T per particle. */
export const kineticTemperature = (g: Gas) => kineticEnergy(g) / (count(g) * K_B);

/** The ideal gas law in 2D: P = N k_B T / A [N/m]. */
export const idealPressure = (n: number, temperature: number, a: number) => (n * K_B * temperature) / a;

/** Root-mean-square speed in 2D, √(2 k_B T / m). */
export const rmsSpeed = (temperature: number, m: number) => Math.sqrt((2 * K_B * temperature) / m);

export interface InitOptions {
  /** subtract the net momentum, so the box's rest frame is the gas's (default true) */
  removeDrift?: boolean;
  /**
   * rescale so the energy is exactly N k_B T (default true): a sharp-energy, microcanonical gas.
   * false keeps the raw Maxwell–Boltzmann draw, whose energy fluctuates from draw to draw as a
   * canonical system's does: the setting for studying fluctuations.
   */
  fixTemperature?: boolean;
}

/** N particles placed uniformly in the box, with Maxwell–Boltzmann velocities at `temperature`. */
export function initialiseGas(
  n: number,
  sides: [number, number],
  temperature: number,
  m: number,
  rand: () => number,
  { removeDrift = true, fixTemperature = true }: InitOptions = {},
): Gas {
  if (!(n >= 1) || !Number.isInteger(n)) throw new Error('the particle number must be a positive integer');
  const [lx, ly] = sides;
  if (!(lx > 0 && ly > 0)) throw new Error('box sides must be positive');
  if (!(temperature > 0 && m > 0)) throw new Error('temperature and mass must be positive');
  const gauss = normal(rand);
  const sigma = Math.sqrt((K_B * temperature) / m);
  const g: Gas = { x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n), lx, ly, m };
  for (let i = 0; i < n; i++) {
    g.x[i] = rand() * lx;
    g.y[i] = rand() * ly;
    g.vx[i] = sigma * gauss();
    g.vy[i] = sigma * gauss();
  }
  if (removeDrift && n > 1) {
    let mx = 0;
    let my = 0;
    for (let i = 0; i < n; i++) {
      mx += g.vx[i];
      my += g.vy[i];
    }
    for (let i = 0; i < n; i++) {
      g.vx[i] -= mx / n;
      g.vy[i] -= my / n;
    }
  }
  if (fixTemperature && n > 1) {
    const k = Math.sqrt((n * K_B * temperature) / kineticEnergy(g));
    for (let i = 0; i < n; i++) {
      g.vx[i] *= k;
      g.vy[i] *= k;
    }
  }
  return g;
}

/** A copy that the simulation may advance without touching the original. */
export const cloneGas = (g: Gas): Gas => ({ ...g, x: g.x.slice(), y: g.y.slice(), vx: g.vx.slice(), vy: g.vy.slice() });

/** Which wall a particle struck: 0 left (x = 0), 1 right, 2 bottom (y = 0), 3 top. */
export type Wall = 0 | 1 | 2 | 3;

/**
 * Advance the gas by dt, in place, and return the momentum given to the walls during the step.
 *
 * Free flight plus specular reflection is integrated exactly: a particle that would leave the box is
 * mirrored back, which is what the true trajectory does, so the result does not depend on dt as long
 * as no particle crosses a wall twice in one step (see `maxStableDt`). Each bounce hands the wall
 * twice the particle's normal momentum. `onHit` receives every bounce, for figures that draw them.
 */
export function step(g: Gas, dt: number, onHit?: (i: number, wall: Wall) => void): number {
  let impulse = 0;
  const { x, y, vx, vy, lx, ly, m } = g;
  for (let i = 0; i < x.length; i++) {
    x[i] += vx[i] * dt;
    y[i] += vy[i] * dt;
    if (x[i] < 0) {
      x[i] = -x[i];
      impulse += 2 * m * Math.abs(vx[i]);
      vx[i] = -vx[i];
      onHit?.(i, 0);
    } else if (x[i] > lx) {
      x[i] = 2 * lx - x[i];
      impulse += 2 * m * Math.abs(vx[i]);
      vx[i] = -vx[i];
      onHit?.(i, 1);
    }
    if (y[i] < 0) {
      y[i] = -y[i];
      impulse += 2 * m * Math.abs(vy[i]);
      vy[i] = -vy[i];
      onHit?.(i, 2);
    } else if (y[i] > ly) {
      y[i] = 2 * ly - y[i];
      impulse += 2 * m * Math.abs(vy[i]);
      vy[i] = -vy[i];
      onHit?.(i, 3);
    }
  }
  return impulse;
}

/** Largest step for which no particle crosses a wall twice: a validity limit of `step`, not an accuracy knob. */
export function maxStableDt(g: Gas, safety = 0.25): number {
  let fastest = 0;
  for (let i = 0; i < g.vx.length; i++) fastest = Math.max(fastest, Math.abs(g.vx[i]), Math.abs(g.vy[i]));
  return fastest === 0 ? Infinity : (safety * Math.min(g.lx, g.ly)) / fastest;
}

export interface Run {
  /** momentum given to the walls in each step */
  impulses: Float64Array;
  /** total kinetic energy after each step */
  energies: Float64Array;
  dt: number;
  gas: Gas;
}

/** Advance a copy of the gas by n steps of dt, recording the wall impulses and the energy. */
export function simulate(start: Gas, dt: number, n: number): Run {
  if (!(dt > 0) || !(n >= 1)) throw new Error('dt must be positive and the step count at least 1');
  if (dt > maxStableDt(start, 1)) throw new Error('dt lets a particle cross the box in one step: the reflection would not be exact');
  const g = cloneGas(start);
  const impulses = new Float64Array(n);
  const energies = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    impulses[k] = step(g, dt);
    energies[k] = kineticEnergy(g);
  }
  return { impulses, energies, dt, gas: g };
}

/** Measured pressure of a run: total wall impulse / (duration × wall length), optionally dropping a first fraction. */
export function measuredPressure(run: Run, wall: number, discard = 0): number {
  const start = Math.floor(discard * run.impulses.length);
  let s = 0;
  for (let k = start; k < run.impulses.length; k++) s += run.impulses[k];
  return s / ((run.impulses.length - start) * run.dt * wall);
}

/**
 * The pressure a given microstate produces in the long run, exactly.
 *
 * A particle bounces between the two x walls with period 2Lx/|vx| and hands each of them 2m|vx| per
 * visit: a steady force m vx²/Lx on each. Summed over particles and both pairs of walls, and divided
 * by the wall length, this is the time average the simulation converges to. In a square box it is
 * Σ m v² / (2A) = E/A, so a gas with energy exactly N k_B T obeys P A = N k_B T exactly.
 */
export function longTimePressure(g: Gas): number {
  let force = 0;
  for (let i = 0; i < g.vx.length; i++) force += (2 * g.m * g.vx[i] * g.vx[i]) / g.lx + (2 * g.m * g.vy[i] * g.vy[i]) / g.ly;
  return force / wallLength(g);
}

/**
 * Relative spread σ/⟨P⟩ of the long-time pressure over `samples` gases, each drawn afresh at the same
 * temperature (fixTemperature: false). The quantity whose N^(-1/2) law the lesson derives.
 */
export function pressureSpread(n: number, samples: number, rand: () => number, temperature = 300, m = ARGON_MASS, side = 1e-6): { mean: number; sd: number; values: Float64Array } {
  const values = new Float64Array(samples);
  for (let s = 0; s < samples; s++) {
    values[s] = longTimePressure(initialiseGas(n, [side, side], temperature, m, rand, { fixTemperature: false, removeDrift: false }));
  }
  let mean = 0;
  for (const v of values) mean += v;
  mean /= samples;
  let ss = 0;
  for (const v of values) ss += (v - mean) ** 2;
  return { mean, sd: Math.sqrt(ss / (samples - 1)), values };
}
