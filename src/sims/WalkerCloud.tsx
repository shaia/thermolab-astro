/**
 * An ensemble of random walkers, live (lesson 3.1, figure fig-3-1a). The model is src/physics/sampling.ts: every
 * walker starts at the origin and adds one independent step per tick, drawn from the chosen distribution (a fair or
 * a biased ±1 coin, uniform on [−1, 1], or Student-t with 5 degrees of freedom).
 *
 * `panel: 'cloud'`: up to 120 faint paths of x against t with one dark highlighted path (always walker 0, whether
 * `single` is on or off), and beside it (below it on a phone) the histogram of all the walkers' positions at the
 * current t on the run's fixed axis, lattice-aware for ±1 steps, with the Gaussian N(μ₁t, σ₁²t) drawn over it from
 * the step's exact moments. `single` shows only the highlighted path. `panel: 'spread'`: the measured spread
 * against t with σ₁√t dashed, and the ensemble mean with its ±3 standard-error band about μ₁t.
 *
 * The ensemble advances incrementally, a few steps a frame (4 000 walkers is 4 000 draws a step): a 400-step run
 * lasts about ten seconds whatever the frame rate. The loop stops when the figure is off screen or paused, and
 * Step (or the right arrow) moves a fortieth of the run for readers who cannot or will not watch it move.
 *
 * Steps may set { walkers, steps, step, single, panel, seed }. The first four of walkers, steps, step and seed
 * start a new run; `single` and `panel` only change what is shown.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { gaussianPdf, STEP_NAMES, type StepName } from '~/physics/sampling';
import { motionAllowed } from '~/progress/settings';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot, niceTicks, type Box } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';
import {
  cleanCount,
  cleanStep,
  drawIndices,
  sliderFromWalkers,
  stepChunk,
  STEPS_MAX,
  STEPS_MIN,
  taskTime,
  WALKERS_MAX,
  WALKERS_MIN,
  walkersFromSlider,
  WalkerEnsemble,
  walkRate,
  positionSpan,
} from './core/walker-view';

type Panel = 'cloud' | 'spread';
type TaskId = 'one-walker' | 'cloud' | 'sqrt' | 'drift';

const MINUS = '−';
const iso = (s: string) => `⁦${s}⁩`;
const signed = (s: string) => s.replace('-', MINUS);
const num = (n: number) => n.toLocaleString('en');
const tick = (v: number) => signed(sci(v, 2));
/** a position: whole for the ±1 steps, two decimals for the continuous ones */
const fmtPos = (x: number) => signed(Number.isInteger(x) ? String(x) : x.toFixed(2));

/** "24.1 ± 0.3": the mean to the decimal its standard error (two figures) reaches */
function plusMinus(m: number, se: number): string {
  if (!(se > 0)) return signed(m.toFixed(1));
  const dec = Math.min(4, Math.max(0, 1 - Math.floor(Math.log10(se))));
  return `${signed(m.toFixed(dec))} ± ${se.toFixed(dec)}`;
}

const TEXT = {
  en: {
    task: {
      'one-walker': 'Show a single walker and let it run. Could you have told where it would end up?',
      cloud: 'Show the whole cloud and let it run. What shape does the histogram take?',
      sqrt: 'On the spread panel, let a run finish. How does the measured spread follow the dashed curve?',
      drift: 'Choose the biased coin, show the spread panel and let it run. Which grows faster, the mean or the spread?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: an ensemble of random walkers. The cloud panel shows their paths and the histogram of their positions with the predicted Gaussian; the spread panel shows the measured spread and ensemble mean against time.',
    keys: 'Keys: space runs or pauses, the right arrow steps, Enter draws a new seed.',
    stepDist: 'step',
    stepName: {
      pm1: '±1 coin',
      biased: 'biased coin (60% right)',
      uniform: 'uniform on [−1, 1]',
      heavy: 'heavy tail (Student-t, ν = 5)',
    } satisfies Record<StepName, string>,
    panel: 'panel',
    panelName: { cloud: 'cloud', spread: 'spread' } satisfies Record<Panel, string>,
    single: 'one walker',
    walkers: 'walkers',
    run: 'Run',
    pause: 'Pause',
    step: 'Step',
    again: 'New seed',
    time: 't',
    position: 'x',
    mean: 'mean ± standard error',
    spread: 'spread',
    xT: 'step t',
    yX: 'position x',
    density: 'density',
    ySpread: 'spread of the cloud',
    yMean: 'mean of the cloud',
    histogram: 'histogram',
    gaussian: 'Gaussian from the exact moments',
    measured: 'measured',
    band: '±3 standard errors',
    expected: 'expected drift μ₁t',
    describe: (t: number, steps: number, walkers: number, mean: number, se: number, spread: number, pred: number) =>
      `Step ${t} of ${steps}, ${num(walkers)} walkers: ensemble mean ${plusMinus(mean, se)}, spread ${spread.toPrecision(3)}, predicted spread ${pred.toPrecision(3)}.`,
    describeOne: (t: number, steps: number, x: string) => `Step ${t} of ${steps}, one walker at position ${x}.`,
  },
  he: {
    task: {
      'one-walker': 'הציגו הולך בודד ותנו לו לרוץ. האם יכולתם לדעת מראש לאן יגיע?',
      cloud: 'הציגו את כל הענן ותנו לו לרוץ. איזו צורה מקבלת ההיסטוגרמה?',
      sqrt: 'בלוח הפיזור, תנו להרצה להסתיים. איך הפיזור הנמדד עוקב אחרי העקומה המקווקוות?',
      drift: 'בחרו את המטבע המוטה, הציגו את לוח הפיזור ותנו לו לרוץ. מה גדל מהר יותר, הממוצע או הפיזור?',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: ענן של הולכים אקראיים. לוח הענן מראה את המסלולים ואת היסטוגרמת המיקומים עם הגאוסית החזויה; לוח הפיזור מראה את הפיזור הנמדד ואת ממוצע הענן כפונקציה של הזמן.',
    keys: 'במקלדת: מקש הרווח מריץ או עוצר, מקש החץ ימינה מתקדם בצעד אחד, מקש Enter מגריל זרע חדש.',
    stepDist: 'צעד',
    stepName: {
      pm1: `מטבע ${iso('±1')}`,
      biased: 'מטבע מוטה (60% ימינה)',
      uniform: `אחיד על ${iso('[−1, 1]')}`,
      heavy: `זנב כבד (${iso('t')} של סטודנט, ${iso('ν = 5')})`,
    } satisfies Record<StepName, string>,
    panel: 'לוח',
    panelName: { cloud: 'ענן', spread: 'פיזור' } satisfies Record<Panel, string>,
    single: 'הולך בודד',
    walkers: 'הולכים',
    run: 'הרצה',
    pause: 'עצירה',
    step: 'צעד',
    again: 'זרע חדש',
    time: 't',
    position: 'x',
    mean: 'ממוצע ± שגיאת תקן',
    spread: 'פיזור',
    xT: `הצעד ${iso('t')}`,
    yX: `מיקום ${iso('x')}`,
    density: 'צפיפות',
    ySpread: 'פיזור הענן',
    yMean: 'ממוצע הענן',
    histogram: 'היסטוגרמה',
    gaussian: 'גאוסית מהמומנטים המדויקים',
    measured: 'נמדד',
    band: `${iso('±3')} שגיאות תקן`,
    expected: `סחיפה צפויה ${iso('μ₁t')}`,
    describe: (t: number, steps: number, walkers: number, mean: number, se: number, spread: number, pred: number) =>
      `צעד ${t} מתוך ${steps}, ${num(walkers)} הולכים: ממוצע הענן ${iso(plusMinus(mean, se))}, פיזור ${iso(spread.toPrecision(3))}, פיזור חזוי ${iso(pred.toPrecision(3))}.`,
    describeOne: (t: number, steps: number, x: string) => `צעד ${t} מתוך ${steps}, הולך בודד במיקום ${iso(x)}.`,
  },
} satisfies Record<Lang, unknown>;

export interface WalkerCloudProps {
  id: string;
  lang: Lang;
  /** walkers, 100 to 10 000 (default 4000) */
  walkers?: number;
  /** steps in a run, 10 to 2 000 (default 400) */
  steps?: number;
  step?: StepName;
  /** show only the highlighted walker's path */
  single?: boolean;
  panel?: Panel;
  seed?: number;
  tasks?: TaskId[];
}

interface Config {
  walkers: number;
  steps: number;
  step: StepName;
  seed: number;
}

const fromProps = (p: WalkerCloudProps): Config => ({
  walkers: cleanCount(p.walkers, WALKERS_MIN, WALKERS_MAX, 4000),
  steps: cleanCount(p.steps, STEPS_MIN, STEPS_MAX, 400),
  step: cleanStep(p.step, 'pm1'),
  seed: cleanCount(p.seed, 0, 1e9, 1),
});

const newEnsemble = (c: Config) => new WalkerEnsemble(c.walkers, c.steps, c.step, c.seed);

const MARGIN = { l: 54, r: 10, t: 12, b: 44 };

/** the histogram's density axis: the taller of the Gaussian's peak and the tallest bar, with headroom */
function densityTop(e: WalkerEnsemble, bars: Float64Array | null): number {
  const peak = e.t > 0 ? 1 / (e.dist.std * Math.sqrt(2 * Math.PI * e.t)) : 1;
  let top = peak;
  if (bars) for (const d of bars) top = Math.max(top, d);
  return top * 1.15;
}

function drawCloud(ctx: CanvasRenderingContext2D, vw: { w: number; h: number }, p: Palette, e: WalkerEnsemble, o: { narrow: boolean; single: boolean; dir: 'ltr' | 'rtl'; L: (typeof TEXT)['en' | 'he'] }) {
  const { narrow, single, dir, L } = o;
  const [lo, hi] = positionSpan(e.dist, e.steps);
  const pathsBox: Box = single ? { x: 0, y: 0, w: vw.w, h: vw.h } : narrow ? { x: 0, y: 0, w: vw.w, h: vw.h * 0.56 } : { x: 0, y: 0, w: vw.w * 0.62, h: vw.h };
  const histBox: Box = narrow ? { x: 0, y: vw.h * 0.56, w: vw.w, h: vw.h * 0.44 } : { x: vw.w * 0.62, y: 0, w: vw.w * 0.38, h: vw.h };

  // ---- paths: x against t, the whole run's axes from the start
  const pb = insetBox(pathsBox, { ...MARGIN, r: single || narrow ? 14 : 8, b: narrow && !single ? 40 : MARGIN.b });
  const plot = makePlot(pb, { min: 0, max: e.steps, label: L.xT, format: (v) => String(v) }, { min: lo, max: hi, label: L.yX, format: tick });
  drawAxes(ctx, plot, p, { dir, grid: false });
  ctx.save();
  ctx.beginPath();
  ctx.rect(pb.x, pb.y, pb.w, pb.h);
  ctx.clip();
  const idx = drawIndices(e.t);
  const trace = (w: number) => {
    const row = w * (e.steps + 1);
    ctx.beginPath();
    idx.forEach((t, i) => (i === 0 ? ctx.moveTo(plot.px(t), plot.py(e.paths[row + t])) : ctx.lineTo(plot.px(t), plot.py(e.paths[row + t]))));
    ctx.stroke();
  };
  if (e.t > 0) {
    ctx.lineJoin = 'round';
    if (!single) {
      ctx.strokeStyle = withAlpha(p.ink3, 0.28);
      ctx.lineWidth = 1;
      for (let w = 1; w < e.nPaths; w++) trace(w);
    }
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2.2;
    trace(0);
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(plot.px(e.t), plot.py(e.paths[e.t]), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (!single) {
    const { mean, std } = e.dist;
    for (const sign of [-1, 1]) drawCurve(ctx, plot, (t) => mean * t + sign * std * Math.sqrt(t), { color: p.hot, width: 1.4, dash: [6, 5] });
    ctx.save();
    ctx.strokeStyle = p.ink3;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(plot.px(e.t), pb.y);
    ctx.lineTo(plot.px(e.t), pb.y + pb.h);
    ctx.stroke();
    ctx.restore();
  }
  if (single) return;

  // ---- the histogram of every walker's position now, with the Gaussian predicted from the exact moments
  const h = e.t > 0 ? e.histogram() : null;
  const top = densityTop(e, h ? h.density : null);
  const hb = insetBox(histBox, narrow ? { l: 54, r: 14, t: 6, b: 40 } : { l: 6, r: 14, t: MARGIN.t, b: MARGIN.b });
  const place = (pos: number, dens: number): [number, number] => (narrow ? [hplot.px(pos), hplot.py(dens)] : [hplot.px(dens), hplot.py(pos)]);
  const hplot = narrow
    ? makePlot(hb, { min: lo, max: hi, label: L.yX, format: tick }, { min: 0, max: top, ticks: niceTicks(0, top, 3), label: L.density })
    : makePlot(hb, { min: 0, max: top, ticks: niceTicks(0, top, 3), label: L.density }, { min: lo, max: hi, format: () => '' });
  drawAxes(ctx, hplot, p, { dir, grid: false });
  ctx.save();
  ctx.beginPath();
  ctx.rect(hb.x, hb.y, hb.w, hb.h);
  ctx.clip();
  if (h) {
    ctx.fillStyle = withAlpha(p.cold, 0.7);
    for (let b = 0; b < h.centres.length; b++) {
      if (!h.density[b]) continue;
      const [x0, y0] = place(h.centres[b] - h.width / 2, 0);
      const [x1, y1] = place(h.centres[b] + h.width / 2, h.density[b]);
      const x = Math.min(x0, x1);
      const y = Math.min(y0, y1);
      ctx.fillRect(x + 0.5, y, Math.max(1, Math.abs(x1 - x0) - 1), Math.max(1, Math.abs(y1 - y0)));
    }
  }
  if (e.t > 0) {
    ctx.strokeStyle = p.hot;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    const mu = e.dist.mean * e.t;
    const sigma = e.dist.std * Math.sqrt(e.t);
    for (let i = 0; i <= 160; i++) {
      const pos = lo + ((hi - lo) * i) / 160;
      const [sx, sy] = place(pos, gaussianPdf(pos, mu, sigma));
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawSpread(ctx: CanvasRenderingContext2D, vw: { w: number; h: number }, p: Palette, e: WalkerEnsemble, o: { narrow: boolean; dir: 'ltr' | 'rtl'; L: (typeof TEXT)['en' | 'he'] }) {
  const { narrow, dir, L } = o;
  const { mean: mu1, std: sigma1 } = e.dist;
  const boxes: [Box, Box] = narrow ? [{ x: 0, y: 0, w: vw.w, h: vw.h * 0.5 }, { x: 0, y: vw.h * 0.5, w: vw.w, h: vw.h * 0.5 }] : [{ x: 0, y: 0, w: vw.w * 0.5, h: vw.h }, { x: vw.w * 0.5, y: 0, w: vw.w * 0.5, h: vw.h }];
  const margin = narrow ? { l: 54, r: 14, t: 10, b: 42 } : { l: 56, r: 12, t: 12, b: 46 };
  const idx = drawIndices(e.t);
  const T = e.steps;
  const W = e.walkers;

  const spreadTop = sigma1 * Math.sqrt(T) * 1.15;
  const sb = insetBox(boxes[0], margin);
  const sp = makePlot(sb, { min: 0, max: T, label: L.xT, format: (v) => String(v) }, { min: 0, max: spreadTop, label: L.ySpread, format: tick });
  drawAxes(ctx, sp, p, { dir });
  drawCurve(ctx, sp, (t) => sigma1 * Math.sqrt(t), { color: p.hot, width: 1.8, dash: [6, 5] });
  if (e.t > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sb.x, sb.y, sb.w, sb.h);
    ctx.clip();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    idx.forEach((t, i) => (i === 0 ? ctx.moveTo(sp.px(t), sp.py(e.spread[t])) : ctx.lineTo(sp.px(t), sp.py(e.spread[t]))));
    ctx.stroke();
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(sp.px(e.t), sp.py(e.spread[e.t]), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // the mean: its own axis, wide enough for the drift and for the band about it
  const se = (t: number) => (sigma1 * Math.sqrt(t)) / Math.sqrt(W);
  const pad = 5 * se(T);
  const mb = insetBox(boxes[1], margin);
  const mp = makePlot(mb, { min: 0, max: T, label: L.xT, format: (v) => String(v) }, { min: Math.min(0, mu1 * T) - pad, max: Math.max(0, mu1 * T) + pad, label: L.yMean, format: tick });
  drawAxes(ctx, mp, p, { dir });
  ctx.save();
  ctx.beginPath();
  ctx.rect(mb.x, mb.y, mb.w, mb.h);
  ctx.clip();
  ctx.fillStyle = withAlpha(p.cold, 0.3);
  ctx.beginPath();
  const bandSteps = 120;
  for (let i = 0; i <= bandSteps; i++) {
    const t = (T * i) / bandSteps;
    const y = mp.py(mu1 * t + 3 * se(t));
    if (i === 0) ctx.moveTo(mp.px(t), y);
    else ctx.lineTo(mp.px(t), y);
  }
  for (let i = bandSteps; i >= 0; i--) {
    const t = (T * i) / bandSteps;
    ctx.lineTo(mp.px(t), mp.py(mu1 * t - 3 * se(t)));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  drawCurve(ctx, mp, (t) => mu1 * t, { color: p.hot, width: 1.6, dash: [6, 5] });
  if (e.t > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(mb.x, mb.y, mb.w, mb.h);
    ctx.clip();
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    idx.forEach((t, i) => (i === 0 ? ctx.moveTo(mp.px(t), mp.py(e.mean[t])) : ctx.lineTo(mp.px(t), mp.py(e.mean[t]))));
    ctx.stroke();
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(mp.px(e.t), mp.py(e.mean[e.t]), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function Swatch(p: { color: string; dashed?: boolean; box?: boolean }) {
  return (
    <span
      class="swatch"
      style={{
        display: 'inline-block',
        width: p.box ? '0.9em' : '1.2em',
        height: p.box ? '0.9em' : '0',
        borderTop: p.box ? undefined : `0.18em ${p.dashed ? 'dashed' : 'solid'} ${p.color}`,
        background: p.box ? p.color : undefined,
        marginInlineEnd: '0.35em',
        verticalAlign: 'middle',
      }}
      aria-hidden="true"
    />
  );
}

export default function WalkerCloud(props: WalkerCloudProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const base = fromProps(props);
  const baseSingle = props.single === true;
  const basePanel: Panel = props.panel === 'spread' ? 'spread' : 'cloud';
  const [cfg, setCfg] = useState<Config>(base);
  const cfgRef = useRef(cfg);
  const ens = useRef<WalkerEnsemble | null>(null);
  if (ens.current === null) ens.current = newEnsemble(base);
  const [walkersLive, setWalkersLive] = useState(base.walkers);
  const [single, setSingle] = useState(baseSingle);
  const [panel, setPanel] = useState<Panel>(basePanel);
  const [running, setRunning] = useState(true);
  const run = useRef(true);
  const [readout, setReadout] = useState({ t: 0, mean: 0, se: 0, spread: 0, x: 0 });
  const [live, setLive] = useState('');
  const carry = useRef(0);
  const lastClock = useRef(0);
  const lastReadout = useRef(0);
  const invalidateRef = useRef(() => {});
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));
  const show = useRef({ single, panel });
  show.current = { single, panel };

  const summary = () => {
    const e = ens.current!;
    return show.current.single
      ? L.describeOne(e.t, e.steps, fmtPos(e.paths[e.t]))
      : L.describe(e.t, e.steps, e.walkers, e.mean[e.t], e.standardError, e.spread[e.t], e.dist.std * Math.sqrt(e.t));
  };
  const snapshot = () => {
    const e = ens.current!;
    setReadout({ t: e.t, mean: e.mean[e.t], se: e.standardError, spread: e.spread[e.t], x: e.paths[e.t] });
  };

  /** mark the tasks the run so far satisfies */
  const check = () => {
    const e = ens.current!;
    const t = props.tasks;
    if (!t || e.t < taskTime(e.steps)) return;
    const { single: one, panel: pn } = show.current;
    if (t.includes('one-walker') && one) markTask(`${props.id}:one-walker`);
    if (t.includes('cloud') && !one && pn === 'cloud') markTask(`${props.id}:cloud`);
    if (t.includes('sqrt') && pn === 'spread') markTask(`${props.id}:sqrt`);
    if (t.includes('drift') && pn === 'spread' && e.dist.name === 'biased') markTask(`${props.id}:drift`);
  };

  const setRun = (on: boolean) => {
    run.current = on;
    setRunning(on);
    invalidateRef.current();
    if (!on) setLive(summary());
  };

  /** a new run from the (patched) configuration; the seed moves on unless one is given */
  const restart = (patch: Partial<Config> = {}, seed?: number) => {
    const next = { ...cfgRef.current, ...patch, seed: seed ?? patch.seed ?? cfgRef.current.seed };
    cfgRef.current = next;
    setCfg(next);
    setWalkersLive(next.walkers);
    ens.current = newEnsemble(next);
    carry.current = 0;
    run.current = motionAllowed();
    setRunning(run.current);
    snapshot();
    setLive(summary());
    invalidateRef.current();
  };

  useEffect(() => {
    if (!motionAllowed()) setRun(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (walkersLive !== cfgRef.current.walkers) restart({ walkers: walkersLive });
    }, 160);
    return () => clearTimeout(t);
  }, [walkersLive]);

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        const cur = cfgRef.current;
        if (typeof st.single === 'boolean') setSingle(st.single);
        if (st.panel === 'cloud' || st.panel === 'spread') setPanel(st.panel);
        const moves = ['walkers', 'steps', 'step', 'seed'].some((k) => k in st);
        if (!moves) return;
        restart({
          walkers: cleanCount(st.walkers, WALKERS_MIN, WALKERS_MAX, cur.walkers),
          steps: cleanCount(st.steps, STEPS_MIN, STEPS_MAX, cur.steps),
          step: cleanStep(st.step, cur.step),
          seed: cleanCount(st.seed, 0, 1e9, cur.seed),
        });
      }),
    [props.id],
  );

  const draw = ({ ctx, view: vw, palette: p, t: clock }: FrameInfo) => {
    const e = ens.current!;
    const dt = clock - lastClock.current;
    lastClock.current = clock;
    if (run.current && dt > 0 && !e.done) {
      carry.current += walkRate(e.steps) * dt;
      const k = Math.floor(carry.current);
      if (k > 0) {
        carry.current -= k;
        e.advance(k);
      }
    }
    if (panel === 'cloud') drawCloud(ctx, vw, p, e, { narrow, single, dir, L });
    else drawSpread(ctx, vw, p, e, { narrow, dir, L });
    if (clock - lastReadout.current > 0.2 || !run.current || e.done) {
      lastReadout.current = clock;
      setReadout((r) => (r.t === e.t ? r : { t: e.t, mean: e.mean[e.t], se: e.standardError, spread: e.spread[e.t], x: e.paths[e.t] }));
      check();
      if (e.done && run.current) {
        run.current = false;
        setRunning(false);
        setLive(summary());
      }
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: running });
  invalidateRef.current = invalidate;
  useEffect(() => {
    invalidate();
    check();
  }, [single, panel, narrow, props.lang]);

  const e = ens.current;
  const chunk = stepChunk(e.steps);
  const stepOnce = () => {
    const cur = ens.current!;
    if (cur.done) return;
    cur.advance(stepChunk(cur.steps));
    snapshot();
    setLive(summary());
    invalidate();
    check();
  };
  const toggleRun = () => {
    if (ens.current!.done) restart({}, cfgRef.current.seed + 1);
    else setRun(!run.current);
  };
  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === ' ') toggleRun();
    else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') stepOnce();
    else if (ev.key === 'Enter') restart({}, cfgRef.current.seed + 1);
    else return;
    ev.preventDefault();
  };

  const predicted = e.dist.std * Math.sqrt(readout.t);

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${summary()} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 0.95 : 2.05}
      live={live}
      tasks={tasks}
      onReset={() => {
        setSingle(baseSingle);
        setPanel(basePanel);
        restart(fromProps(props), fromProps(props).seed);
      }}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          <span>
            <bdi class="ltr">t: <b class="q">{readout.t}</b> / {e.steps}</bdi>
          </span>
          {single && panel === 'cloud' ? (
            <span>
              <bdi class="ltr">x: <b class="q">{fmtPos(readout.x)}</b></bdi>
            </span>
          ) : (
            <>
              <span>
                {L.mean}: <bdi class="ltr"><b class="q">{readout.t > 0 ? plusMinus(readout.mean, readout.se) : '–'}</b></bdi>
              </span>
              <span>
                {L.spread}: <bdi class="ltr"><b class="q">{readout.t > 0 ? readout.spread.toPrecision(3) : '–'}</b></bdi>
              </span>
              <span>
                <bdi class="ltr">σ₁√t: <b class="q">{readout.t > 0 ? predicted.toPrecision(3) : '–'}</b></bdi>
              </span>
            </>
          )}
          {panel === 'cloud' && !single ? (
            <>
              <span>
                <Swatch color="var(--cold)" box />
                {L.histogram}
              </span>
              <span>
                <Swatch color="var(--hot)" />
                {L.gaussian}
              </span>
            </>
          ) : null}
          {panel === 'spread' ? (
            <>
              <span>
                <Swatch color="var(--ink)" />
                {L.measured}
              </span>
              <span>
                <Swatch color="var(--hot)" dashed />
                <bdi class="ltr">σ₁√t, μ₁t</bdi>
              </span>
              <span>
                <Swatch color="var(--cold)" box />
                {L.band}
              </span>
            </>
          ) : null}
        </span>
      }
      controls={
        <>
          <div class="group" role="group" aria-label={L.stepDist}>
            {STEP_NAMES.map((n) => (
              <Toggle key={n} label={L.stepName[n]} on={cfg.step === n} onChange={() => restart({ step: n }, cfgRef.current.seed)} />
            ))}
          </div>
          <div class="group" role="group" aria-label={L.panel}>
            {(['cloud', 'spread'] as Panel[]).map((pn) => (
              <Toggle key={pn} label={L.panelName[pn]} on={panel === pn} onChange={() => setPanel(pn)} />
            ))}
            <Toggle label={L.single} on={single} onChange={setSingle} />
          </div>
          <Slider label={L.walkers} min={0} max={1} step={0.01} value={sliderFromWalkers(walkersLive)} format={() => num(walkersLive)} onChange={(t) => setWalkersLive(walkersFromSlider(t))} />
          <div class="group">
            <button type="button" class="toggle" aria-pressed={running} onClick={toggleRun}>
              {running ? L.pause : L.run}
            </button>
            <button type="button" class="toggle" onClick={stepOnce} disabled={e.done}>
              {L.step} <bdi class="ltr">+{chunk}</bdi>
            </button>
            <button type="button" class="toggle" onClick={() => restart({}, cfgRef.current.seed + 1)}>
              {L.again}
            </button>
          </div>
        </>
      }
    />
  );
}
