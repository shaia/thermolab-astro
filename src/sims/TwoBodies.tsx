/**
 * Two Einstein solids exchanging quanta, live (lesson 1.1, figure fig-1-1a). The model is src/physics/equilibrium.ts:
 * on every step one randomly chosen quantum hops to a randomly chosen oscillator of the pair. Temperatures are in
 * units of the quantum (ε/k_B), time in exchange steps.
 *
 * Left: the two bodies as blocks of oscillators, their areas in proportion to nA and nB, each oscillator shaded by
 * the quanta it holds; the last hop of the frame is drawn as a line from the oscillator the quantum left.
 * Right: T_A and T_B against the steps with the dashed mean curves T_eq + (T_0 − T_eq)(1 − 1/Q)^n and the dashed
 * T_eq; in the log view the gap |T_A − T_B| on a log axis with the straight line Δ₀ e^(−n/τ) of slope −1/τ.
 *
 * Steps may set { nA, nB, tA, tB, steps, seed, view }. Any of the first six restarts the run; `view` alone only
 * switches the plot. The run advances in steps, not in seconds: the same seed gives the same run at any frame
 * rate, and the loop stops when the figure is off screen or paused.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import {
  countQuanta,
  equilibriumTemperature,
  fromTemperatures,
  hopQuantum,
  placeQuanta,
  relaxationTime,
  temperatureA,
  temperatureB,
  totalQuanta,
  type TwoBodyState,
} from '~/physics/equilibrium';
import { uniform } from '~/physics/kinetics';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import {
  N_MAX,
  N_MIN,
  T_MAX,
  T_MIN,
  Trace,
  blockLayout,
  cleanCount,
  cleanNumber,
  logOfN,
  logRange,
  nFromLog,
  runLength,
  shadeOf,
  stepsPerFrame,
} from './core/equilibrium-view';
import { mix } from './core/ink';
import { niceMax, polyline } from './core/ising-view';
import { drawAxes, drawCurve, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

type View = 'linear' | 'log';
type TaskId = 'unequal' | 'no-overshoot' | 'same-size' | 'log-gap';

/** the longest a frame may hold the main thread [ms] */
const SLICE_MS = 10;
const MAX_POINTS = 1200;

const iso = (s: string) => `⁦${s}⁩`;
const MINUS = '−';

const TEXT = {
  en: {
    task: {
      unequal: 'Run the pair as it starts: A is small and hot, B large and cold. Does the common temperature land halfway between the two starts? If not, nearer to which, and why?',
      'no-overshoot': 'Run it once with A hotter, then once with B hotter. Do the two temperatures ever cross on the way to T_eq?',
      'same-size': 'Set nA equal to nB and run to the end. Where do the two temperatures meet?',
      'log-gap': 'Switch to the log view and run to the end. How straight is the gap, and what slope does it have?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: two bodies of oscillators exchanging energy quanta one at a time. On the left the oscillators shaded by their quanta, on the right the two temperatures against the number of steps, approaching one common temperature.',
    keys: 'Keys: space runs or pauses, Enter restarts with a new seed.',
    nA: 'oscillators in A, nA',
    nB: 'oscillators in B, nB',
    tA: 'start temperature of A, T_A',
    tB: 'start temperature of B, T_B',
    view: 'plot',
    viewName: { linear: 'temperatures', log: 'log of the gap' } satisfies Record<View, string>,
    run: 'Run',
    pause: 'Pause',
    step: 'Step',
    again: 'Restart with a new seed',
    steps: 'steps',
    xAxis: 'exchange steps',
    yAxis: { linear: 'temperature (ε/k_B)', log: 'gap |T_A − T_B| (ε/k_B, log)' } satisfies Record<View, string>,
    eq: 'T_eq',
    tau: 'τ',
    energy: 'total energy',
    describe: (v: { nA: number; nB: number; steps: number; total: number; tA: number; tB: number; teq: number }) =>
      `Body A of ${v.nA} oscillators and body B of ${v.nB}, after ${v.steps} of ${v.total} steps: T_A = ${v.tA.toFixed(2)}, T_B = ${v.tB.toFixed(2)}, equilibrium temperature ${v.teq.toFixed(2)}.`,
  },
  he: {
    task: {
      unequal: `הריצו את הזוג כפי שהוא מתחיל: A קטן וחם, B גדול וקר. האם הטמפרטורה המשותפת נוחתת באמצע בין שתי ההתחלות? אם לא, קרוב יותר לאיזו, ולמה?`,
      'no-overshoot': `הריצו פעם אחת כש-A חם יותר, ופעם אחת כש-B חם יותר. האם שתי הטמפרטורות חוצות זו את זו בדרך אל ${iso('T_eq')}?`,
      'same-size': `קבעו ${iso('nA')} שווה ל-${iso('nB')} והריצו עד הסוף. היכן נפגשות שתי הטמפרטורות?`,
      'log-gap': 'עברו לתצוגה הלוגריתמית והריצו עד הסוף. עד כמה ישר הפער, ומה השיפוע שלו?',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: שני גופים של מתנדים מחליפים קוונטים של אנרגיה אחד אחד. משמאל המתנדים, מוצללים לפי הקוונטים שלהם, ומימין שתי הטמפרטורות כפונקציה של מספר הצעדים, מתקרבות לטמפרטורה משותפת אחת.',
    keys: 'במקלדת: רווח מריץ או עוצר, אנטר מתחיל מחדש עם זרע חדש.',
    nA: 'מספר המתנדים ב-A',
    nB: 'מספר המתנדים ב-B',
    tA: 'טמפרטורת ההתחלה של A',
    tB: 'טמפרטורת ההתחלה של B',
    view: 'גרף',
    viewName: { linear: 'הטמפרטורות', log: 'לוגריתם הפער' } satisfies Record<View, string>,
    run: 'הרצה',
    pause: 'עצירה',
    step: 'צעד',
    again: 'התחלה מחדש עם זרע חדש',
    steps: 'צעדים',
    xAxis: 'צעדי החלפה',
    yAxis: { linear: `טמפרטורה (${iso('ε/k_B')})`, log: `הפער ${iso(`|T_A ${MINUS} T_B|`)} (${iso('ε/k_B')}, לוגריתמי)` } satisfies Record<View, string>,
    eq: 'T_eq',
    tau: 'τ',
    energy: 'אנרגיה כוללת',
    describe: (v: { nA: number; nB: number; steps: number; total: number; tA: number; tB: number; teq: number }) =>
      `גוף A של ${v.nA} מתנדים וגוף B של ${v.nB}, אחרי ${v.steps} מתוך ${v.total} צעדים: ${iso(`T_A = ${v.tA.toFixed(2)}`)}, ${iso(`T_B = ${v.tB.toFixed(2)}`)}, טמפרטורת שיווי המשקל ${iso(v.teq.toFixed(2))}.`,
  },
} satisfies Record<Lang, unknown>;

export interface TwoBodiesProps {
  id: string;
  lang: Lang;
  /** oscillators in A and in B, 10 to 2000 */
  nA?: number;
  nB?: number;
  /** starting temperatures in ε/k_B, 0.5 to 10 */
  tA?: number;
  tB?: number;
  /** run length in steps; default 6 Q, six times the total number of quanta */
  steps?: number;
  seed?: number;
  view?: View;
  tasks?: TaskId[];
}

interface Params {
  nA: number;
  nB: number;
  tA: number;
  tB: number;
  /** a fixed run length, or undefined for 6 Q */
  steps: number | undefined;
}

const fromProps = (p: TwoBodiesProps): Params => ({
  nA: cleanCount(p.nA, N_MIN, N_MAX, 100),
  nB: cleanCount(p.nB, N_MIN, N_MAX, 300),
  tA: cleanNumber(p.tA, T_MIN, T_MAX, 4),
  tB: cleanNumber(p.tB, T_MIN, T_MAX, 1),
  steps: typeof p.steps === 'number' && Number.isFinite(p.steps) && p.steps >= 1 ? p.steps : undefined,
});

interface Sim {
  state: TwoBodyState;
  rand: () => number;
  seed: number;
  pos: Int32Array;
  counts: Int32Array;
  qA: number;
  n: number;
  total: number;
  tau: number;
  trace: Trace;
  hop: { from: number; to: number } | null;
  done: boolean;
  lastT: number | null;
  /** which body started hotter, for the no-overshoot task */
  aHotter: boolean;
}

function newSim(p: Params, seed: number): Sim {
  const state = fromTemperatures(p.nA, p.nB, p.tA, p.tB);
  const rand = uniform(seed);
  const pos = placeQuanta(state, rand);
  const trace = new Trace(MAX_POINTS, 2);
  trace.push(0, temperatureA(state), temperatureB(state));
  return {
    state,
    rand,
    seed,
    pos,
    counts: countQuanta(pos, p.nA + p.nB),
    qA: state.qA,
    n: 0,
    total: runLength(state, p.steps),
    tau: relaxationTime(state),
    trace,
    hop: null,
    done: false,
    lastT: null,
    aHotter: state.qA / state.nA > state.qB / state.nB,
  };
}

/** `k` steps of the hop rule, oscillator by oscillator, with the bookkeeping the plot needs */
function advance(s: Sim, k: number, deadline = Infinity) {
  const { nA, nB } = s.state;
  const N = nA + nB;
  const Q = totalQuanta(s.state);
  for (let i = 0; i < k && s.n < s.total; i++) {
    const hop = hopQuantum(s.pos, N, s.rand);
    s.counts[hop.from]--;
    s.counts[hop.to]++;
    s.qA += (hop.to < nA ? 1 : 0) - (hop.from < nA ? 1 : 0);
    s.n++;
    s.hop = hop;
    s.trace.push(s.n, s.qA / nA, (Q - s.qA) / nB);
    if ((i & 63) === 63 && performance.now() > deadline) break;
  }
  if (s.n >= s.total) s.done = true;
}

export default function TwoBodies(props: TwoBodiesProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const base = fromProps(props);
  const baseSeed = typeof props.seed === 'number' && Number.isFinite(props.seed) ? Math.round(props.seed) : 1;
  const [params, setParams] = useState<Params>(base);
  const P = useRef(params);
  const [view, setViewState] = useState<View>(props.view === 'log' ? 'log' : 'linear');
  const V = useRef(view);
  const [running, setRunning] = useState(true);
  const run = useRef(true);
  const sim = useRef<Sim | null>(null);
  if (sim.current === null) sim.current = newSim(base, baseSeed);
  const [readout, setReadout] = useState({ n: 0, tA: temperatureA(sim.current.state), tB: temperatureB(sim.current.state) });
  const [live, setLive] = useState('');
  const lastReadout = useRef(0);
  const seen = useRef({ hotA: false, hotB: false });
  const invalidateRef = useRef(() => {});
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  const summary = () => {
    const s = sim.current!;
    return L.describe({
      nA: s.state.nA,
      nB: s.state.nB,
      steps: s.n,
      total: s.total,
      tA: s.qA / s.state.nA,
      tB: (totalQuanta(s.state) - s.qA) / s.state.nB,
      teq: totalQuanta(s.state) / (s.state.nA + s.state.nB),
    });
  };

  const setRun = (on: boolean) => {
    run.current = on;
    setRunning(on);
    sim.current!.lastT = null;
    if (!on) setLive(summary());
    invalidateRef.current();
  };
  const setView = (v: View) => {
    V.current = v;
    setViewState(v);
    invalidateRef.current();
  };
  /** a new run from the (patched) parameters; the seed moves on unless one is given */
  const restart = (patch: Partial<Params> = {}, seed?: number) => {
    const next = { ...P.current, ...patch };
    P.current = next;
    setParams(next);
    sim.current = newSim(next, seed ?? sim.current!.seed + 1);
    const s = sim.current;
    setReadout({ n: 0, tA: temperatureA(s.state), tB: temperatureB(s.state) });
    run.current = true;
    setRunning(true);
    setLive(summary());
    invalidateRef.current();
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const cur = P.current;
        const moves = ['nA', 'nB', 'tA', 'tB', 'steps', 'seed'].some((k) => k in st);
        if (st.view === 'linear' || st.view === 'log') setView(st.view);
        if (!moves) return;
        restart(
          {
            nA: cleanCount(st.nA, N_MIN, N_MAX, cur.nA),
            nB: cleanCount(st.nB, N_MIN, N_MAX, cur.nB),
            tA: cleanNumber(st.tA, T_MIN, T_MAX, cur.tA),
            tB: cleanNumber(st.tB, T_MIN, T_MAX, cur.tB),
            steps: 'steps' in st ? (typeof st.steps === 'number' && st.steps >= 1 ? st.steps : undefined) : cur.steps,
          },
          typeof st.seed === 'number' && Number.isFinite(st.seed) ? Math.round(st.seed) : undefined,
        );
      }),
    [props.id],
  );

  /** mark the tasks the finished run (and the view) satisfy */
  const check = () => {
    const s = sim.current!;
    const want = (t: TaskId) => props.tasks?.includes(t);
    const id = props.id;
    const unequalTemps = s.state.qA * s.state.nB !== s.state.qB * s.state.nA;
    if (s.done && unequalTemps) {
      if (s.aHotter) seen.current.hotA = true;
      else seen.current.hotB = true;
      const ratio = Math.max(s.state.nA, s.state.nB) / Math.min(s.state.nA, s.state.nB);
      if (want('unequal') && ratio >= 1.5) markTask(`${id}:unequal`);
      if (want('same-size') && s.state.nA === s.state.nB) markTask(`${id}:same-size`);
      if (want('no-overshoot') && seen.current.hotA && seen.current.hotB) markTask(`${id}:no-overshoot`);
      if (want('log-gap') && V.current === 'log') markTask(`${id}:log-gap`);
    }
  };

  const draw = ({ ctx, view: vw, palette: p, t }: FrameInfo) => {
    const s = sim.current!;
    const { nA, nB } = s.state;
    // advance by the frames that have passed, within a time slice; t stands still when motion is off or the figure is hidden
    if (run.current && !s.done && s.lastT !== null && t > s.lastT) advance(s, stepsPerFrame(s.total), performance.now() + SLICE_MS);
    s.lastT = t;
    if (s.done && run.current) {
      run.current = false;
      setRunning(false);
    }

    const Q = totalQuanta(s.state);
    const tA0 = temperatureA(s.state);
    const tB0 = temperatureB(s.state);
    const teq = Q / (nA + nB);
    const rate = 1 - 1 / Q;

    // ---- layout: side by side, or stacked on a phone
    const pad = 12;
    const blocks = narrow ? { x: pad, y: 28, w: vw.w - 2 * pad, h: vw.h * 0.34 - 28 } : { x: pad, y: 34, w: vw.w * 0.4 - pad, h: vw.h - 34 - pad };
    const gap = Math.max(6, blocks.w * 0.04);
    const lay = blockLayout(nA, nB, blocks.w, blocks.h, gap);
    const cell = lay.cell;
    const ox = blocks.x + (blocks.w - (lay.colsA + lay.colsB) * cell - gap) / 2;
    const oy = blocks.y + (blocks.h - lay.rows * cell) / 2;
    const xB0 = ox + lay.colsA * cell + gap;
    const cellXY = (i: number): [number, number] => {
      const inA = i < nA;
      const k = inA ? i : i - nA;
      return [(inA ? ox : xB0) + (Math.floor(k / lay.rows) + 0.5) * cell, oy + ((k % lay.rows) + 0.5) * cell];
    };

    // shade by quanta held: a ramp from the paper to the energy colour, saturating at twice the hottest start
    const cap = Math.max(2, Math.ceil(2 * Math.max(tA0, tB0)));
    const shades: string[] = [];
    for (let c = 0; c <= cap; c++) shades.push(mix(p.paper2, p.energy, 0.08 + 0.92 * shadeOf(c, cap)));
    const inset = cell >= 5 ? 0.5 : 0;
    for (let i = 0; i < nA + nB; i++) {
      const [cx, cy] = cellXY(i);
      ctx.fillStyle = shades[Math.min(cap, s.counts[i])];
      ctx.fillRect(cx - cell / 2 + inset, cy - cell / 2 + inset, cell - 2 * inset, cell - 2 * inset);
    }
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = p.hot;
    ctx.strokeRect(ox - 1, oy - 1, lay.colsA * cell + 2, lay.rows * cell + 2);
    ctx.strokeStyle = p.cold;
    ctx.strokeRect(xB0 - 1, oy - 1, lay.colsB * cell + 2, lay.rows * cell + 2);
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = p.hot;
    ctx.fillText(`A · ${nA}`, ox + (lay.colsA * cell) / 2, oy - 6);
    ctx.fillStyle = p.cold;
    ctx.fillText(`B · ${nB}`, xB0 + (lay.colsB * cell) / 2, oy - 6);
    // the last hop: a ring on the oscillator the quantum left, a line and a dot to the one it reached
    if (s.hop && s.n > 0) {
      const [fx, fy] = cellXY(s.hop.from);
      const [tx, ty] = cellXY(s.hop.to);
      ctx.strokeStyle = p.accent;
      ctx.fillStyle = p.accent;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx, fy, Math.max(3, cell * 0.8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx, ty, Math.max(2.5, cell * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ---- the plot
    const plotBox = narrow
      ? insetBox({ x: 0, y: vw.h * 0.34 + 6, w: vw.w, h: vw.h - vw.h * 0.34 - 6 }, { l: 54, r: 14, t: 26, b: 44 })
      : insetBox({ x: vw.w * 0.4 + 8, y: 0, w: vw.w * 0.6 - 8, h: vw.h }, { l: 56, r: 14, t: 34, b: 44 });
    const total = s.total;
    const gap0 = tA0 - tB0;
    const [xs, ta, tb] = [s.trace.xs, s.trace.series[0], s.trace.series[1]];
    let plot;
    if (V.current === 'linear') {
      plot = makePlot(plotBox, { min: 0, max: total, label: L.xAxis, format: (v) => String(Math.round(v)) }, { min: 0, max: niceMax(1.05 * Math.max(tA0, tB0), 1), label: L.yAxis.linear });
      drawAxes(ctx, plot, p, { dir });
      drawCurve(ctx, plot, () => teq, { color: p.ink2, width: 1.4, dash: [6, 5], samples: 2 });
      drawCurve(ctx, plot, (n) => teq + (tA0 - teq) * rate ** n, { color: p.hot, width: 1.6, dash: [5, 4] });
      drawCurve(ctx, plot, (n) => teq + (tB0 - teq) * rate ** n, { color: p.cold, width: 1.6, dash: [5, 4] });
      polyline(ctx, plot, xs, ta, p.hot, 1.8);
      polyline(ctx, plot, xs, tb, p.cold, 1.8);
    } else {
      const lo = Math.abs(gap0) * Math.exp(-total / s.tau) * 0.5;
      const range = logRange(lo, Math.abs(gap0));
      plot = makePlot(plotBox, { min: 0, max: total, label: L.xAxis, format: (v) => String(Math.round(v)) }, { ...range, scale: 'log', label: L.yAxis.log });
      drawAxes(ctx, plot, p, { dir });
      const gaps = xs.map((_, i) => Math.max(Math.abs(ta[i] - tb[i]), range.min));
      drawCurve(ctx, plot, (n) => Math.abs(gap0) * rate ** n, { color: p.ink, width: 1.6, dash: [6, 5] });
      polyline(ctx, plot, xs, gaps, p.accent, 1.8);
    }

    // legend: the curves are named in the plot, not only by colour
    ctx.save();
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ly = plotBox.y - (narrow ? 12 : 16);
    let lx = plotBox.x + 8;
    const legend: [string, string][] =
      V.current === 'linear'
        ? [
            [p.hot, '— T_A'],
            [p.cold, '— T_B'],
            [p.ink2, '- - T_eq'],
          ]
        : [
            [p.accent, '— |T_A − T_B|'],
            [p.ink, '- - Δ₀ e^(−n/τ)'],
          ];
    for (const [color, text] of legend) {
      ctx.fillStyle = color;
      ctx.fillText(text, lx, ly);
      lx += ctx.measureText(text).width + 16;
    }
    ctx.restore();

    // ---- readout and tasks, a few times a second, and the moment the run ends
    if (t - lastReadout.current > 0.2 || !run.current) {
      lastReadout.current = t;
      setReadout((r) => (r.n === s.n && !run.current ? r : { n: s.n, tA: s.qA / nA, tB: (Q - s.qA) / nB }));
      check();
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: running });
  invalidateRef.current = invalidate;
  useEffect(() => {
    invalidate();
    check();
  }, [view, narrow, props.lang]);

  const stepOnce = () => {
    const s = sim.current!;
    advance(s, stepsPerFrame(s.total));
    invalidate();
    setLive(summary());
    setReadout({ n: s.n, tA: s.qA / s.state.nA, tB: (totalQuanta(s.state) - s.qA) / s.state.nB });
    check();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      if (sim.current!.done) restart();
      else setRun(!run.current);
    } else if (e.key === 'Enter') restart();
    else return;
    e.preventDefault();
  };

  const s = sim.current;
  const Q = totalQuanta(s.state);
  const teq = equilibriumTemperature(s.state.nA, temperatureA(s.state), s.state.nB, temperatureB(s.state));
  const fmt = (v: number) => v.toFixed(3);

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${summary()} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 0.85 : 2}
      live={live}
      tasks={tasks}
      onReset={() => {
        setView(props.view === 'log' ? 'log' : 'linear');
        restart(fromProps(props), baseSeed);
      }}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          <span>
            {L.steps}: <bdi class="ltr"><b class="q">{readout.n}</b> / {s.total}</bdi>
          </span>
          <span>
            <bdi class="ltr">T_A = <b class="q">{fmt(readout.tA)}</b></bdi>
          </span>
          <span>
            <bdi class="ltr">T_B = <b class="q">{fmt(readout.tB)}</b></bdi>
          </span>
          <span>
            <bdi class="ltr">T_eq = <b class="q">{fmt(teq)}</b></bdi>
          </span>
          <span>
            <bdi class="ltr">τ = <b class="q">{s.tau.toFixed(1)}</b></bdi>
          </span>
          <span>
            {L.energy}: <bdi class="ltr"><b class="q">{Q}</b> ε</bdi>
          </span>
        </span>
      }
      controls={
        <>
          <Slider label={L.nA} min={logOfN(N_MIN)} max={logOfN(N_MAX)} step={0.01} value={logOfN(params.nA)} format={(v) => String(nFromLog(v))} onChange={(v) => restart({ nA: nFromLog(v) }, sim.current!.seed)} />
          <Slider label={L.nB} min={logOfN(N_MIN)} max={logOfN(N_MAX)} step={0.01} value={logOfN(params.nB)} format={(v) => String(nFromLog(v))} onChange={(v) => restart({ nB: nFromLog(v) }, sim.current!.seed)} />
          <Slider label={L.tA} min={T_MIN} max={T_MAX} step={0.1} value={params.tA} format={(v) => v.toFixed(1)} onChange={(v) => restart({ tA: Math.round(v * 10) / 10 }, sim.current!.seed)} />
          <Slider label={L.tB} min={T_MIN} max={T_MAX} step={0.1} value={params.tB} format={(v) => v.toFixed(1)} onChange={(v) => restart({ tB: Math.round(v * 10) / 10 }, sim.current!.seed)} />
          <div class="group" role="group" aria-label={L.view}>
            {(['linear', 'log'] as View[]).map((v) => (
              <Toggle key={v} label={L.viewName[v]} on={view === v} onChange={() => setView(v)} />
            ))}
          </div>
          <div class="group">
            <button
              type="button"
              class="toggle"
              aria-pressed={running}
              onClick={() => {
                if (sim.current!.done) restart();
                else setRun(!run.current);
              }}
            >
              {running ? L.pause : L.run}
            </button>
            <button type="button" class="toggle" onClick={stepOnce}>
              {L.step}
            </button>
            <button type="button" class="toggle" onClick={() => restart()}>
              {L.again}
            </button>
          </div>
        </>
      }
    />
  );
}
