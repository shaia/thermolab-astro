/**
 * The spread of an average of N dice (lesson 0.1, figure fig-0-1b). Many experiments, each rolling N dice and
 * keeping their average (or their sum), drawn afresh from the seeded generator.
 *
 * Left: the histogram of the experiments' averages (or sums), with the measured standard deviation and the
 * predicted σ/√N (or σ√N) marked about the mean. Right: on log–log axes, the measured relative spread of the
 * average (or the absolute spread of the sum) for N = 1, 4, 16, …, 4096, against the line N^(−1/2) (or N^(+1/2)),
 * the chosen N highlighted, and the exponent fitted to the seven points. The figure computes; it does not
 * animate. At N = 10 000 and 2 000 experiments that is 20 million rolls, about a quarter of a second.
 * Steps may set { n, samples, view }.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { uniform } from '~/physics/kinetics';
import { dieMean, dieRelativeSpread, dieVariance, mean, predictedAverageSpread, predictedSumSpread, sampleSums, scalingExponent, stdDev } from '~/physics/sampling';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { histogramHalfWidth, latticeHistogram, N_MAX, nFromSlider, sliderFromN } from './core/dice-view';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, drawMarker, insetBox, makePlot, niceTicks } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

export const SWEEP_N = [1, 4, 16, 64, 256, 1024, 4096];
type View = 'average' | 'sum';
type TaskId = 'quadruple' | 'sum-grows' | 'fit';

const MU = dieMean();
const SIGMA = Math.sqrt(dieVariance());
const MINUS = '−';
const iso = (s: string) => `⁦${s}⁩`;
const num = (n: number) => n.toLocaleString('en');
const pct = (v: number) => `${(100 * v).toFixed(v < 0.1 ? 2 : 1)}%`;
const fixedFor = (v: number, spanHint: number) => (spanHint >= 1 ? v.toFixed(v === Math.round(v) ? 0 : 1) : v.toFixed(Math.min(5, Math.max(1, Math.ceil(-Math.log10(spanHint) + 0.3)))));

const TEXT = {
  en: {
    task: {
      quadruple: 'Set N = 25, then N = 100. By what factor does the spread change?',
      'sum-grows': 'Switch to the sum. What happens to its spread as N grows?',
      fit: 'Draw new samples a few times. How steady is the fitted exponent?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: the spread of the average (or the sum) of N dice over many experiments, and how it changes with N on log–log axes.',
    keys: 'Keys: left and right arrows change N, Enter draws new samples.',
    n: 'dice per experiment N',
    samples: 'experiments',
    view: { average: 'average', sum: 'sum' } satisfies Record<View, string>,
    again: 'Draw new samples',
    histX: { average: 'average of N dice', sum: 'sum of N dice' } satisfies Record<View, string>,
    histY: 'experiments',
    lawX: 'N dice (log)',
    lawY: { average: 'relative spread σ/mean (log)', sum: 'spread of the sum (log)' } satisfies Record<View, string>,
    measured: 'measured',
    predicted: 'predicted',
    spread: 'spread',
    relative: 'relative spread',
    exponent: 'fitted exponent',
    computing: 'computing…',
    describe: (view: View, n: number, samples: number, measured: number, predicted: number, alpha: number) =>
      `${num(samples)} experiments of ${num(n)} dice, ${view === 'average' ? 'averages' : 'sums'}: measured spread ${measured.toPrecision(3)}, predicted ${predicted.toPrecision(3)}; fitted exponent ${alpha.toFixed(2).replace('-', MINUS)}.`,
  },
  he: {
    task: {
      quadruple: `קבעו ${iso('N = 25')}, ואז ${iso('N = 100')}. פי כמה משתנה הפיזור?`,
      'sum-grows': 'עברו לסכום. מה קורה לפיזור שלו כש-N גדל?',
      fit: 'הגרילו דגימות חדשות כמה פעמים. עד כמה יציב המעריך המותאם?',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: הפיזור של הממוצע (או הסכום) של N קוביות בהרבה ניסויים, וכיצד הוא משתנה עם N על צירים לוגריתמיים.',
    keys: 'במקלדת: חיצי ימין ושמאל משנים את N, אנטר מגריל דגימות חדשות.',
    n: 'קוביות בניסוי N',
    samples: 'ניסויים',
    view: { average: 'ממוצע', sum: 'סכום' } satisfies Record<View, string>,
    again: 'הגרילו דגימות חדשות',
    histX: { average: 'ממוצע של N קוביות', sum: 'סכום של N קוביות' } satisfies Record<View, string>,
    histY: 'ניסויים',
    lawX: 'N קוביות (לוגריתמי)',
    lawY: { average: 'פיזור יחסי σ/ממוצע (לוגריתמי)', sum: 'פיזור הסכום (לוגריתמי)' } satisfies Record<View, string>,
    measured: 'נמדד',
    predicted: 'חזוי',
    spread: 'פיזור',
    relative: 'פיזור יחסי',
    exponent: 'מעריך מותאם',
    computing: 'בחישוב…',
    describe: (view: View, n: number, samples: number, measured: number, predicted: number, alpha: number) =>
      `${num(samples)} ניסויים של ${num(n)} קוביות, ${view === 'average' ? 'ממוצעים' : 'סכומים'}: הפיזור הנמדד ${iso(measured.toPrecision(3))}, החזוי ${iso(predicted.toPrecision(3))}; המעריך המותאם ${iso(alpha.toFixed(2).replace('-', MINUS))}.`,
  },
} satisfies Record<Lang, unknown>;

export interface DiceSpreadProps {
  id: string;
  lang: Lang;
  /** dice per experiment, 1 to 10 000 */
  n?: number;
  /** experiments, 100 to 10 000 (default 2000) */
  samples?: number;
  view?: View;
  seed?: number;
  tasks?: TaskId[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const cleanN = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), 1, N_MAX) : d);
const cleanSamples = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), 100, 10000) : d);

const sumsFor = (n: number, samples: number, seed: number) => sampleSums(n, samples, uniform(seed * 100003 + n));

/** what the experiments measured at one N: the spread of the sums, and of the averages, absolute and relative */
function measure(sums: Float64Array, n: number) {
  const sdSum = stdDev(sums);
  const meanSum = mean(sums);
  return { sums, sdSum, sdAverage: sdSum / n, mean: meanSum / n, relative: sdSum / meanSum };
}

export default function DiceSpread(props: DiceSpreadProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const base = { n: cleanN(props.n, 100), samples: cleanSamples(props.samples, 2000), view: props.view ?? 'average', seed: props.seed ?? 1 };
  /** the slider's N at once, and the N the figure computes for once the slider has rested */
  const [nLive, setNLive] = useState(base.n);
  const [n, setN] = useState(base.n);
  const [samples, setSamples] = useState(base.samples);
  const [view, setView] = useState<View>(base.view);
  const [seed, setSeed] = useState(base.seed);
  const [live, setLive] = useState('');
  const visited = useRef(new Set<number>());
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  useEffect(() => {
    const t = setTimeout(() => setN(nLive), 140);
    return () => clearTimeout(t);
  }, [nLive]);
  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        if (typeof st.n === 'number') {
          const v = cleanN(st.n, base.n);
          setNLive(v);
          setN(v);
        }
        if (typeof st.samples === 'number') setSamples(cleanSamples(st.samples, base.samples));
        if (st.view === 'average' || st.view === 'sum') setView(st.view);
      }),
    [props.id],
  );

  const sweep = useMemo(() => SWEEP_N.map((m) => measure(sumsFor(m, samples, seed), m)), [samples, seed]);
  const current = useMemo(() => {
    const i = SWEEP_N.indexOf(n);
    return i >= 0 ? sweep[i] : measure(sumsFor(n, samples, seed), n);
  }, [n, sweep, samples, seed]);

  const law = view === 'average' ? sweep.map((d) => d.relative) : sweep.map((d) => d.sdSum);
  const alpha = scalingExponent(SWEEP_N, law);
  const measuredSpread = view === 'average' ? current.sdAverage : current.sdSum;
  const predictedSpread = view === 'average' ? predictedAverageSpread(n) : predictedSumSpread(n);

  useEffect(() => {
    setLive(L.describe(view, n, samples, measuredSpread, predictedSpread, alpha));
    const t = props.tasks;
    visited.current.add(n);
    const seen = [...visited.current];
    if (t?.includes('quadruple') && seen.some((a) => seen.some((b) => b / a > 3.4 && b / a < 4.7))) markTask(`${props.id}:quadruple`);
    if (t?.includes('sum-grows') && view === 'sum') markTask(`${props.id}:sum-grows`);
    if (t?.includes('fit') && seed !== base.seed) markTask(`${props.id}:fit`);
  }, [n, view, samples, seed]);

  const draw = ({ ctx, view: vw, palette: p }: FrameInfo) => {
    const lefts = narrow ? { x: 0, y: 0, w: vw.w, h: vw.h * 0.5 } : { x: 0, y: 0, w: vw.w * 0.5, h: vw.h };
    const rights = narrow ? { x: 0, y: vw.h * 0.5, w: vw.w, h: vw.h * 0.5 } : { x: vw.w * 0.5, y: 0, w: vw.w * 0.5, h: vw.h };
    const margin = narrow ? { l: 52, r: 14, t: 10, b: 44 } : { l: 52, r: 14, t: 12, b: 46 };

    // ---- left: histogram of the averages (or sums)
    const hBox = insetBox(lefts, margin);
    const centre = view === 'average' ? MU : MU * n;
    const halfSpread = view === 'average' ? predictedAverageSpread(n) : predictedSumSpread(n);
    const half = histogramHalfWidth(view, n, halfSpread);
    const lo = centre - half;
    const hi = centre + half;
    const lattice = view === 'average' ? 1 / n : 1;
    const values = view === 'average' ? Float64Array.from(current.sums, (s) => s / n) : current.sums;
    const hist = latticeHistogram(values, lo, hi, lattice);
    const top = Math.max(10, ...hist.counts) * 1.15;
    const xTicks = niceTicks(lo, hi, 5);
    const plot = makePlot(
      hBox,
      { min: lo, max: hi, ticks: xTicks, label: L.histX[view], format: (v) => fixedFor(v, 2 * half / 5) },
      { min: 0, max: top, label: L.histY },
    );
    drawAxes(ctx, plot, p, { dir, grid: false });
    ctx.save();
    ctx.beginPath();
    ctx.rect(hBox.x, hBox.y, hBox.w, hBox.h);
    ctx.clip();
    ctx.fillStyle = withAlpha(p.cold, 0.7);
    hist.counts.forEach((c, b) => {
      if (!c) return;
      const x0 = plot.px(hist.start + b * hist.width);
      const x1 = plot.px(hist.start + (b + 1) * hist.width);
      const y = plot.py(c);
      ctx.fillRect(x0 + 0.5, y, Math.max(1, x1 - x0 - 1), hBox.y + hBox.h - y);
    });
    const mark = (at: number, color: string, dash: number[], width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(plot.px(at), hBox.y);
      ctx.lineTo(plot.px(at), hBox.y + hBox.h);
      ctx.stroke();
    };
    const sdMeasured = view === 'average' ? current.sdAverage : current.sdSum;
    const centreMeasured = view === 'average' ? current.mean : current.mean * n;
    for (const sign of [-1, 1]) {
      mark(centreMeasured + sign * sdMeasured, p.accent, [], 2);
      mark(centre + sign * halfSpread, p.hot, [6, 5], 1.8);
    }
    ctx.restore();

    // ---- right: the spread against N, log–log
    const rBox = insetBox(rights, margin);
    const yAxis = view === 'average' ? { min: 0.004, max: 1 } : { min: 1, max: 300 };
    const lawPlot = makePlot(rBox, { min: 0.7, max: 14000, scale: 'log', label: L.lawX }, { ...yAxis, scale: 'log', label: L.lawY[view] });
    drawAxes(ctx, lawPlot, p, { dir });
    drawCurve(ctx, lawPlot, (x) => (view === 'average' ? dieRelativeSpread() / Math.sqrt(x) : SIGMA * Math.sqrt(x)), { color: p.hot, width: 1.6, dash: [6, 5] });
    SWEEP_N.forEach((m, i) => drawMarker(ctx, lawPlot, m, law[i], p.cold, { radius: 4.5 }));
    const here = view === 'average' ? current.relative : current.sdSum;
    drawMarker(ctx, lawPlot, n, here, p.accent, { radius: 6.5, guides: true });
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [current, sweep, view, narrow, n, props.lang]);

  const step = (dirn: 1 | -1) => {
    const t = sliderFromN(nLive) + dirn * 0.04;
    const next = nFromSlider(t);
    setNLive(next === nLive ? clamp(nLive + dirn, 1, N_MAX) : next);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1);
    else if (e.key === 'Enter') setSeed((s) => s + 1);
    else return;
    e.preventDefault();
  };

  const busy = nLive !== n;

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${L.describe(view, n, samples, measuredSpread, predictedSpread, alpha)} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 0.95 : 2.05}
      live={live}
      tasks={tasks}
      onReset={() => {
        setNLive(base.n);
        setN(base.n);
        setSamples(base.samples);
        setView(base.view);
        setSeed(base.seed);
      }}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          <span>
            N: <bdi class="ltr"><b class="q">{num(nLive)}</b></bdi>
            {busy ? <> · {L.computing}</> : null}
          </span>
          <span>
            <span class="swatch" style={{ display: 'inline-block', width: '1.2em', height: '0.18em', background: 'var(--accent)', marginInlineEnd: '0.35em', verticalAlign: 'middle' }} aria-hidden="true" />
            {L.spread} {L.measured}: <bdi class="ltr"><b class="q">{measuredSpread.toPrecision(3)}</b></bdi>
            {view === 'average' ? (
              <>
                {' '}(<bdi class="ltr">{pct(current.relative)}</bdi>)
              </>
            ) : null}
          </span>
          <span>
            <span class="swatch" style={{ display: 'inline-block', width: '1.2em', height: '0.18em', background: 'var(--hot)', marginInlineEnd: '0.35em', verticalAlign: 'middle' }} aria-hidden="true" />
            {L.spread} {L.predicted}: <bdi class="ltr"><b class="q">{predictedSpread.toPrecision(3)}</b></bdi>
            {view === 'average' ? (
              <>
                {' '}(<bdi class="ltr">{pct(dieRelativeSpread() / Math.sqrt(n))}</bdi>)
              </>
            ) : null}
          </span>
          <span>
            {L.exponent}: <bdi class="ltr"><b class="q">{alpha.toFixed(2).replace('-', MINUS)}</b></bdi>
          </span>
        </span>
      }
      controls={
        <>
          <div class="group" role="group" aria-label={L.histX[view]}>
            {(['average', 'sum'] as View[]).map((v) => (
              <Toggle key={v} label={L.view[v]} on={view === v} onChange={() => setView(v)} />
            ))}
            <button type="button" class="toggle" onClick={() => setSeed((s) => s + 1)}>
              {L.again}
            </button>
          </div>
          <Slider label={L.n} min={0} max={1} step={0.005} value={sliderFromN(nLive)} format={() => num(nLive)} onChange={(t) => setNLive(nFromSlider(t))} />
          <Slider label={L.samples} min={100} max={10000} step={100} value={samples} format={(v) => num(Math.round(v))} onChange={(v) => setSamples(Math.round(v))} />
        </>
      }
    />
  );
}
