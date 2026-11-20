/**
 * The same relaxation at three system sizes (lesson 1.1, figure fig-1-1b). Each panel is one run of the pair of
 * src/physics/equilibrium.ts: the relative gap (T_A − T_B)/(T_A(0) − T_B(0)) against the steps in units of the
 * relaxation time τ, with the dashed prediction e^(−t/τ). The pairs are nA = base, base·factor, base·factor² and
 * nB = ratio·nA, so the sizes differ by `factor` from one panel to the next while the physics is the same.
 *
 * Readout per panel: N = nA + nB, the RMS deviation of the run from the prediction over its 6τ steps, and that
 * RMS averaged over `average` runs (this one and others from other seeds); then the ratios of successive RMS
 * values against √factor, the N^(−1/2) law. One run's RMS is itself noisy (its ratio between two panels is a ratio of
 * two noisy numbers: for a factor of 10, one run in ten gives below about 2 and one in ten above about 5), which is why the averaged ratios are shown beside it.
 * The figure computes; it does not animate. Steps may set { base, factor, ratio, tA, tB, seed }.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { cleanCount, cleanNumber, panelPairs, runPanel, successiveRatios, T_MAX, T_MIN } from './core/equilibrium-view';
import { polyline } from './core/ising-view';
import { drawAxes, drawCurve, insetBox, makePlot } from './core/plot';
import SimShell, { Slider, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

type TaskId = 'scatter-shrinks' | 'ratio' | 'time-units';

const iso = (s: string) => `⁦${s}⁩`;
const MINUS = '−';
const BASE_RANGE = [5, 50] as const;
const FACTOR_RANGE = [2, 10] as const;
const AVERAGE = 16;

const TEXT = {
  en: {
    task: {
      'scatter-shrinks': 'Draw new seeds a few times. In which panel is the scatter around the dashed curve smallest, every time?',
      ratio: 'Change the factor. Do the ratios of the averaged RMS values stay near the square root of the factor?',
      'time-units': 'Change the base size. Do the three curves still fall along e^(−t/τ), with time counted in units of τ?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: three panels, one pair of bodies at three sizes, each showing the relative temperature gap against time in units of the relaxation time, with the predicted exponential and the scatter around it, smaller for the larger pairs.',
    base: 'oscillators of the smallest A, base',
    factor: 'size ratio between panels, factor',
    again: 'New seeds',
    xAxis: 'steps / τ',
    yAxis: 'relative gap',
    n: 'N',
    rms: 'RMS deviation',
    runLabel: 'this run',
    meanLabel: `mean of ${AVERAGE} runs`,
    ratios: 'ratio of successive RMS values',
    expected: 'expected √factor',
    describe: (rows: { n: number; rms: number }[]) =>
      `Three panels of ${rows.map((r) => r.n).join(', ')} oscillators, with RMS deviations from the prediction ${rows.map((r) => r.rms.toFixed(3)).join(', ')}.`,
  },
  he: {
    task: {
      'scatter-shrinks': 'הגרילו זרעים חדשים כמה פעמים. באיזה פאנל הפיזור סביב העקומה המקווקוות הוא הקטן ביותר, בכל פעם?',
      ratio: `שנו את הגורם. האם היחסים בין ערכי ${iso('RMS')} הממוצעים נשארים קרובים לשורש הגורם?`,
      'time-units': `שנו את הגודל הבסיסי. האם שלוש העקומות עדיין נופלות על ${iso('e^(' + MINUS + 't/τ)')}, כשהזמן נמדד ביחידות של ${iso('τ')}?`,
    } satisfies Record<TaskId, string>,
    label: 'איור חי: שלושה פאנלים, זוג גופים אחד בשלושה גדלים, וכל אחד מראה את הפער היחסי בטמפרטורות כפונקציה של הזמן ביחידות של זמן הרלקסציה, עם המעריכית החזויה והפיזור סביבה, קטן יותר בזוגות הגדולים.',
    base: 'מספר המתנדים ב-A הקטן ביותר, הבסיס',
    factor: 'הגורם בין הגדלים של פאנלים סמוכים',
    again: 'זרעים חדשים',
    xAxis: `צעדים / ${iso('τ')}`,
    yAxis: 'הפער היחסי',
    n: 'N',
    rms: 'סטיית RMS',
    runLabel: 'ההרצה הזו',
    meanLabel: `ממוצע של ${AVERAGE} הרצות`,
    ratios: 'היחס בין ערכי RMS סמוכים',
    expected: `צפוי: שורש הגורם`,
    describe: (rows: { n: number; rms: number }[]) =>
      `שלושה פאנלים של ${rows.map((r) => r.n).join(', ')} מתנדים, עם סטיות RMS מהניבוי ${rows.map((r) => r.rms.toFixed(3)).join(', ')}.`,
  },
} satisfies Record<Lang, unknown>;

export interface RelaxationScaleProps {
  id: string;
  lang: Lang;
  /** oscillators of A in the smallest pair, 5 to 50 */
  base?: number;
  /** size ratio between panels, 2 to 10 */
  factor?: number;
  /** nB / nA, 0.2 to 10 */
  ratio?: number;
  /** starting temperatures in ε/k_B, 0.5 to 10 (they must differ) */
  tA?: number;
  tB?: number;
  seed?: number;
  tasks?: TaskId[];
}

interface Params {
  base: number;
  factor: number;
  ratio: number;
  tA: number;
  tB: number;
}

const fromProps = (p: RelaxationScaleProps): Params => ({
  base: cleanCount(p.base, BASE_RANGE[0], BASE_RANGE[1], 20),
  factor: cleanCount(p.factor, FACTOR_RANGE[0], FACTOR_RANGE[1], 10),
  ratio: cleanNumber(p.ratio, 0.2, 10, 3),
  tA: cleanNumber(p.tA, T_MIN, T_MAX, 4),
  tB: cleanNumber(p.tB, T_MIN, T_MAX, 1),
});

export default function RelaxationScale(props: RelaxationScaleProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const baseSeed = typeof props.seed === 'number' && Number.isFinite(props.seed) ? Math.round(props.seed) : 1;
  const [params, setParams] = useState<Params>(() => fromProps(props));
  const [seed, setSeed] = useState(baseSeed);
  const [live, setLive] = useState('');
  const touched = useRef({ draws: 0, factor: false, base: false });
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  const data = useMemo(() => {
    // equal temperatures leave no gap to follow: nudge the cold side apart rather than throw
    const tB = params.tA === params.tB ? params.tB + 0.5 : params.tB;
    const panels = panelPairs(params.base, params.factor, params.ratio, params.tA, tB);
    return panels.map((p, k) => ({ panel: p, run: runPanel(p, seed * 101 + k * 13, AVERAGE) }));
  }, [params, seed]);

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        setParams((cur) => ({
          base: cleanCount(st.base, BASE_RANGE[0], BASE_RANGE[1], cur.base),
          factor: cleanCount(st.factor, FACTOR_RANGE[0], FACTOR_RANGE[1], cur.factor),
          ratio: cleanNumber(st.ratio, 0.2, 10, cur.ratio),
          tA: cleanNumber(st.tA, T_MIN, T_MAX, cur.tA),
          tB: cleanNumber(st.tB, T_MIN, T_MAX, cur.tB),
        }));
        if (typeof st.seed === 'number' && Number.isFinite(st.seed)) setSeed(Math.round(st.seed));
      }),
    [props.id],
  );

  const rmsRun = data.map((d) => d.run.rms);
  const rmsMean = data.map((d) => d.run.rmsMean);
  const ratiosRun = successiveRatios(rmsRun);
  const ratiosMean = successiveRatios(rmsMean);
  const expected = Math.sqrt(params.factor);

  useEffect(() => {
    setLive(L.describe(data.map((d) => ({ n: d.panel.nA + d.panel.nB, rms: d.run.rms }))));
    const want = (t: TaskId) => props.tasks?.includes(t);
    if (want('scatter-shrinks') && touched.current.draws >= 3) markTask(`${props.id}:scatter-shrinks`);
    if (want('ratio') && touched.current.factor) markTask(`${props.id}:ratio`);
    if (want('time-units') && touched.current.base) markTask(`${props.id}:time-units`);
  }, [data]);

  const draw = ({ ctx, view: vw, palette: p }: FrameInfo) => {
    const cols = narrow ? 1 : 3;
    const pw = vw.w / cols;
    const ph = vw.h / (narrow ? 3 : 1);
    data.forEach(({ panel, run }, k) => {
      const cell = { x: narrow ? 0 : k * pw, y: narrow ? k * ph : 0, w: pw, h: ph };
      const box = insetBox(cell, { l: narrow ? 52 : k === 0 ? 50 : 38, r: 14, t: 26, b: 42 });
      const plot = makePlot(
        box,
        { min: 0, max: 6, ticks: [0, 1, 2, 3, 4, 5, 6], label: L.xAxis, format: (v) => String(v) },
        { min: -0.4, max: 1.1, ticks: [-0.4, 0, 0.5, 1], label: narrow || k === 0 ? L.yAxis : undefined, format: (v) => (v < 0 ? MINUS + Math.abs(v) : String(v)) },
      );
      drawAxes(ctx, plot, p, { dir });
      drawCurve(ctx, plot, (x) => Math.exp(-x), { color: p.ink, width: 1.8, dash: [6, 5] });
      polyline(ctx, plot, run.x, run.gap, p.accent, 1.5);
      ctx.save();
      ctx.font = `600 12px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.ink;
      ctx.fillText(`N = ${panel.nA + panel.nB}`, box.x + 6, box.y - 12);
      ctx.restore();
    });
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [data, narrow, props.lang]);

  const num = (v: number) => v.toFixed(3);
  const ratio2 = (v: number) => v.toFixed(2);

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${L.describe(data.map((d) => ({ n: d.panel.nA + d.panel.nB, rms: d.run.rms })))}`}
      canvasRef={canvasRef}
      aspect={narrow ? 0.62 : 2.1}
      live={live}
      tasks={tasks}
      onReset={() => {
        setParams(fromProps(props));
        setSeed(baseSeed);
      }}
      readout={
        <span class="gas-readout">
          {data.map(({ panel, run }, k) => (
            <span key={k}>
              <bdi class="ltr">
                N = <b class="q">{panel.nA + panel.nB}</b>
              </bdi>
              {': '}
              {L.rms} <bdi class="ltr"><b class="q">{num(run.rms)}</b></bdi>
              {` (${L.runLabel}), `}
              <bdi class="ltr"><b class="q">{num(run.rmsMean)}</b></bdi>
              {` (${L.meanLabel})`}
            </span>
          ))}
          <span>
            {L.ratios}: <bdi class="ltr"><b class="q">{ratiosRun.map(ratio2).join(', ')}</b></bdi>
            {` (${L.runLabel}), `}
            <bdi class="ltr"><b class="q">{ratiosMean.map(ratio2).join(', ')}</b></bdi>
            {` (${L.meanLabel})`}
          </span>
          <span>
            {L.expected}: <bdi class="ltr"><b class="q">{ratio2(expected)}</b></bdi>
          </span>
        </span>
      }
      controls={
        <>
          <Slider
            label={L.base}
            min={BASE_RANGE[0]}
            max={BASE_RANGE[1]}
            step={1}
            value={params.base}
            format={(v) => String(Math.round(v))}
            onChange={(v) => {
              touched.current.base = true;
              setParams({ ...params, base: Math.round(v) });
            }}
          />
          <Slider
            label={L.factor}
            min={FACTOR_RANGE[0]}
            max={FACTOR_RANGE[1]}
            step={1}
            value={params.factor}
            format={(v) => String(Math.round(v))}
            onChange={(v) => {
              touched.current.factor = true;
              setParams({ ...params, factor: Math.round(v) });
            }}
          />
          <div class="group">
            <button
              type="button"
              class="toggle"
              onClick={() => {
                touched.current.draws++;
                setSeed((s) => s + 1);
              }}
            >
              {L.again}
            </button>
          </div>
        </>
      }
    />
  );
}
