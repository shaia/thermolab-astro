/**
 * Why the gauge is steady (lesson 4.1, figure 4.1b). Many gases, each drawn afresh at the same
 * temperature, each with its own long-time pressure (src/physics/kinetics.ts, longTimePressure).
 *
 * Left: the spread of those pressures, as a fraction of the ideal value N k_B T / A, for the chosen
 * N. Right: the relative spread σ/⟨P⟩ against N on log–log axes, measured at seven particle numbers,
 * against the line N^(-1/2) that the derivation predicts. The figure computes; it does not animate.
 * Steps may set { n }.
 */

import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { ARGON_MASS, idealPressure, pressureSpread, uniform } from '~/physics/kinetics';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, drawMarker, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, type TaskDef } from './core/SimShell';

export const N_VALUES = [10, 30, 100, 300, 1000, 3000, 10000];
const SAMPLES = 300;
const BINS = 110;
const RANGE: [number, number] = [0, 2.2];
const ASPECT = 2.05;

type TaskId = 'few' | 'many';

const TEXT = {
  en: {
    task: {
      few: 'Look at N = 10. How far from the ideal value do single gases land?',
      many: 'Now N = 10 000. Where did the spread go?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: the pressures of many gases drawn at the same temperature, and how their relative spread shrinks with N.',
    keys: 'Keys: arrows change N, Enter draws new gases.',
    n: 'particles N',
    redraw: 'Draw new gases',
    hist: 'pressure ÷ ideal value',
    count: 'gases',
    nAxis: 'N (log)',
    spreadAxis: 'σ/⟨P⟩ (log)',
    spread: 'relative spread σ/⟨P⟩',
    law: '1/√N',
    describe: (n: number, rel: number) => `${SAMPLES} gases of ${n} particles each: their pressures spread by ${(100 * rel).toFixed(1)}% about the mean; 1/√N is ${(100 / Math.sqrt(n)).toFixed(1)}%.`,
  },
  he: {
    task: {
      few: 'הסתכלו ב-N = 10. כמה רחוק מהערך האידיאלי נופלים הלחצים של גזים בודדים?',
      many: 'ועכשיו N = 10,000. לאן נעלם הפיזור?',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: הלחצים של גזים רבים שהוגרלו באותה טמפרטורה, וכיצד הפיזור היחסי שלהם קטן עם N.',
    keys: 'במקלדת: חיצים משנים את N, אנטר מגריל גזים חדשים.',
    n: 'מספר החלקיקים N',
    redraw: 'הגרילו גזים חדשים',
    hist: 'הלחץ ÷ הערך האידיאלי',
    count: 'גזים',
    nAxis: 'N (לוגריתמי)',
    spreadAxis: 'σ/⟨P⟩ (לוגריתמי)',
    spread: 'הפיזור היחסי σ/⟨P⟩',
    law: '1/√N',
    describe: (n: number, rel: number) => `${SAMPLES} גזים של ${n} חלקיקים כל אחד: הלחצים שלהם מפוזרים ב-${(100 * rel).toFixed(1)}% סביב הממוצע; 1/√N הוא ${(100 / Math.sqrt(n)).toFixed(1)}%.`,
  },
} satisfies Record<Lang, unknown>;

export interface PressureSpreadProps {
  id: string;
  lang: Lang;
  n?: number;
  tasks?: TaskId[];
}

interface Measurement {
  n: number;
  rel: number;
  /** each gas's pressure as a fraction of N k_B T / A */
  ratios: Float64Array;
}

function measureAll(seed: number): Measurement[] {
  const rand = uniform(seed);
  return N_VALUES.map((n) => {
    // pressureSpread draws at 300 K in a 1 µm box; the ideal value is the mean those draws scatter about
    const { mean, sd, values } = pressureSpread(n, SAMPLES, rand, 300, ARGON_MASS, 1e-6);
    const ideal = idealPressure(n, 300, 1e-12);
    return { n, rel: sd / mean, ratios: values.map((v) => v / ideal) };
  });
}

export default function PressureSpread(props: PressureSpreadProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const [n, setN] = useState(props.n ?? 100);
  const [seed, setSeed] = useState(7);
  const [live, setLive] = useState('');
  const data = useMemo(() => measureAll(seed), [seed]);
  const current = data.find((d) => d.n === n) ?? data[2];
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));
  const index = Math.max(0, N_VALUES.indexOf(n));

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        if (typeof st.n === 'number' && N_VALUES.includes(st.n)) setN(st.n);
      }),
    [props.id],
  );

  useEffect(() => {
    setLive(L.describe(current.n, current.rel));
    if (props.tasks?.includes('few') && n <= 10) markTask(`${props.id}:few`);
    if (props.tasks?.includes('many') && n >= 10000) markTask(`${props.id}:many`);
  }, [n, seed]);

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const half = view.w * 0.5;
    // ---- left: histogram of P / ideal
    const hBox = insetBox({ x: 0, y: 0, w: half, h: view.h }, { l: 44, r: 14, t: 14, b: 44 });
    const counts = new Array<number>(BINS).fill(0);
    const width = (RANGE[1] - RANGE[0]) / BINS;
    for (const r of current.ratios) {
      const b = Math.floor((r - RANGE[0]) / width);
      if (b >= 0 && b < BINS) counts[b]++;
    }
    const top = Math.max(10, ...counts) * 1.1;
    const hist = makePlot(hBox, { min: RANGE[0], max: RANGE[1], label: L.hist, ticks: [0, 0.5, 1, 1.5, 2] }, { min: 0, max: top, label: L.count });
    drawAxes(ctx, hist, p, { dir, grid: false });
    ctx.save();
    ctx.fillStyle = withAlpha(p.cold, 0.75);
    counts.forEach((c, b) => {
      if (!c) return;
      const x0 = hist.px(RANGE[0] + b * width);
      const x1 = hist.px(RANGE[0] + (b + 1) * width);
      const y = hist.py(c);
      ctx.fillRect(x0 + 0.5, y, Math.max(1, x1 - x0 - 1), hBox.y + hBox.h - y);
    });
    ctx.restore();
    // the ideal value
    ctx.save();
    ctx.strokeStyle = p.hot;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hist.px(1), hBox.y);
    ctx.lineTo(hist.px(1), hBox.y + hBox.h);
    ctx.stroke();
    ctx.restore();

    // ---- right: σ/⟨P⟩ against N, log–log
    const sBox = insetBox({ x: half, y: 0, w: half, h: view.h }, { l: 52, r: 14, t: 14, b: 44 });
    const plot = makePlot(sBox, { min: 5, max: 20000, scale: 'log', label: L.nAxis }, { min: 0.003, max: 1, scale: 'log', label: L.spreadAxis });
    drawAxes(ctx, plot, p, { dir });
    drawCurve(ctx, plot, (x) => 1 / Math.sqrt(x), { color: p.hot, width: 1.6, dash: [6, 5] });
    for (const d of data) drawMarker(ctx, plot, d.n, d.rel, d.n === current.n ? p.accent : p.cold, { radius: d.n === current.n ? 6.5 : 4.5, guides: d.n === current.n });
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: ASPECT, worldHeight: 1, animate: false });
  useEffect(invalidate, [n, seed]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setN(N_VALUES[Math.min(N_VALUES.length - 1, index + 1)]);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setN(N_VALUES[Math.max(0, index - 1)]);
    else if (e.key === 'Enter') setSeed((s) => s + 1);
    else return;
    e.preventDefault();
  };

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${L.describe(current.n, current.rel)} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={ASPECT}
      live={live}
      tasks={tasks}
      onReset={() => {
        setN(props.n ?? 100);
        setSeed(7);
      }}
      onKeyDown={onKeyDown}
      readout={
        <span>
          {L.spread}: <b class="q">{(100 * current.rel).toFixed(1)}%</b> · <bdi class="ltr">{L.law}</bdi> ={' '}
          <b class="q">{(100 / Math.sqrt(current.n)).toFixed(1)}%</b>
        </span>
      }
      controls={
        <>
          <Slider label={L.n} min={0} max={N_VALUES.length - 1} step={1} value={index} format={(i) => N_VALUES[Math.round(i)].toLocaleString('en')} onChange={(i) => setN(N_VALUES[Math.round(i)])} />
          <button type="button" class="toggle" onClick={() => setSeed((s) => s + 1)}>
            {L.redraw}
          </button>
        </>
      }
    />
  );
}
