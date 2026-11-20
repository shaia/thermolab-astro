/**
 * The running average of fair dice (lesson 0.1, figure fig-0-1a): several runs of rolls drawn from one die, each
 * line the average (or the excess of the sum over 3.5 n) of its first n rolls, against n.
 *
 * 'average': the running average against n on a log axis, the line 3.5 and the envelope 3.5 ± σ/√n, σ = √(35/12).
 * 'excess': the running sum minus 3.5 n, linear in n, with the envelope ±σ√n: the "dilution, not compensation"
 * picture. An early excess is not paid back; the lines wander out inside a widening envelope.
 * Drag across the plot (or use the arrow keys) to read every run at one n. The figure computes; it does not animate.
 * Steps may set { runs, rolls, view, envelope }.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { uniform } from '~/physics/kinetics';
import { dieMean, dieVariance, rollDice, runningExcess } from '~/physics/sampling';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { plotIndices } from './core/dice-view';
import { niceMax } from './core/ising-view';
import { withAlpha } from './core/ink';
import { drawAxes, insetBox, makePlot, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

type View = 'average' | 'excess';
type TaskId = 'converge' | 'envelope' | 'excess' | 'many-runs';

const MU = dieMean();
const SIGMA = Math.sqrt(dieVariance());
const MAX_RUNS = 10;
export const ROLL_STEPS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];

/** the colour of run k on the canvas (palette key) and in the readout (CSS variable) */
const RUN_COLORS: { key: keyof Palette; css: string }[] = [
  { key: 'accent', css: '--accent' },
  { key: 'hot', css: '--hot' },
  { key: 'cold', css: '--cold' },
  { key: 'work', css: '--work' },
  { key: 'energy', css: '--energy' },
  { key: 'entropy', css: '--entropy' },
  { key: 'heat', css: '--heat' },
  { key: 'velocity', css: '--velocity' },
  { key: 'hand', css: '--hand' },
  { key: 'ink2', css: '--ink-2' },
];

const MINUS = '−';
const iso = (s: string) => `⁦${s}⁩`;
const num = (n: number) => n.toLocaleString('en');
const signed = (v: number, digits: number) => (v < 0 ? MINUS : v > 0 ? '+' : '') + Math.abs(v).toFixed(digits);

const TEXT = {
  en: {
    task: {
      converge: 'Drag across the plot from n = 10 to n = 1000. How far is each run from 3.5 at each?',
      envelope: 'Turn the envelope off and on. At n = 100, about what fraction of the runs lie inside it?',
      excess: 'Switch to the excess view. Does an early excess ever come back to zero?',
      'many-runs': 'Add runs until there are ten. At the end, how many lie inside the envelope?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: the running average of rolls of a fair die, for several runs, against the number of rolls n, with the line 3.5 and its envelope.',
    labelExcess: 'Live figure: the running sum of rolls minus 3.5 n, for several runs, against the number of rolls n, with the envelope plus and minus sigma root n.',
    keys: 'Keys: left and right arrows move the cursor along n, Enter rolls again with new seeds.',
    runs: 'runs',
    rolls: 'rolls per run',
    view: 'view',
    viewName: { average: 'running average', excess: 'excess of the sum' } satisfies Record<View, string>,
    envelope: 'envelope',
    again: 'Roll again with new seeds',
    xAxis: { average: 'rolls n (log)', excess: 'rolls n' } satisfies Record<View, string>,
    yAxis: { average: 'average of the first n rolls', excess: 'sum of the first n rolls − 3.5 n' } satisfies Record<View, string>,
    nLabel: 'rolls so far',
    run: 'run',
    inside: 'inside the envelope',
    describe: (view: View, n: number, values: number[]) =>
      `${view === 'average' ? 'Running averages' : 'Excesses'} after ${num(n)} rolls: ${values.map((v) => (view === 'average' ? v.toFixed(3) : signed(v, 1))).join(', ')}.`,
  },
  he: {
    task: {
      converge: `גררו על הגרף מ-${iso('n = 10')} עד ${iso('n = 1000')}. כמה רחוקה כל הרצה מ-${iso('3.5')} בכל אחד מהם?`,
      envelope: `כבו והדליקו את המעטפת. ב-${iso('n = 100')}, איזה חלק בערך מההרצות נמצא בתוכה?`,
      excess: 'עברו לתצוגת העודף. האם עודף מוקדם חוזר אי פעם לאפס?',
      'many-runs': 'הוסיפו הרצות עד שיש עשר. בסוף, כמה מהן בתוך המעטפת?',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: הממוצע הרץ של הטלות קובייה הוגנת, לכמה הרצות, כפונקציה של מספר ההטלות n, עם הישר 3.5 והמעטפת שלו.',
    labelExcess: 'איור חי: סכום ההטלות פחות 3.5 n, לכמה הרצות, כפונקציה של מספר ההטלות n, עם המעטפת פלוס ומינוס סיגמא שורש n.',
    keys: 'במקלדת: חיצי ימין ושמאל מזיזים את הסמן לאורך n, אנטר מטיל שוב עם זרעים חדשים.',
    runs: 'הרצות',
    rolls: 'הטלות בהרצה',
    view: 'תצוגה',
    viewName: { average: 'הממוצע הרץ', excess: 'עודף הסכום' } satisfies Record<View, string>,
    envelope: 'מעטפת',
    again: 'הטילו שוב עם זרעים חדשים',
    xAxis: { average: 'הטלות n (לוגריתמי)', excess: 'הטלות n' } satisfies Record<View, string>,
    yAxis: { average: 'ממוצע n ההטלות הראשונות', excess: `סכום n ההטלות הראשונות ${MINUS} 3.5 n` } satisfies Record<View, string>,
    nLabel: 'הטלות עד כה',
    run: 'הרצה',
    inside: 'בתוך המעטפת',
    describe: (view: View, n: number, values: number[]) =>
      `${view === 'average' ? 'הממוצעים הרצים' : 'העודפים'} אחרי ${num(n)} הטלות: ${values.map((v) => iso(view === 'average' ? v.toFixed(3) : signed(v, 1))).join(', ')}.`,
  },
} satisfies Record<Lang, unknown>;

export interface DiceAverageProps {
  id: string;
  lang: Lang;
  /** 1 to 10 */
  runs?: number;
  /** 100 to 100 000 */
  rolls?: number;
  view?: View;
  /** show the envelope 3.5 ± σ/√n (average) or ±σ√n (excess) */
  envelope?: boolean;
  seed?: number;
  tasks?: TaskId[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const cleanRuns = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), 1, MAX_RUNS) : d);
const cleanRolls = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), 100, 100000) : d);
const nearestStep = (rolls: number) => ROLL_STEPS.reduce((best, s, i) => (Math.abs(Math.log(s / rolls)) < Math.abs(Math.log(ROLL_STEPS[best] / rolls)) ? i : best), 0);

export default function DiceAverage(props: DiceAverageProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const base = { runs: cleanRuns(props.runs, 5), rolls: cleanRolls(props.rolls, 1000), view: props.view ?? 'average', envelope: props.envelope ?? true, seed: props.seed ?? 1 };
  const [runs, setRuns] = useState(base.runs);
  const [rolls, setRolls] = useState(base.rolls);
  const [view, setView] = useState<View>(base.view);
  const [envelope, setEnvelope] = useState(base.envelope);
  const [seed, setSeed] = useState(base.seed);
  /** the n the cursor reads; null means the end of the run */
  const [cursor, setCursor] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const touched = useRef({ lo: Infinity, hi: 0, envelope: false });
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  // the excess sum − 3.5 n of every run at every n; the running average is 3.5 + excess / n
  const data = useMemo(() => {
    const out: Float64Array[] = [];
    for (let k = 0; k < MAX_RUNS; k++) out.push(runningExcess(rollDice(rolls, uniform(seed * 16 + k)), MU));
    return out;
  }, [rolls, seed]);
  const indices = useMemo(() => plotIndices(rolls), [rolls]);

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        if (typeof st.runs === 'number') setRuns(cleanRuns(st.runs, base.runs));
        if (typeof st.rolls === 'number') setRolls(cleanRolls(st.rolls, base.rolls));
        if (st.view === 'average' || st.view === 'excess') setView(st.view);
        if (typeof st.envelope === 'boolean') setEnvelope(st.envelope);
      }),
    [props.id],
  );

  useEffect(() => setCursor(null), [rolls, seed]);

  const n = cursor ?? rolls;
  const valueAt = (k: number, at: number) => (view === 'average' ? MU + data[k][at - 1] / at : data[k][at - 1]);
  const values = Array.from({ length: runs }, (_, k) => valueAt(k, n));
  const half = view === 'average' ? SIGMA / Math.sqrt(n) : SIGMA * Math.sqrt(n);
  const centre = view === 'average' ? MU : 0;
  const insideCount = values.filter((v) => Math.abs(v - centre) <= half).length;

  useEffect(() => {
    setLive(L.describe(view, n, values));
    const t = props.tasks;
    if (t?.includes('converge') && view === 'average' && touched.current.lo <= 30 && touched.current.hi >= 500) markTask(`${props.id}:converge`);
    if (t?.includes('envelope') && touched.current.envelope) markTask(`${props.id}:envelope`);
    if (t?.includes('excess') && view === 'excess') markTask(`${props.id}:excess`);
    if (t?.includes('many-runs') && runs >= MAX_RUNS) markTask(`${props.id}:many-runs`);
  }, [n, view, runs, seed, rolls, envelope]);

  const draw = ({ ctx, view: vw, palette: p }: FrameInfo) => {
    const box = insetBox({ x: 0, y: 0, w: vw.w, h: vw.h }, { l: 58, r: 14, t: 12, b: 46 });
    const yMax = view === 'excess' ? niceMax(Math.max(1.15 * SIGMA * Math.sqrt(rolls), ...Array.from({ length: runs }, (_, k) => 1.05 * maxAbs(data[k]))), 5) : 0;
    const plot = makePlot(
      box,
      view === 'average' ? { min: 1, max: rolls, scale: 'log', label: L.xAxis.average } : { min: 0, max: rolls, label: L.xAxis.excess },
      view === 'average' ? { min: 1, max: 6, ticks: [1, 2, 3, 4, 5, 6], label: L.yAxis.average } : { min: -yMax, max: yMax, label: L.yAxis.excess },
    );
    plotRef.current = plot;
    drawAxes(ctx, plot, p, { dir });

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();

    const env = (m: number) => (view === 'average' ? SIGMA / Math.sqrt(m) : SIGMA * Math.sqrt(m));
    if (envelope) {
      ctx.fillStyle = withAlpha(p.ink3, 0.18);
      ctx.beginPath();
      indices.forEach((m, i) => {
        const x = plot.px(m);
        const y = plot.py(centre + env(m));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      for (let i = indices.length - 1; i >= 0; i--) ctx.lineTo(plot.px(indices[i]), plot.py(centre - env(indices[i])));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = p.ink3;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      for (const sign of [1, -1]) {
        ctx.beginPath();
        indices.forEach((m, i) => {
          const x = plot.px(m);
          const y = plot.py(centre + sign * env(m));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // the mean (average view) or zero (excess view)
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(box.x, plot.py(centre));
    ctx.lineTo(box.x + box.w, plot.py(centre));
    ctx.stroke();

    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.7;
    for (let k = 0; k < runs; k++) {
      ctx.strokeStyle = withAlpha(p[RUN_COLORS[k].key] as string, 0.9);
      ctx.beginPath();
      indices.forEach((m, i) => {
        const x = plot.px(m);
        const y = plot.py(view === 'average' ? MU + data[k][m - 1] / m : data[k][m - 1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // the cursor and the value of every run there
    const cx = plot.px(n);
    ctx.strokeStyle = p.ink2;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, box.y);
    ctx.lineTo(cx, box.y + box.h);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let k = 0; k < runs; k++) {
      ctx.fillStyle = p[RUN_COLORS[k].key] as string;
      ctx.beginPath();
      ctx.arc(cx, plot.py(values[k]), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // the label of the mean line
    ctx.save();
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.fillStyle = p.ink;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(view === 'average' ? '3.5' : '0', box.x + 6, plot.py(centre) - 4);
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [data, runs, rolls, view, envelope, cursor, narrow, props.lang]);

  const moveCursor = (m: number) => {
    const c = clamp(Math.round(m), 1, rolls);
    setCursor(c);
    touched.current.lo = Math.min(touched.current.lo, c);
    touched.current.hi = Math.max(touched.current.hi, c);
  };
  const cursorFromEvent = (e: PointerEvent) => {
    const plot = plotRef.current;
    const canvas = e.currentTarget as HTMLCanvasElement | null;
    if (!plot || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const t = clamp((e.clientX - r.left - plot.box.x) / plot.box.w, 0, 1);
    moveCursor(view === 'average' ? rolls ** t : 1 + t * (rolls - 1));
  };
  const onPointerDown = (e: PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLCanvasElement | null)?.setPointerCapture?.(e.pointerId);
    cursorFromEvent(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current) cursorFromEvent(e);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') moveCursor(view === 'average' ? Math.max(n + 1, n * 1.15) : n + rolls / 40);
    else if (e.key === 'ArrowLeft') moveCursor(view === 'average' ? Math.min(n - 1, n / 1.15) : n - rolls / 40);
    else if (e.key === 'Enter') {
      setSeed((s) => s + 1);
    } else return;
    e.preventDefault();
  };

  const stepIndex = nearestStep(rolls);

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${view === 'average' ? L.label : L.labelExcess} ${L.describe(view, n, values)} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 1.05 : 1.9}
      live={live}
      tasks={tasks}
      onReset={() => {
        setRuns(base.runs);
        setRolls(base.rolls);
        setView(base.view);
        setEnvelope(base.envelope);
        setSeed(base.seed);
        setCursor(null);
      }}
      cursor="col-resize"
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      readout={
        <span class="gas-readout">
          <span>
            {L.nLabel}: <bdi class="ltr"><b class="q">{num(n)}</b></bdi>
          </span>
          {envelope && (
            <span>
              {L.inside}: <bdi class="ltr"><b class="q">{insideCount}/{runs}</b></bdi>
            </span>
          )}
          {values.map((v, k) => (
            <span key={k}>
              <span class="swatch" style={{ display: 'inline-block', width: '0.7em', height: '0.7em', borderRadius: '50%', background: `var(${RUN_COLORS[k].css})`, marginInlineEnd: '0.35em' }} aria-hidden="true" />
              <bdi class="ltr">
                {k + 1}: <b class="q">{view === 'average' ? v.toFixed(3) : signed(v, 1)}</b>
              </bdi>
            </span>
          ))}
        </span>
      }
      controls={
        <>
          <div class="group" role="group" aria-label={L.view}>
            {(['average', 'excess'] as View[]).map((v) => (
              <Toggle key={v} label={L.viewName[v]} on={view === v} onChange={() => setView(v)} />
            ))}
            <Toggle
              label={L.envelope}
              on={envelope}
              onChange={(v) => {
                touched.current.envelope = true;
                setEnvelope(v);
              }}
            />
            <button type="button" class="toggle" onClick={() => setSeed((s) => s + 1)}>
              {L.again}
            </button>
          </div>
          <Slider label={L.runs} min={1} max={MAX_RUNS} step={1} value={runs} format={(v) => String(Math.round(v))} onChange={(v) => setRuns(Math.round(v))} />
          <Slider label={L.rolls} min={0} max={ROLL_STEPS.length - 1} step={1} value={stepIndex} format={(i) => num(ROLL_STEPS[Math.round(i)])} onChange={(i) => setRolls(ROLL_STEPS[Math.round(i)])} />
        </>
      }
    />
  );
}

function maxAbs(a: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const v = Math.abs(a[i]);
    if (v > m) m = v;
  }
  return m;
}
