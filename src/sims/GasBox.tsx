/**
 * The gas in a box (lesson 4.1, figure 4.1a): particles bouncing in a two-dimensional box on the
 * left, and on the right the pressure they exert on its walls, measured the way the derivation
 * defines it: the momentum handed to the walls, per unit time, per unit wall length.
 *
 * Two traces: the pressure over short windows (jagged: the violence underneath), and its running
 * average (calm: what a gauge shows), against the dashed ideal-gas value N k_B T / A. Every bounce
 * flashes on the wall it strikes. The model is src/physics/kinetics.ts, the same one the tests check.
 *
 * Simulated time runs at a fixed rate, set so an argon atom at 300 K crosses a 1 µm box in about
 * 1.5 s of real time. Heavier or colder particles therefore look slower, and a smaller box busier,
 * which is the point. Steps may set { n, temperature, mass, side }; any change restarts the gas.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import {
  ARGON_MASS,
  area,
  idealPressure,
  initialiseGas,
  maxStableDt,
  rmsSpeed,
  step,
  uniform,
  wallLength,
  type Gas,
  type Wall,
} from '~/physics/kinetics';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';

/** the particle numbers the slider offers; the lesson's steps use only these */
export const N_STEPS = [10, 20, 60, 100, 200, 500, 1000, 2000];
const MASSES = [1, 2, 4];
const T_REF = 300;
const SIDE_REF = 1; // µm
/** simulated seconds per real second: a 300 K argon atom crosses the 1 µm box in ~1.5 s */
const RATE = (SIDE_REF * 1e-6) / rmsSpeed(T_REF, ARGON_MASS) / 1.5;
/** the window over which the jagged trace is measured, in reference crossing times */
const WINDOW = 0.18;
const CROSS_REF = (SIDE_REF * 1e-6) / rmsSpeed(T_REF, ARGON_MASS);
const ASPECT = 2.05;

type TaskId = 'converge' | 'few' | 'heavy' | 'small-box';

const TEXT = {
  en: {
    task: {
      converge: 'Run the gas until the running average settles on the dashed line.',
      few: 'Set N = 20 or fewer and watch the gauge for a while. Does it ever settle?',
      heavy: 'At the same temperature, make the particles 2× or 4× heavier and measure again.',
      'small-box': 'Shrink the box (side 0.7 µm or less) at the same N and T.',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: a gas in a box and the pressure it exerts on the walls.',
    keys: 'Keys: arrows change N, Enter restarts.',
    n: 'particles N',
    t: 'temperature T',
    side: 'box side',
    mass: 'particle mass',
    argon: (k: number) => (k === 1 ? 'argon' : `${k}× argon`),
    measured: 'measured (running average)',
    previous: 'previous run',
    ratio: 'ratio',
    yAxis: 'pressure P (µN/m)',
    xAxis: 'time (ns)',
    window: 'short windows',
    describe: (n: number, t: number, m: number, side: number) => `${n} particles at ${t} K, mass ${m === 1 ? 'of argon' : `${m} times argon`}, in a box of side ${side} µm.`,
  },
  he: {
    task: {
      converge: 'הריצו את הסימולציה עד שהממוצע המצטבר מתייצב על הקו המקווקו.',
      few: 'קבעו N = 20 או פחות, והסתכלו במד הלחץ זמן מה. האם הוא מתייצב אי פעם?',
      heavy: 'באותה טמפרטורה, הגדילו את מסת החלקיקים פי 2 או פי 4 ומדדו שוב.',
      'small-box': 'הקטינו את הקופסה (צלע של 0.7 µm או פחות) באותם N ו-T.',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: גז בקופסה והלחץ שהוא מפעיל על הדפנות.',
    keys: 'במקלדת: חיצים משנים את N, אנטר מתחיל מחדש.',
    n: 'מספר החלקיקים N',
    t: 'הטמפרטורה T',
    side: 'צלע הקופסה',
    mass: 'מסת חלקיק',
    argon: (k: number) => (k === 1 ? 'ארגון' : `פי ${k} מארגון`),
    measured: 'נמדד (ממוצע מצטבר)',
    previous: 'הריצה הקודמת',
    ratio: 'יחס',
    yAxis: 'הלחץ P ‏(µN/m)',
    xAxis: 'זמן (ns)',
    window: 'חלונות קצרים',
    describe: (n: number, t: number, m: number, side: number) => `${n} חלקיקים ב-${t} K, ${m === 1 ? 'במסה של ארגון' : `במסה פי ${m} מארגון`}, בקופסה שצלעה ${side} µm.`,
  },
} satisfies Record<Lang, unknown>;

export interface GasBoxProps {
  id: string;
  lang: Lang;
  n?: number;
  temperature?: number;
  /** particle mass as a multiple of argon's */
  mass?: number;
  /** box side [µm] */
  side?: number;
  tasks?: TaskId[];
}

interface Params {
  n: number;
  temperature: number;
  mass: number;
  side: number;
}

interface Sim {
  gas: Gas;
  params: Params;
  /** simulated time [s] */
  t: number;
  impulse: number;
  winImpulse: number;
  winStart: number;
  /** [time ns, pressure µN/m] */
  windows: [number, number][];
  running: [number, number][];
  hits: { x: number; y: number; wall: Wall; age: number }[];
  lastFrame: number | null;
  seed: number;
}

const fromProps = (p: GasBoxProps): Params => ({ n: p.n ?? 60, temperature: p.temperature ?? T_REF, mass: p.mass ?? 1, side: p.side ?? SIDE_REF });

function newSim(params: Params, seed: number): Sim {
  const s = params.side * 1e-6;
  return {
    gas: initialiseGas(params.n, [s, s], params.temperature, params.mass * ARGON_MASS, uniform(seed)),
    params,
    t: 0,
    impulse: 0,
    winImpulse: 0,
    winStart: 0,
    windows: [],
    running: [],
    hits: [],
    lastFrame: null,
    seed,
  };
}

const micro = (pressure: number) => pressure * 1e6;
const fmt = (v: number) => (v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toFixed(3));

export default function GasBox(props: GasBoxProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const [params, setParams] = useState<Params>(() => fromProps(props));
  const [readout, setReadout] = useState({ measured: 0, elapsed: 0 });
  const [previous, setPrevious] = useState<{ params: Params; measured: number } | null>(null);
  const [live, setLive] = useState('');
  const sim = useRef<Sim>(newSim(params, 12));
  const lastReadout = useRef(0);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  /** restart with new parameters, remembering what the last run measured */
  const restart = (next: Params) => {
    const s = sim.current;
    // a run cut short by the next step has measured nothing worth comparing with
    if (s.t > 3 * CROSS_REF) setPrevious({ params: s.params, measured: micro(s.impulse / (s.t * wallLength(s.gas))) });
    sim.current = newSim(next, s.seed + 1);
    setParams(next);
    setReadout({ measured: 0, elapsed: 0 });
    setLive(L.describe(next.n, next.temperature, next.mass, next.side));
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const cur = sim.current.params;
        const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
        restart({ n: num(st.n, cur.n), temperature: num(st.temperature, cur.temperature), mass: num(st.mass, cur.mass), side: num(st.side, cur.side) });
      }),
    [props.id],
  );

  const draw = ({ ctx, view, palette: p, t }: FrameInfo) => {
    const s = sim.current;
    const g = s.gas;
    // advance the gas by the real time since the last frame
    if (s.lastFrame !== null && t > s.lastFrame) {
      let remaining = Math.min(0.05, t - s.lastFrame) * RATE;
      const dtMax = maxStableDt(g);
      while (remaining > 0) {
        const dt = Math.min(dtMax, remaining);
        const before = s.impulse;
        s.impulse += step(g, dt, (i, wall) => {
          if (s.hits.length < 600) s.hits.push({ x: g.x[i], y: g.y[i], wall, age: 0 });
        });
        s.winImpulse += s.impulse - before;
        s.t += dt;
        remaining -= dt;
        if (s.t - s.winStart >= WINDOW * CROSS_REF) {
          const wl = wallLength(g);
          const mid = (s.winStart + s.t) / 2;
          s.windows.push([mid * 1e9, micro(s.winImpulse / ((s.t - s.winStart) * wl))]);
          s.running.push([s.t * 1e9, micro(s.impulse / (s.t * wl))]);
          s.winImpulse = 0;
          s.winStart = s.t;
        }
      }
    }
    s.lastFrame = t;
    for (const h of s.hits) h.age += 1;
    s.hits = s.hits.filter((h) => h.age < 14);

    // ---- left: the box, drawn to scale against the largest box the slider allows
    const pad = 14;
    const panel = Math.min(view.h - 2 * pad, view.w * 0.44);
    const maxSide = 1.5;
    const boxPx = (panel * s.params.side) / maxSide;
    const bx = pad + (panel - boxPx) / 2;
    const by = pad + (panel - boxPx) / 2;
    const k = boxPx / g.lx;
    ctx.save();
    ctx.fillStyle = withAlpha(p.paper2, 0.9);
    ctx.fillRect(bx, by, boxPx, boxPx);
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, boxPx, boxPx);
    // bounces flash on the wall they strike
    for (const h of s.hits) {
      const a = 1 - h.age / 14;
      const hx = bx + (h.wall === 0 ? 0 : h.wall === 1 ? boxPx : h.x * k);
      const hy = by + boxPx - (h.wall === 2 ? 0 : h.wall === 3 ? boxPx : h.y * k);
      ctx.strokeStyle = withAlpha(p.hot, 0.85 * a);
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (h.wall < 2) {
        ctx.moveTo(hx, hy - 6);
        ctx.lineTo(hx, hy + 6);
      } else {
        ctx.moveTo(hx - 6, hy);
        ctx.lineTo(hx + 6, hy);
      }
      ctx.stroke();
    }
    const r = g.x.length > 600 ? 1.4 : g.x.length > 150 ? 2 : 3;
    ctx.fillStyle = p.ink;
    const tails = g.x.length <= 30;
    const vScale = (0.12 * boxPx) / rmsSpeed(T_REF, ARGON_MASS);
    for (let i = 0; i < g.x.length; i++) {
      const px = bx + g.x[i] * k;
      const py = by + boxPx - g.y[i] * k;
      if (tails) {
        ctx.strokeStyle = withAlpha(p.velocity, 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - g.vx[i] * vScale, py + g.vy[i] * vScale);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ---- right: the pressure gauge
    const ideal = micro(idealPressure(s.params.n, s.params.temperature, area(g)));
    const left = pad + panel + 18;
    const plotBox = insetBox({ x: left, y: 0, w: view.w - left, h: view.h }, { l: 52, r: 12, t: 14, b: 44 });
    const span = Math.max(20 * CROSS_REF * 1e9, (s.t * 1e9) * 1.15);
    const plot = makePlot(plotBox, { min: 0, max: span, label: L.xAxis }, { min: 0, max: 2.4 * ideal, label: L.yAxis });
    drawAxes(ctx, plot, p, { dir });
    drawCurve(ctx, plot, () => ideal, { color: p.hot, width: 1.6, dash: [6, 5], samples: 2 });
    const line = (pts: [number, number][], color: string, width: number) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotBox.x, plotBox.y, plotBox.w, plotBox.h);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(plot.px(x), plot.py(y)) : ctx.moveTo(plot.px(x), plot.py(y))));
      ctx.stroke();
      ctx.restore();
    };
    line(s.windows, withAlpha(p.cold, 0.35), 1.2);
    line(s.running, p.cold, 2.4);

    // tasks and the readout, a few times a second
    const crossings = s.t / CROSS_REF;
    if (s.running.length && t - lastReadout.current > 0.25) {
      lastReadout.current = t;
      const measured = s.running[s.running.length - 1][1];
      setReadout({ measured, elapsed: s.t });
      const id = props.id;
      const want = (task: TaskId) => props.tasks?.includes(task);
      if (want('converge') && crossings > 8 && Math.abs(measured / ideal - 1) < 0.05) markTask(`${id}:converge`);
      if (want('few') && s.params.n <= 20 && crossings > 12) markTask(`${id}:few`);
      if (want('heavy') && s.params.mass >= 2 && crossings > 8) markTask(`${id}:heavy`);
      if (want('small-box') && s.params.side <= 0.7 && crossings > 8) markTask(`${id}:small-box`);
    }
  };

  const { canvasRef } = useFigureCanvas(draw, { worldWidth: ASPECT, worldHeight: 1, animate: true });

  const ideal = micro(idealPressure(params.n, params.temperature, (params.side * 1e-6) ** 2));
  // the nearest stop, should a step ever ask for a number the slider does not offer
  const nIndex = N_STEPS.reduce((best, v, i) => (Math.abs(v - params.n) < Math.abs(N_STEPS[best] - params.n) ? i : best), 0);
  const set = (patch: Partial<Params>) => restart({ ...params, ...patch });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') set({ n: N_STEPS[Math.min(N_STEPS.length - 1, nIndex + 1)] });
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') set({ n: N_STEPS[Math.max(0, nIndex - 1)] });
    else if (e.key === 'Enter') set({});
    else return;
    e.preventDefault();
  };

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${L.describe(params.n, params.temperature, params.mass, params.side)} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={ASPECT}
      live={live}
      tasks={tasks}
      onReset={() => restart(fromProps(props))}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          <span>
            {L.measured}: <b class="q">{readout.measured ? fmt(readout.measured) : '…'} µN/m</b>
          </span>
          <span>
            <bdi class="ltr">
              Nk<sub>B</sub>T/A
            </bdi>
            : <b class="q">{fmt(ideal)} µN/m</b>
          </span>
          {readout.measured > 0 && (
            <span>
              {L.ratio}: <b class="q">{(readout.measured / ideal).toFixed(3)}</b>
            </span>
          )}
          {previous && (
            <span class="gas-previous">
              {L.previous}: <span class="q">N = {previous.params.n}, {previous.params.temperature} K, ×{previous.params.mass}, {previous.params.side} µm → {fmt(previous.measured)} µN/m</span>
            </span>
          )}
        </span>
      }
      controls={
        <>
          <Slider label={L.n} min={0} max={N_STEPS.length - 1} step={1} value={nIndex} format={(i) => String(N_STEPS[Math.round(i)])} onChange={(i) => set({ n: N_STEPS[Math.round(i)] })} />
          <Slider label={L.t} min={100} max={1000} step={50} value={params.temperature} format={(v) => `${v} K`} onChange={(v) => set({ temperature: v })} />
          <Slider label={L.side} min={0.5} max={1.5} step={0.1} value={params.side} format={(v) => `${v.toFixed(1)} µm`} onChange={(v) => set({ side: Math.round(v * 10) / 10 })} />
          <div class="group" role="group" aria-label={L.mass}>
            {MASSES.map((m) => (
              <Toggle key={m} label={L.argon(m)} on={params.mass === m} onChange={() => set({ mass: m })} />
            ))}
          </div>
        </>
      }
    />
  );
}

