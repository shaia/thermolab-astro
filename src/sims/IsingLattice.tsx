/**
 * The Ising lattice, live (lesson 15.1, figure 15.1a): spins on the left, and on the right the signed
 * magnetization m and the energy per spin e against sweeps, so that a reversal of the sign is visible.
 * The model is src/physics/ising.ts, the chain the tests check: checkerboard Metropolis or Glauber updates
 * on a periodic L × L lattice, in reduced units (energy in J, temperature k_BT/J, field h/J).
 *
 * Dashed lines mark ±m₀, Onsager and Yang's exact spontaneous magnetization, below T_c at h = 0. The
 * temperature and field sliders act on the running lattice (heat it, cool it); size, start and rule restart.
 * Steps may set { size, temperature, field, start, rule }; any step restarts the run from the chosen start.
 * The run is cheap (a 128 × 128 lattice is 16 000 updates per sweep), so it advances on the main thread in
 * a few milliseconds per frame, never more than a time slice.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import {
  alignedState,
  branchFlips,
  eOf,
  mOf,
  onsagerMagnetization,
  onsagerTc,
  randomState,
  sweep,
  uniform,
  withField,
  type IsingState,
  type Rand,
  type Rule,
} from '~/physics/ising';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { SpinImage, niceMax, polyline } from './core/ising-view';
import { drawAxes, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

export const SIZES = [8, 16, 32, 64, 128];
const SPEEDS = [1, 2, 5, 10, 25, 50];
const TC = onsagerTc();
/** the most history points kept; past it every other one is dropped and the stride doubles */
const MAX_POINTS = 1200;
/** the longest the run may hold the main thread in one frame [ms] */
const SLICE_MS = 10;

type TaskId = 'quench' | 'hot' | 'critical' | 'flip' | 'glauber';
type Start = 'random' | 'up';

const TEXT = {
  en: {
    task: {
      quench: 'Quench a random start to T = 1.6 or below and run until |m| passes 0.9.',
      hot: 'Run at least 300 sweeps at T = 3.5 or above. Do domains ever form?',
      critical: 'Hold T within 0.06 of 2.269 at h = 0 for 500 sweeps.',
      flip: 'On a lattice of 16 or fewer, watch the sign of m reverse.',
      glauber: 'Switch to the Glauber rule and run 200 sweeps.',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: an Ising lattice of up and down spins, and its magnetization and energy per spin against the number of sweeps.',
    keys: 'Keys: space runs or pauses, up and down arrows change T, left and right arrows change h, Enter restarts.',
    t: 'temperature T',
    h: 'field h',
    size: 'lattice side L',
    start: 'start',
    random: 'random',
    up: 'all up',
    rule: 'update rule',
    metropolis: 'Metropolis',
    glauber: 'Glauber',
    speed: 'sweeps per frame',
    run: 'Run',
    pause: 'Pause',
    step: 'Step',
    restart: 'Restart',
    sweeps: 'sweeps',
    xAxis: 'sweeps',
    yAxis: 'magnetization m and energy e/J per spin',
    m: 'm',
    e: 'e',
    exact: 'exact m₀ at this T',
    describe: (p: { size: number; temperature: number; field: number; start: Start; rule: Rule }, sweeps: number, m: number, e: number) =>
      `${p.size} by ${p.size} lattice at T = ${p.temperature.toFixed(2)}, h = ${p.field.toFixed(2)}, ${p.rule} rule, from a ${p.start === 'random' ? 'random' : 'fully aligned'} start. After ${sweeps} sweeps: magnetization ${m.toFixed(2)}, energy ${e.toFixed(2)} per spin.`,
  },
  he: {
    task: {
      quench: 'צננו התחלה אקראית ל-T = 1.6 או פחות, והריצו עד ש-|m| עובר את 0.9.',
      hot: 'הריצו לפחות 300 סריקות ב-T = 3.5 ומעלה. האם נוצרים תחומים?',
      critical: 'החזיקו את T בטווח 0.06 מ-2.269 ב-h = 0 במשך 500 סריקות.',
      flip: 'בסריג של 16 או פחות, צפו בסימן של m מתהפך.',
      glauber: 'עברו לכלל גלאובר והריצו 200 סריקות.',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: סריג איזינג של ספינים מעלה ומטה, והמגנוט והאנרגיה לספין כפונקציה של מספר הסריקות.',
    keys: 'במקלדת: רווח מריץ או עוצר, חיצי מעלה ומטה משנים את T, חיצי ימין ושמאל משנים את h, אנטר מתחיל מחדש.',
    t: 'הטמפרטורה T',
    h: 'השדה h',
    size: 'צלע הסריג L',
    start: 'התחלה',
    random: 'אקראית',
    up: 'הכול למעלה',
    rule: 'כלל העדכון',
    metropolis: 'מטרופוליס',
    glauber: 'גלאובר',
    speed: 'סריקות בפריים',
    run: 'הרצה',
    pause: 'עצירה',
    step: 'צעד',
    restart: 'התחלה מחדש',
    sweeps: 'סריקות',
    xAxis: 'סריקות',
    yAxis: 'מגנוט ואנרגיה לספין',
    m: 'm',
    e: 'e',
    exact: 'm₀ המדויק ב-T זה',
    describe: (p: { size: number; temperature: number; field: number; start: Start; rule: Rule }, sweeps: number, m: number, e: number) =>
      `סריג ${p.size} על ${p.size} ב-T = ${p.temperature.toFixed(2)}, h = ${p.field.toFixed(2)}, כלל ${p.rule === 'metropolis' ? 'מטרופוליס' : 'גלאובר'}, מהתחלה ${p.start === 'random' ? 'אקראית' : 'מסודרת לגמרי'}. אחרי ${sweeps} סריקות: מגנוט ${m.toFixed(2)}, אנרגיה ${e.toFixed(2)} לספין.`,
  },
} satisfies Record<Lang, unknown>;

export interface IsingLatticeProps {
  id: string;
  lang: Lang;
  /** lattice side L */
  size?: 8 | 16 | 32 | 64 | 128;
  /** k_B T / J */
  temperature?: number;
  /** h / J */
  field?: number;
  start?: Start;
  rule?: Rule;
  tasks?: TaskId[];
}

interface Params {
  size: number;
  temperature: number;
  field: number;
  start: Start;
  rule: Rule;
  speed: number;
}

interface Sim {
  state: IsingState;
  rand: Rand;
  seed: number;
  /** what the run started from, for the quench task */
  start: Start;
  sweeps: number;
  stride: number;
  xs: number[];
  ms: number[];
  es: number[];
  /** per-sweep m not yet scanned for reversals, and the branch (±1, 0 before the first) the scan stands on */
  pending: number[];
  branch: number;
  flips: number;
  /** consecutive sweeps under the task's condition */
  hot: number;
  critical: number;
  glauber: number;
  image: SpinImage;
  lastT: number | null;
}

const fromProps = (p: IsingLatticeProps): Params => ({
  size: p.size ?? 64,
  temperature: p.temperature ?? 1.5,
  field: p.field ?? 0,
  start: p.start ?? 'random',
  rule: p.rule ?? 'metropolis',
  speed: 5,
});

function newSim(p: Params, seed: number): Sim {
  const rand = uniform(seed);
  const state = p.start === 'random' ? randomState(p.size, rand, p.field) : alignedState(p.size, true, p.field);
  return {
    state,
    rand,
    seed,
    start: p.start,
    sweeps: 0,
    stride: 1,
    xs: [0],
    ms: [mOf(state)],
    es: [eOf(state)],
    pending: [],
    branch: 0,
    flips: 0,
    hot: 0,
    critical: 0,
    glauber: 0,
    image: new SpinImage(p.size),
    lastT: null,
  };
}

/** one sweep at the current parameters, with the bookkeeping the tasks and the plot need */
function advance(s: Sim, p: Params) {
  if (s.state.field !== p.field) withField(s.state, p.field);
  sweep(s.state, p.temperature, s.rand, p.rule);
  s.sweeps++;
  const m = mOf(s.state);
  s.pending.push(m);
  if (s.sweeps % s.stride === 0) {
    s.xs.push(s.sweeps);
    s.ms.push(m);
    s.es.push(eOf(s.state));
    if (s.xs.length > MAX_POINTS) {
      s.xs = s.xs.filter((_, i) => i % 2 === 0);
      s.ms = s.ms.filter((_, i) => i % 2 === 0);
      s.es = s.es.filter((_, i) => i % 2 === 0);
      s.stride *= 2;
    }
  }
  s.hot = p.temperature >= 3.5 ? s.hot + 1 : 0;
  s.critical = Math.abs(p.temperature - TC) < 0.06 && p.field === 0 ? s.critical + 1 : 0;
  s.glauber = p.rule === 'glauber' ? s.glauber + 1 : 0;
}

/** count the reversals among the sweeps since the last scan, continuing from the branch the last scan ended on */
function scanFlips(s: Sim) {
  const chunk = s.branch ? [0.9 * s.branch, ...s.pending] : s.pending;
  s.flips += branchFlips(chunk, 0.5);
  for (let i = s.pending.length - 1; i >= 0; i--) {
    if (Math.abs(s.pending[i]) > 0.5) {
      s.branch = Math.sign(s.pending[i]);
      break;
    }
  }
  s.pending = [];
}

export default function IsingLattice(props: IsingLatticeProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const [params, setParams] = useState<Params>(() => fromProps(props));
  const P = useRef(params);
  const [running, setRunning] = useState(true);
  const run = useRef(true);
  const [readout, setReadout] = useState({ sweeps: 0, m: 0, e: 0 });
  const [live, setLive] = useState('');
  const sim = useRef<Sim>(newSim(params, 1));
  const lastReadout = useRef(0);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  const describe = () => L.describe(P.current, sim.current.sweeps, mOf(sim.current.state), eOf(sim.current.state));
  const setP = (next: Params) => {
    P.current = next;
    setParams(next);
  };
  /** change what a running lattice feels: no restart */
  const tune = (patch: Partial<Params>) => {
    setP({ ...P.current, ...patch });
    invalidateRef.current();
  };
  /** change the lattice itself: restart from the chosen start */
  const restart = (patch: Partial<Params> = {}) => {
    const next = { ...P.current, ...patch };
    sim.current = newSim(next, sim.current.seed + 1);
    setP(next);
    setReadout({ sweeps: 0, m: 0, e: 0 });
    setLive(L.describe(next, 0, mOf(sim.current.state), eOf(sim.current.state)));
    invalidateRef.current();
  };
  const invalidateRef = useRef(() => {});
  const setRun = (on: boolean) => {
    run.current = on;
    setRunning(on);
    sim.current.lastT = null;
    if (!on) setLive(describe());
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const cur = P.current;
        const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
        restart({
          size: SIZES.includes(st.size as number) ? (st.size as number) : cur.size,
          temperature: num(st.temperature, cur.temperature),
          field: num(st.field, cur.field),
          start: st.start === 'up' || st.start === 'random' ? st.start : cur.start,
          rule: st.rule === 'glauber' || st.rule === 'metropolis' ? st.rule : cur.rule,
        });
      }),
    [props.id],
  );

  const draw = ({ ctx, view, palette: p, t }: FrameInfo) => {
    const s = sim.current;
    const par = P.current;
    // advance by the frames that have passed, within a time slice; t stands still when motion is off
    if (run.current && s.lastT !== null && t > s.lastT) {
      const t0 = performance.now();
      for (let i = 0; i < par.speed && performance.now() - t0 < SLICE_MS; i++) advance(s, par);
    }
    s.lastT = t;

    // ---- layout: side by side, or stacked on a phone
    const pad = 12;
    const side = narrow ? Math.min(view.w - 2 * pad, view.h * 0.46) : Math.min(view.h - 2 * pad, view.w * 0.42);
    const lx = narrow ? (view.w - side) / 2 : pad;
    const ly = pad;
    s.image.draw(ctx, s.state.lattice, p.ink, p.paper, lx, ly, side);
    ctx.save();
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lx, ly, side, side);
    ctx.restore();

    // ---- the traces
    const plotBox = narrow
      ? insetBox({ x: 0, y: ly + side + 6, w: view.w, h: view.h - ly - side - 6 }, { l: 52, r: 14, t: 32, b: 44 })
      : insetBox({ x: lx + side + 14, y: 0, w: view.w - lx - side - 14, h: view.h }, { l: 54, r: 14, t: 46, b: 44 });
    const xMax = niceMax(s.sweeps);
    const eMin = Math.min(...s.es);
    const yMin = eMin < -2.05 ? -3 : -2;
    const plot = makePlot(plotBox, { min: 0, max: xMax, label: L.xAxis }, { min: yMin, max: 1.05, label: L.yAxis, ticks: yMin === -3 ? [-3, -2, -1, 0, 1] : [-2, -1, 0, 1] });
    drawAxes(ctx, plot, p, { dir });
    const m0 = par.field === 0 ? onsagerMagnetization(par.temperature) : 0;
    if (m0 > 0) {
      for (const sign of [1, -1]) {
        polyline(ctx, plot, [0, xMax], [sign * m0, sign * m0], p.ink2, 1.3, [6, 5]);
      }
    }
    polyline(ctx, plot, s.xs, s.es, p.hot, 1.8);
    polyline(ctx, plot, s.xs, s.ms, p.cold, 1.8);
    // legend: the curves are named in the plot, not only by colour
    ctx.save();
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ly0 = plotBox.y - (narrow ? 14 : 22);
    ctx.fillStyle = p.cold;
    ctx.fillText(`— ${L.m}`, plotBox.x + 10, ly0);
    ctx.fillStyle = p.hot;
    ctx.fillText(`— ${L.e}`, plotBox.x + 52, ly0);
    ctx.restore();

    // ---- readout and tasks, a few times a second
    if (t - lastReadout.current > 0.2 || !run.current) {
      lastReadout.current = t;
      const m = mOf(s.state);
      const e = eOf(s.state);
      setReadout((r) => (r.sweeps === s.sweeps && !run.current ? r : { sweeps: s.sweeps, m, e }));
      scanFlips(s);
      const id = props.id;
      const want = (task: TaskId) => props.tasks?.includes(task);
      if (want('quench') && s.start === 'random' && par.temperature <= 1.6 && Math.abs(m) > 0.9) markTask(`${id}:quench`);
      if (want('hot') && s.hot >= 300) markTask(`${id}:hot`);
      if (want('critical') && s.critical >= 500) markTask(`${id}:critical`);
      if (want('flip') && par.size <= 16 && s.flips >= 1) markTask(`${id}:flip`);
      if (want('glauber') && s.glauber >= 200) markTask(`${id}:glauber`);
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: true });
  invalidateRef.current = invalidate;

  const stepOnce = () => {
    const s = sim.current;
    for (let i = 0; i < P.current.speed; i++) advance(s, P.current);
    invalidate();
    setLive(describe());
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const cur = P.current;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v * 100) / 100));
    if (e.key === ' ') setRun(!run.current);
    else if (e.key === 'ArrowUp') tune({ temperature: clamp(cur.temperature + 0.05, 0.5, 5) });
    else if (e.key === 'ArrowDown') tune({ temperature: clamp(cur.temperature - 0.05, 0.5, 5) });
    else if (e.key === 'ArrowRight') tune({ field: clamp(cur.field + 0.05, -1, 1) });
    else if (e.key === 'ArrowLeft') tune({ field: clamp(cur.field - 0.05, -1, 1) });
    else if (e.key === 'Enter') restart();
    else return;
    e.preventDefault();
  };

  const m0 = params.field === 0 ? onsagerMagnetization(params.temperature) : null;

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${describe()} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 0.8 : 2.05}
      live={live}
      tasks={tasks}
      onReset={() => restart(fromProps(props))}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          <span>
            {L.sweeps}: <b class="q">{readout.sweeps}</b>
          </span>
          <span>
            <bdi class="ltr">
              m = <b class="q">{readout.m.toFixed(3)}</b>
            </bdi>
          </span>
          <span>
            <bdi class="ltr">
              e/J = <b class="q">{readout.e.toFixed(3)}</b>
            </bdi>
          </span>
          <span>
            {L.exact}: <b class="q">{m0 === null ? '—' : m0.toFixed(3)}</b>
          </span>
        </span>
      }
      controls={
        <>
          <Slider label={L.t} min={0.5} max={5} step={0.05} value={params.temperature} format={(v) => v.toFixed(2)} onChange={(v) => tune({ temperature: Math.round(v * 100) / 100 })} />
          <Slider label={L.h} min={-1} max={1} step={0.05} value={params.field} format={(v) => (Math.abs(v) < 1e-9 ? '0.00' : v.toFixed(2))} onChange={(v) => tune({ field: Math.round(v * 100) / 100 })} />
          <div class="group" role="group" aria-label={L.size}>
            {SIZES.map((n) => (
              <Toggle key={n} label={<bdi class="ltr">{n}</bdi>} on={params.size === n} onChange={() => restart({ size: n })} />
            ))}
          </div>
          <div class="group" role="group" aria-label={L.start}>
            <Toggle label={L.random} on={params.start === 'random'} onChange={() => restart({ start: 'random' })} />
            <Toggle label={L.up} on={params.start === 'up'} onChange={() => restart({ start: 'up' })} />
          </div>
          <div class="group" role="group" aria-label={L.rule}>
            <Toggle label={L.metropolis} on={params.rule === 'metropolis'} onChange={() => restart({ rule: 'metropolis' })} />
            <Toggle label={L.glauber} on={params.rule === 'glauber'} onChange={() => restart({ rule: 'glauber' })} />
          </div>
          <div class="group" role="group" aria-label={L.speed}>
            <span class="slider-label">{L.speed}</span>
            {SPEEDS.map((n) => (
              <Toggle key={n} label={<bdi class="ltr">{n}</bdi>} on={params.speed === n} onChange={() => tune({ speed: n })} />
            ))}
          </div>
          <div class="group">
            <button type="button" class="toggle" onClick={() => setRun(!running)} aria-pressed={running}>
              {running ? L.pause : L.run}
            </button>
            <button type="button" class="toggle" onClick={stepOnce}>
              {L.step}
            </button>
            <button type="button" class="toggle" onClick={() => restart()}>
              {L.restart}
            </button>
          </div>
        </>
      }
    />
  );
}
