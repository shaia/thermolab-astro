/**
 * The claims lesson 0.1 makes about line integrals of differential forms: the nine path integrals of its figure,
 * the loop, and exactness by mixed partials. The numbers were checked against ThermoLab's Python
 * (thermolab.forms.line_integral on the same polylines, to 1e-9).
 */

import { describe, expect, it } from 'vitest';
import {
  FORMS,
  cumulativeLineIntegral,
  formIntegral,
  isExact,
  lineIntegral,
  mixedPartials,
  mixedPartialsGap,
  pathPoints,
  type FormName,
  type PathName,
} from '../../src/physics/forms';

const LN2 = Math.LN2;

// the brief's table, to the digits it quotes
const BRIEF: Record<FormName, Record<'a' | 'b' | 'c', number>> = {
  exact: { a: 3, b: 3, c: 3 },
  inexact: { a: 1, b: 2, c: 1.5 },
  heat: { a: 2.193, b: 2.886, c: 2.5 },
  entropy: { a: 1.733, b: 1.733, c: 1.733 },
};

// ThermoLab, thermolab.forms.line_integral on polylines of 2000 segments per leg
const PYTHON: Record<FormName, Record<'a' | 'b' | 'c', number>> = {
  exact: { a: 3, b: 3, c: 3 },
  inexact: { a: 1, b: 2, c: 1.5 },
  heat: { a: 2.193147196185, b: 2.88629439237, c: 2.5 },
  entropy: { a: 1.732867990462, b: 1.732867990462, c: 1.732867990462 },
};

const FORM_NAMES: FormName[] = ['exact', 'inexact', 'heat', 'entropy'];
const PATHS = ['a', 'b', 'c'] as const;

describe('the path integrals from A = (1, 1) to B = (2, 2)', () => {
  for (const form of FORM_NAMES) {
    for (const p of PATHS) {
      it(`${form}, path ${p}: closed form, brief and ThermoLab agree`, () => {
        const got = formIntegral(form, p);
        expect(got).toBeCloseTo(FORMS[form].closedForm[p], 6);
        expect(got).toBeCloseTo(BRIEF[form][p], 3);
        expect(got).toBeCloseTo(PYTHON[form][p], 9);
      });
    }
  }

  it('has the closed forms the lesson quotes', () => {
    expect(FORMS.heat.closedForm.a).toBeCloseTo(1.5 + LN2, 14);
    expect(FORMS.heat.closedForm.b).toBeCloseTo(1.5 + 2 * LN2, 14);
    expect(FORMS.entropy.closedForm.a).toBeCloseTo(2.5 * LN2, 14);
  });

  it('is path-independent for the exact forms and path-dependent for the others', () => {
    for (const form of ['exact', 'entropy'] as const) {
      const v = PATHS.map((p) => formIntegral(form, p));
      expect(Math.max(...v) - Math.min(...v)).toBeLessThan(1e-6);
    }
    for (const form of ['inexact', 'heat'] as const) {
      const v = PATHS.map((p) => formIntegral(form, p));
      expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(0.4);
    }
  });

  it('converges at second order in the spacing (the trapezoid rule)', () => {
    const err = (k: number) => Math.abs(formIntegral('entropy', 'a', k) - 2.5 * LN2);
    expect(err(20) / err(40)).toBeGreaterThan(3.7);
    expect(err(20) / err(40)).toBeLessThan(4.3);
  });
});

describe('the closed loop a - b', () => {
  const loop: Record<FormName, number> = { exact: 0, inexact: -1, heat: -LN2, entropy: 0 };
  for (const form of FORM_NAMES) {
    it(`${form}: ${loop[form].toFixed(4)}`, () => {
      expect(formIntegral(form, 'loop')).toBeCloseTo(loop[form], 6);
      expect(formIntegral(form, 'loop')).toBeCloseTo(formIntegral(form, 'a') - formIntegral(form, 'b'), 9);
    });
  }
  it('closes: it ends where it began', () => {
    const p = pathPoints('loop');
    expect([p.x[0], p.y[0]]).toEqual([p.x[p.x.length - 1], p.y[p.y.length - 1]]);
  });
});

describe('cumulative integral', () => {
  it('starts at 0, ends at the line integral, and is the integral up to each point', () => {
    const f = FORMS.heat;
    const p = pathPoints('b', 500);
    const c = cumulativeLineIntegral(f.m, f.n, p.x, p.y);
    expect(c[0]).toBe(0);
    expect(c[c.length - 1]).toBeCloseTo(lineIntegral(f.m, f.n, p.x, p.y), 14);
    // halfway along path b is the corner (1, 2): 3/2 dT at V = 1
    expect(c[500]).toBeCloseTo(1.5, 12);
  });
  it('refuses a path of one point', () => {
    expect(() => lineIntegral(FORMS.exact.m, FORMS.exact.n, [1], [1])).toThrow();
  });
});

describe('exactness by mixed partials', () => {
  const grid = (() => {
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i <= 10; i++)
      for (let j = 0; j <= 10; j++) {
        x.push(1 + i / 10);
        y.push(1 + j / 10);
      }
    return { x, y };
  })();

  it('declares exact and entropy exact, inexact and heat not, over the whole square [1, 2]^2', () => {
    const verdict = (f: FormName) => isExact(FORMS[f].m, FORMS[f].n, grid.x, grid.y);
    expect(verdict('exact')).toBe(true);
    expect(verdict('entropy')).toBe(true);
    expect(verdict('inexact')).toBe(false);
    expect(verdict('heat')).toBe(false);
  });

  it('gives the gaps ThermoLab gives (1 for y dx; 1/V for the heat form)', () => {
    const x = [1.3, 1.7];
    const y = [1.2, 1.9];
    expect(Array.from(mixedPartialsGap(FORMS.inexact.m, FORMS.inexact.n, x, y))).toEqual([expect.closeTo(1, 8), expect.closeTo(1, 8)]);
    const g = mixedPartialsGap(FORMS.heat.m, FORMS.heat.n, x, y);
    expect(g[0]).toBeCloseTo(0.76923077, 7);
    expect(g[1]).toBeCloseTo(0.58823529, 7);
  });

  it('reports the two partials separately', () => {
    const { dMdy, dNdx } = mixedPartials(FORMS.exact.m, FORMS.exact.n, 1.4, 1.6);
    expect(dMdy).toBeCloseTo(1, 8);
    expect(dNdx).toBeCloseTo(1, 8);
    const h = mixedPartials(FORMS.heat.m, FORMS.heat.n, 2, 1.5);
    expect(h.dMdy).toBeCloseTo(0.5, 8);
    expect(h.dNdx).toBeCloseTo(0, 8);
  });

  it('holds the verdict to path independence: every form decided exact has equal integrals on all paths', () => {
    for (const f of FORM_NAMES) {
      const exact = isExact(FORMS[f].m, FORMS[f].n, grid.x, grid.y);
      const v = (['a', 'b', 'c'] as PathName[]).map((p) => formIntegral(f, p));
      expect(Math.max(...v) - Math.min(...v) < 1e-6).toBe(exact);
    }
  });
});
