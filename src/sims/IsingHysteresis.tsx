/**
 * The hysteresis loop (lesson 15.1, figure 15.1c): a lattice at fixed temperature while the field is stepped
 * +1 → −1 → +1 in 81 steps per leg, a fixed number of sweeps at each. Left: the spins. Right: m against h, the
 * current state as a dot, the running loop as a curve and the previous completed loop kept faintly for
 * comparison. Below T_c the curve does not retrace itself: reversing the magnetization needs a domain of the
 * other sign to nucleate and grow. Above T_c the same sweep retraces itself and the loop area is noise.
 * The model is src/physics/ising.ts (hysteresisFields, loopArea); the steps are taken one per tick here so
 * the loop can be watched. Loops follow one another; any change of T, sweeps per step or size restarts.
 * Steps may set { temperature, sweepsPerStep, size }.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import {
  alignedState,
  hysteresisFields,
  loopArea,
  mOf,
  onsagerTc,
  sweep,
  uniform,
  withField,
  type IsingState,
  type Rand,
} from '~/physics/ising';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { SpinImage, marker, polyline } from './core/ising-view';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

export const SWEEP_CHOICES = [5, 20, 80];
export const SIZE_CHOICES = [32, 64];
const FIELDS = hysteresisFields(1, 81);
const TC = onsagerTc();
/** field steps per second: a loop takes about six seconds, slow enough to watch the jump */
const STEP_RATE = 28;
const BURN_IN = 200;

type TaskId = 'loop' | 'slow' | 'above';

const TEXT = {
  en: {
    task: {
      loop: 'Complete a loop at T = 2.0 or below. Does the magnetization keep its sign past h = 0?',
      slow: 'Complete a loop with 80 sweeps per step below the critical temperature. Is the loop smaller?',
      above: 'Complete a loop at T = 3.0 or above. Does it retrace itself?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: a lattice while the magnetic field is swept from plus one to minus one and back, and its magnetization against the field.',
    keys: 'Keys: space runs or pauses, up and down arrows change T, left and right arrows change the sweeps per step, Enter restarts.',
    t: 'temperature T',
    sweeps: 'sweeps per step',
    size: 'lattice side L',
    run: 'Run',
    pause: 'Pause',
    step: 'Step',
    restart: 'Restart',
    xAxis: 'field h (h/J)',
    yAxis: 'magnetization m',
    area: 'area of the last loop',
    none: 'none yet',
    field: 'field',
    previous: (t: number, n: number) => `faint: previous loop, T = ${t.toFixed(2)}, ${n} sweeps per step`,
    describe: (t: number, n: number, size: number, h: number, m: number) => `${size} by ${size} lattice at T = ${t.toFixed(2)}, ${n} sweeps per field step. Field ${h.toFixed(2)}, magnetization ${m.toFixed(2)}.`,
  },
  he: {
    task: {
      loop: 'השלימו לולאה ב-T = 2.0 או פחות. האם המגנוט שומר על סימנו מעבר ל-h = 0?',
      slow: 'השלימו לולאה עם 80 סריקות לכל צעד מתחת לטמפרטורה הקריטית. האם הלולאה קטנה יותר?',
      above: 'השלימו לולאה ב-T = 3.0 או יותר. האם היא חוזרת על עצמה?',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: סריג בזמן שהשדה המגנטי נסרק מ-1 ל-1- וחזרה, והמגנוט שלו כפונקציה של השדה.',
    keys: 'במקלדת: רווח מריץ או עוצר, חיצי מעלה ומטה משנים את T, חיצי ימין ושמאל משנים את מספר הסריקות לצעד, אנטר מתחיל מחדש.',
    t: 'הטמפרטורה T',
    sweeps: 'סריקות לצעד',
    size: 'צלע הסריג L',
    run: 'הרצה',
    pause: 'עצירה',
    step: 'צעד',
    restart: 'התחלה מחדש',
    xAxis: 'השדה h',
    yAxis: 'המגנוט m',
    area: 'שטח הלולאה האחרונה',
    none: 'עדיין אין',
    field: 'שדה',
    previous: (t: number, n: number) => `דהוי: הלולאה הקודמת, T = ${t.toFixed(2)}, ${n} סריקות לצעד`,
    describe: (t: number, n: number, size: number, h: number, m: number) => `סריג ${size} על ${size} ב-T = ${t.toFixed(2)}, ${n} סריקות לכל צעד שדה. שדה ${h.toFixed(2)}, מגנוט ${m.toFixed(2)}.`,
  },
} satisfies Record<Lang, unknown>;

export interface IsingHysteresisProps {
  id: string;
  lang: Lang;
  temperature?: number;
  sweepsPerStep?: 5 | 20 | 80;
  size?: 32 | 64;
  tasks?: TaskId[];
}

interface Params {
  temperature: number;
  sweepsPerStep: number;
  size: number;
}

interface Loop {
  m: number[];
  temperature: number;
  sweepsPerStep: number;
  area: number;
}

interface Sim {
  state: IsingState;
  rand: Rand;
  seed: number;
  /** m after each field step of the loop in progress */
  m: number[];
  previous: Loop | null;
  image: SpinImage;
  acc: number;
  lastT: number | null;
}

const fromProps = (p: IsingHysteresisProps): Params => ({ temperature: p.temperature ?? 1.5, sweepsPerStep: p.sweepsPerStep ?? 20, size: p.size ?? 32 });

function newSim(p: Params, seed: number, previous: Loop | null): Sim {
  const rand = uniform(seed);
  const state = alignedState(p.size, true, FIELDS[0]);
  // the loop starts from equilibrium at the top of the ladder, not from however the lattice was prepared
  sweep(state, p.temperature, rand, 'metropolis', BURN_IN);
  return { state, rand, seed, m: [], previous, image: new SpinImage(p.size), acc: 0, lastT: null };
}

export default function IsingHysteresis(props: IsingHysteresisProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const [params, setParams] = useState<Params>(() => fromProps(props));
  const P = useRef(params);
  const [running, setRunning] = useState(true);
  const run = useRef(true);
  const [readout, setReadout] = useState<{ h: number; m: number; area: number | null }>({ h: 1, m: 1, area: null });
  const [live, setLive] = useState('');
  const sim = useRef<Sim>(newSim(params, 1, null));
  const lastReadout = useRef(0);
  const invalidateRef = useRef(() => {});
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  const describe = () => {
    const s = sim.current;
    return L.describe(P.current.temperature, P.current.sweepsPerStep, P.current.size, s.state.field, mOf(s.state));
  };
  /** any change of T, sweeps per step or size starts a fresh loop; the last completed one stays for comparison */
  const restart = (patch: Partial<Params> = {}) => {
    const next = { ...P.current, ...patch };
    P.current = next;
    setParams(next);
    sim.current = newSim(next, sim.current.seed + 1, sim.current.previous);
    setReadout((r) => ({ h: 1, m: mOf(sim.current.state), area: r.area }));
    setLive(describe());
    invalidateRef.current();
  };
  const setRun = (on: boolean) => {
    run.current = on;
    setRunning(on);
    sim.current.lastT = null;
    if (!on) setLive(describe());
  };

  /** one field step; at the end of the ladder the loop is complete */
  const fieldStep = () => {
    const s = sim.current;
    const par = P.current;
    const i = s.m.length;
    withField(s.state, FIELDS[i]);
    sweep(s.state, par.temperature, s.rand, 'metropolis', par.sweepsPerStep);
    s.m.push(mOf(s.state));
    if (s.m.length === FIELDS.length) {
      const area = loopArea(FIELDS, s.m);
      s.previous = { m: s.m, temperature: par.temperature, sweepsPerStep: par.sweepsPerStep, area };
      s.m = [];
      const id = props.id;
      const want = (t: TaskId) => props.tasks?.includes(t);
      if (want('loop') && par.temperature <= 2.0) markTask(`${id}:loop`);
      if (want('slow') && par.sweepsPerStep === 80 && par.temperature < TC) markTask(`${id}:slow`);
      if (want('above') && par.temperature >= 3.0) markTask(`${id}:above`);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const cur = P.current;
        const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
        restart({
          temperature: num(st.temperature, cur.temperature),
          sweepsPerStep: SWEEP_CHOICES.includes(st.sweepsPerStep as number) ? (st.sweepsPerStep as number) : cur.sweepsPerStep,
          size: SIZE_CHOICES.includes(st.size as number) ? (st.size as number) : cur.size,
        });
      }),
    [props.id],
  );

  const draw = ({ ctx, view, palette: p, t }: FrameInfo) => {
    const s = sim.current;
    if (run.current && s.lastT !== null && t > s.lastT) {
      s.acc += Math.min(0.1, t - s.lastT) * STEP_RATE;
      const t0 = performance.now();
      while (s.acc >= 1 && performance.now() - t0 < 12) {
        fieldStep();
        s.acc -= 1;
      }
      if (s.acc > 4) s.acc = 0;
    }
    s.lastT = t;
    const cur = sim.current;

    const pad = 12;
    const side = narrow ? Math.min(view.w - 2 * pad, view.h * 0.44) : Math.min(view.h - 2 * pad, view.w * 0.4);
    const lx = narrow ? (view.w - side) / 2 : pad;
    cur.image.draw(ctx, cur.state.lattice, p.ink, p.paper, lx, pad, side);
    ctx.save();
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lx, pad, side, side);
    ctx.restore();

    const plotBox = narrow
      ? insetBox({ x: 0, y: pad + side + 6, w: view.w, h: view.h - pad - side - 6 }, { l: 52, r: 18, t: 26, b: 44 })
      : insetBox({ x: lx + side + 14, y: 0, w: view.w - lx - side - 14, h: view.h }, { l: 54, r: 18, t: 46, b: 44 });
    const ticks = [-1, -0.5, 0, 0.5, 1];
    const plot = makePlot(plotBox, { min: -1.06, max: 1.06, label: L.xAxis, ticks }, { min: -1.06, max: 1.06, label: L.yAxis, ticks });
    drawAxes(ctx, plot, p, { dir });
    if (cur.previous) {
      polyline(ctx, plot, FIELDS, cur.previous.m, withAlpha(p.ink3, 0.7), 2, [1, 0]);
      ctx.save();
      ctx.font = `12px ${p.fontUi}`;
      ctx.fillStyle = p.ink2;
      ctx.direction = props.lang === 'he' ? 'rtl' : 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(L.previous(cur.previous.temperature, cur.previous.sweepsPerStep), plotBox.x, plotBox.y - 16);
      ctx.restore();
    }
    polyline(ctx, plot, FIELDS.slice(0, cur.m.length), cur.m, p.cold, 2.4);
    marker(ctx, plot.px(cur.state.field), plot.py(mOf(cur.state)), 0, 6.5, p.hot, p.ink);

    if (t - lastReadout.current > 0.2 || !run.current) {
      lastReadout.current = t;
      const m = mOf(cur.state);
      setReadout((r) => (r.h === cur.state.field && r.m === m && r.area === (cur.previous?.area ?? null) ? r : { h: cur.state.field, m, area: cur.previous?.area ?? null }));
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: true });
  invalidateRef.current = invalidate;

  const stepOnce = () => {
    fieldStep();
    invalidate();
    setLive(describe());
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const cur = P.current;
    const i = SWEEP_CHOICES.indexOf(cur.sweepsPerStep);
    if (e.key === ' ') setRun(!run.current);
    else if (e.key === 'ArrowUp') restart({ temperature: Math.min(3.5, Math.round((cur.temperature + 0.1) * 100) / 100) });
    else if (e.key === 'ArrowDown') restart({ temperature: Math.max(1, Math.round((cur.temperature - 0.1) * 100) / 100) });
    else if (e.key === 'ArrowRight') restart({ sweepsPerStep: SWEEP_CHOICES[Math.min(SWEEP_CHOICES.length - 1, i + 1)] });
    else if (e.key === 'ArrowLeft') restart({ sweepsPerStep: SWEEP_CHOICES[Math.max(0, i - 1)] });
    else if (e.key === 'Enter') restart();
    else return;
    e.preventDefault();
  };

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${describe()} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 0.82 : 2.05}
      live={live}
      tasks={tasks}
      onReset={() => restart(fromProps(props))}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          <span>
            {L.area}: <b class="q">{readout.area === null ? L.none : readout.area.toFixed(2)}</b>
          </span>
          <span>
            <bdi class="ltr">
              h/J = <b class="q">{readout.h.toFixed(2)}</b>
            </bdi>
          </span>
          <span>
            <bdi class="ltr">
              m = <b class="q">{readout.m.toFixed(3)}</b>
            </bdi>
          </span>
        </span>
      }
      controls={
        <>
          <Slider label={L.t} min={1} max={3.5} step={0.05} value={params.temperature} format={(v) => v.toFixed(2)} onChange={(v) => restart({ temperature: Math.round(v * 100) / 100 })} />
          <div class="group" role="group" aria-label={L.sweeps}>
            <span class="slider-label">{L.sweeps}</span>
            {SWEEP_CHOICES.map((n) => (
              <Toggle key={n} label={<bdi class="ltr">{n}</bdi>} on={params.sweepsPerStep === n} onChange={() => restart({ sweepsPerStep: n })} />
            ))}
          </div>
          <div class="group" role="group" aria-label={L.size}>
            <span class="slider-label">{L.size}</span>
            {SIZE_CHOICES.map((n) => (
              <Toggle key={n} label={<bdi class="ltr">{n}</bdi>} on={params.size === n} onChange={() => restart({ size: n })} />
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
