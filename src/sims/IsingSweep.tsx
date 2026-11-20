/**
 * The temperature sweep (lesson 15.1, figure 15.1b): ⟨|m|⟩, the susceptibility χ', the heat capacity c and
 * the autocorrelation time τ against temperature for lattices of L = 8, 16, 32 and 64, against Onsager's
 * exact results. The figure computes it live: an annealing ladder from k_BT = 3.5 down to 1.5 for every
 * selected size, each size in its own Web Worker (src/sims/ising.worker.ts), a point posted per temperature
 * so the curves draw as the run goes. Error bars on ⟨|m|⟩ are τ-corrected (src/physics/ising.ts).
 * "Run again" draws new seeds, which is the honest way to see how rough the large-lattice peaks are.
 * Steps may set { panel, sizes, meanField }.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { meanFieldMagnetization, meanFieldTc, onsagerMagnetization, onsagerTc, type IsingObservables } from '~/physics/ising';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { fillTc, ladder, marker, peakOf, polyline } from './core/ising-view';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot } from './core/plot';
import SimShell, { Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';
import type { SweepMessage, SweepRequest } from './ising.worker';

export const ALL_SIZES = [8, 16, 32, 64];
type Panel = 'm' | 'chi' | 'c' | 'tau';
const PANELS: Panel[] = ['m', 'chi', 'c', 'tau'];
type TaskId = 'peaks' | 'slowing' | 'mean-field';

const TEMPS = ladder(3.5, 1.5, 0.05);
/** sweeps per temperature: the small lattices are cheap and decorrelate slowly in sweeps, the large ones cost most per sweep */
const SWEEPS: Record<number, number> = { 8: 20000, 16: 12000, 32: 8000, 64: 5000 };
const BURN_IN = 500;
const TC = onsagerTc();
/** colours and marker shapes per size, as in the original figure: green, amber, red, blue */
const LOOK: Record<number, { shape: number; color: (p: FrameInfo['palette']) => string }> = {
  8: { shape: 0, color: (p) => p.work },
  16: { shape: 1, color: (p) => p.energy },
  32: { shape: 2, color: (p) => p.hot },
  64: { shape: 3, color: (p) => p.cold },
};

const TEXT = {
  en: {
    task: {
      peaks: 'When the 64 × 64 run has finished, open the susceptibility panel and read where each size peaks.',
      slowing: 'Open the autocorrelation-time panel. Which size is slowest, and at what temperature?',
      'mean-field': 'Turn on the mean-field curve. Where does it order, and where does the real lattice?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: magnetization, susceptibility, heat capacity or autocorrelation time of the Ising lattice against temperature, for several lattice sizes, computed as you watch.',
    keys: 'Keys: left and right arrows change the panel, Enter draws new seeds.',
    panel: { m: 'magnetization', chi: 'susceptibility', c: 'heat capacity', tau: 'autocorrelation time' } satisfies Record<Panel, string>,
    yAxis: { m: '⟨|m|⟩', chi: "χ′ = N Var(|m|) / T", c: 'c = N Var(e) / T²', tau: 'τ of |m| (sweeps)' } satisfies Record<Panel, string>,
    xAxis: 'temperature T (units of J/k_B)',
    sizes: 'lattice sizes',
    meanField: 'mean field',
    again: 'Run again with new seeds',
    exact: 'Onsager–Yang',
    tcMF: ' (mean field)',
    progress: 'temperatures done',
    elapsed: (s: number) => `finished in ${s.toFixed(1)} s`,
    running: 'computing…',
    peakChi: 'peak of χ′',
    peakTau: 'peak of τ',
    peakC: 'peak of c',
    onsager: `Onsager's critical temperature: ${TC.toFixed(3)}`,
    describe: (panel: string, done: number, total: number) => `Panel: ${panel}. ${done} of ${total} temperatures computed.`,
  },
  he: {
    task: {
      peaks: 'כשהריצה של 64 × 64 מסתיימת, פתחו את לוח הסוספטיביליות וקראו היכן כל גודל מגיע לשיא.',
      slowing: 'פתחו את לוח זמן המתאם העצמי. איזה גודל איטי ביותר, ובאיזו טמפרטורה?',
      'mean-field': 'הדליקו את עקומת השדה הממוצע. היכן היא מסתדרת, והיכן הסריג האמיתי?',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: המגנוט, הסוספטיביליות, קיבול החום או זמן המתאם העצמי של סריג איזינג כפונקציה של הטמפרטורה, לכמה גדלי סריג, מחושבים בזמן שאתם צופים.',
    keys: 'במקלדת: חיצי ימין ושמאל מחליפים לוח, אנטר מגריל זרעים חדשים.',
    panel: { m: 'מגנוט', chi: 'סוספטיביליות', c: 'קיבול חום', tau: 'זמן מתאם עצמי' } satisfies Record<Panel, string>,
    yAxis: { m: '⟨|m|⟩', chi: "χ′ = N Var(|m|) / T", c: 'c = N Var(e) / T²', tau: 'τ של |m| (סריקות)' } satisfies Record<Panel, string>,
    xAxis: 'הטמפרטורה T (ביחידות J/k_B)',
    sizes: 'גדלי הסריג',
    meanField: 'שדה ממוצע',
    again: 'הרצה חוזרת עם זרעים חדשים',
    exact: 'אונסגר–יאנג',
    tcMF: ' (שדה ממוצע)',
    progress: 'טמפרטורות שחושבו',
    elapsed: (s: number) => `הסתיים תוך ${s.toFixed(1)} שניות`,
    running: 'מחשב…',
    peakChi: 'שיא χ′',
    peakTau: 'שיא τ',
    peakC: 'שיא c',
    onsager: `הטמפרטורה הקריטית של אונסגר: ${TC.toFixed(3)}`,
    describe: (panel: string, done: number, total: number) => `לוח: ${panel}. ${done} מתוך ${total} טמפרטורות חושבו.`,
  },
} satisfies Record<Lang, unknown>;

export interface IsingSweepProps {
  id: string;
  lang: Lang;
  /** a subset of [8, 16, 32, 64] */
  sizes?: number[];
  panel?: Panel;
  /** overlay the mean-field m(T), which orders at T_c = 4 */
  meanField?: boolean;
  tasks?: TaskId[];
}

interface SizeData {
  obs: IsingObservables[];
  done: boolean;
}

const value: Record<Panel, (o: IsingObservables) => number> = {
  m: (o) => o.absMagnetization,
  chi: (o) => o.susceptibility,
  c: (o) => o.heatCapacity,
  tau: (o) => o.tauAbsMagnetization,
};

const clampSizes = (s: unknown): number[] => (Array.isArray(s) ? ALL_SIZES.filter((n) => s.includes(n)) : ALL_SIZES);
const fmt = (v: number) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));

export default function IsingSweep(props: IsingSweepProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const [panel, setPanel] = useState<Panel>(props.panel ?? 'm');
  const [sizes, setSizes] = useState<number[]>(() => clampSizes(props.sizes));
  const [meanField, setMeanField] = useState(!!props.meanField);
  const [seed, setSeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const data = useRef<Record<number, SizeData>>({});
  const workers = useRef<Map<number, Worker>>(new Map());
  const t0 = useRef(0);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  const stop = (size: number) => {
    workers.current.get(size)?.terminate();
    workers.current.delete(size);
  };
  const start = (size: number, runSeed: number) => {
    stop(size);
    data.current[size] = { obs: [], done: false };
    const w = new Worker(new URL('./ising.worker.ts', import.meta.url), { type: 'module' });
    workers.current.set(size, w);
    w.onmessage = (e: MessageEvent<SweepMessage>) => {
      const msg = e.data;
      const d = data.current[msg.size];
      if (!d) return;
      if (msg.type === 'point') d.obs[msg.index] = msg.obs;
      else {
        d.done = true;
        stop(msg.size);
        const mine = sizesRef.current;
        if (mine.every((n) => data.current[n]?.done)) setElapsed((performance.now() - t0.current) / 1000);
      }
      setTick((n) => n + 1);
    };
    const req: SweepRequest = { size, seed: runSeed * 1000 + size, temps: TEMPS, sweeps: SWEEPS[size], burnIn: BURN_IN };
    w.postMessage(req);
  };
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;

  // the first run, on mount; and every "run again"
  useEffect(() => {
    t0.current = performance.now();
    setElapsed(null);
    for (const n of Object.keys(data.current)) if (!sizesRef.current.includes(Number(n))) delete data.current[Number(n)];
    for (const n of sizesRef.current) start(n, seed);
    return () => {
      for (const n of Array.from(workers.current.keys())) stop(n);
    };
  }, [seed]);

  const toggleSize = (n: number) => {
    const on = sizes.includes(n);
    const next = on ? sizes.filter((s) => s !== n) : ALL_SIZES.filter((s) => s === n || sizes.includes(s));
    sizesRef.current = next;
    setSizes(next);
    if (on) {
      // a half-finished run of a hidden size is not worth the core it takes
      if (!data.current[n]?.done) {
        stop(n);
        delete data.current[n];
      }
    } else if (!data.current[n]) {
      if (elapsed !== null) t0.current = performance.now();
      setElapsed(null);
      start(n, seed);
    }
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        if (PANELS.includes(st.panel as Panel)) setPanel(st.panel as Panel);
        if (typeof st.meanField === 'boolean') setMeanField(st.meanField);
        if (Array.isArray(st.sizes)) {
          const next = clampSizes(st.sizes);
          sizesRef.current = next;
          setSizes(next);
          for (const n of next) if (!data.current[n]) start(n, seed);
        }
      }),
    [props.id],
  );

  const shown = sizes.filter((n) => data.current[n]);
  const total = sizes.length * TEMPS.length;
  const done = sizes.reduce((a, n) => a + (data.current[n]?.obs.filter(Boolean).length ?? 0), 0);

  useEffect(() => {
    const id = props.id;
    const want = (t: TaskId) => props.tasks?.includes(t);
    if (want('peaks') && panel === 'chi' && data.current[64]?.done) markTask(`${id}:peaks`);
    if (want('slowing') && panel === 'tau') markTask(`${id}:slowing`);
    if (want('mean-field') && meanField) markTask(`${id}:mean-field`);
  }, [panel, meanField, tick]);

  useEffect(() => setLive(L.describe(L.panel[panel], done, total)), [panel, done === total]);

  const xMax = meanField ? 4.2 : 3.6;

  const draw = ({ ctx, view, palette: p }: FrameInfo) => {
    const plotBox = insetBox({ x: 0, y: 0, w: view.w, h: view.h }, { l: 60, r: 16, t: 34, b: 46 });
    const sets = shown.map((n) => ({ n, d: data.current[n] }));
    const pts = (n: number) => TEMPS.map((T, i) => ({ T, o: data.current[n].obs[i] })).filter((x) => x.o);
    let yAxis;
    if (panel === 'm') yAxis = { min: 0, max: 1.05 };
    else if (panel === 'tau') {
      const top = Math.max(10, ...sets.flatMap(({ n }) => pts(n).map((x) => x.o.tauAbsMagnetization)));
      yAxis = { min: 0.4, max: 10 ** Math.ceil(Math.log10(top * 1.3)), scale: 'log' as const };
    } else {
      const top = Math.max(2, ...sets.flatMap(({ n }) => pts(n).map((x) => value[panel](x.o))));
      yAxis = { min: 0, max: top * 1.1 };
    }
    const plot = makePlot(plotBox, { min: 1.5, max: xMax, label: L.xAxis, ticks: meanField ? [1.5, 2, 2.5, 3, 3.5, 4] : [1.5, 2, 2.5, 3, 3.5] }, { ...yAxis, label: L.yAxis[panel] });
    drawAxes(ctx, plot, p, { dir });

    // Onsager's T_c, and the exact curve on the magnetization panel
    ctx.save();
    ctx.strokeStyle = p.ink2;
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(plot.px(TC), plotBox.y);
    ctx.lineTo(plot.px(TC), plotBox.y + plotBox.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = p.ink2;
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    fillTc(ctx, plot.px(TC) + 4, plotBox.y + 4, 'left');
    ctx.restore();
    if (panel === 'm') drawCurve(ctx, plot, onsagerMagnetization, { color: p.ink, width: 2.2, samples: 500 });
    if (meanField) {
      if (panel === 'm') drawCurve(ctx, plot, (T) => meanFieldMagnetization(T), { color: p.hand, width: 2, dash: [3, 4], samples: 300 });
      const x = plot.px(meanFieldTc());
      ctx.save();
      ctx.strokeStyle = p.hand;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, plotBox.y);
      ctx.lineTo(x, plotBox.y + plotBox.h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = p.hand;
      ctx.font = `600 12px ${p.fontUi}`;
      ctx.direction = 'ltr';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      fillTc(ctx, x - 4, plotBox.y + 4, 'right', L.tcMF);
      ctx.restore();
    }

    // the data: a line, markers, and for |m| the τ-corrected error bars
    for (const { n } of sets) {
      const look = LOOK[n];
      const color = look.color(p);
      const P = pts(n);
      polyline(ctx, plot, P.map((x) => x.T), P.map((x) => value[panel](x.o)), withAlpha(color, 0.55), 1.2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotBox.x - 6, plotBox.y - 6, plotBox.w + 12, plotBox.h + 12);
      ctx.clip();
      for (const { T, o } of P) {
        const sx = plot.px(T);
        const v = value[panel](o);
        if (panel === 'm') {
          const e = o.absMagnetizationError;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(sx, plot.py(v - e));
          ctx.lineTo(sx, plot.py(v + e));
          ctx.stroke();
        }
        marker(ctx, sx, plot.py(v), look.shape, 3.2, color);
      }
      ctx.restore();
    }
    // the peaks, on the panels that have one
    if (panel === 'chi' || panel === 'tau' || panel === 'c') {
      for (const { n } of sets) {
        const P = pts(n);
        const pk = peakOf(P.map((x) => x.T), P.map((x) => value[panel](x.o)));
        if (!pk || !data.current[n].done) continue;
        ctx.save();
        marker(ctx, plot.px(pk.T), plot.py(pk.y), LOOK[n].shape, 6.5, null, p.ink);
        ctx.restore();
      }
    }
    // legend above the plot: the sizes, named by marker as well as colour
    ctx.save();
    ctx.font = `600 12px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let lx = plotBox.x;
    const ly = 14;
    // on a phone the tool buttons take the right end of this row: shorten the names
    if (narrow) {
      ctx.fillStyle = p.ink;
      ctx.fillText('L', lx, ly);
      lx += 12;
    }
    const entries: { n: number; text: string }[] = ALL_SIZES.filter((n) => sizes.includes(n)).map((n) => ({ n, text: narrow ? `${n}` : `L = ${n}` }));
    for (const { n, text } of entries) {
      marker(ctx, lx + 5, ly, LOOK[n].shape, 4, LOOK[n].color(p));
      ctx.fillStyle = p.ink;
      ctx.fillText(text, lx + 14, ly);
      lx += 14 + ctx.measureText(text).width + (narrow ? 8 : 14);
    }
    if (panel === 'm') {
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 18, ly);
      ctx.stroke();
      ctx.fillStyle = p.ink;
      ctx.fillText(L.exact, lx + 24, ly);
    }
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [tick, panel, sizes, meanField, narrow]);

  const onKeyDown = (e: KeyboardEvent) => {
    const i = PANELS.indexOf(panel);
    if (e.key === 'ArrowRight') setPanel(PANELS[Math.min(PANELS.length - 1, i + 1)]);
    else if (e.key === 'ArrowLeft') setPanel(PANELS[Math.max(0, i - 1)]);
    else if (e.key === 'Enter') setSeed((s) => s + 1);
    else return;
    e.preventDefault();
  };

  const finished = sizes.length > 0 && sizes.every((n) => data.current[n]?.done);
  const peakLabel = panel === 'tau' ? L.peakTau : panel === 'c' ? L.peakC : L.peakChi;
  /** the peak of the panel's curve for one size, from the temperatures computed so far */
  const peakValue = (n: number) => {
    const P = (data.current[n]?.obs ?? []).map((o, i) => (o ? { T: TEMPS[i], y: value[panel === 'm' ? 'chi' : panel](o) } : null)).filter((x): x is { T: number; y: number } => !!x);
    return peakOf(P.map((x) => x.T), P.map((x) => x.y));
  };

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${L.describe(L.panel[panel], done, total)} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 1.05 : 1.9}
      live={live}
      tasks={tasks}
      onReset={() => {
        setPanel(props.panel ?? 'm');
        setMeanField(!!props.meanField);
        setSizes(clampSizes(props.sizes));
        sizesRef.current = clampSizes(props.sizes);
        setSeed(1);
      }}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          {panel === 'm' ? (
            <span>{L.onsager}</span>
          ) : (
            ALL_SIZES.filter((n) => sizes.includes(n)).map((n) => {
              const d = data.current[n];
              const pk = d?.done ? peakValue(n) : null;
              return (
                <span key={n}>
                  <bdi class="ltr">L = {n}</bdi> · {peakLabel}:{' '}
                  <bdi class="ltr">
                    <b class="q">{pk ? `${fmt(pk.y)} @ T = ${pk.T.toFixed(2)}` : '…'}</b>
                  </bdi>
                </span>
              );
            })
          )}
          <span class="gas-previous">
            {finished ? (elapsed !== null ? L.elapsed(elapsed) : '') : `${L.running} ${L.progress}: ${done}/${total}`}{' '}
            <progress value={done} max={Math.max(1, total)} aria-label={L.progress} style={{ verticalAlign: 'middle', width: '8em' }} />
          </span>
        </span>
      }
      controls={
        <>
          <div class="group" role="group" aria-label={L.panel[panel]}>
            {PANELS.map((k) => (
              <Toggle key={k} label={L.panel[k]} on={panel === k} onChange={() => setPanel(k)} />
            ))}
          </div>
          <div class="group" role="group" aria-label={L.sizes}>
            {ALL_SIZES.map((n) => (
              <Toggle key={n} label={<bdi class="ltr">L = {n}</bdi>} on={sizes.includes(n)} onChange={() => toggleSize(n)} swatch={undefined} />
            ))}
          </div>
          <div class="group">
            <Toggle label={L.meanField} on={meanField} onChange={setMeanField} />
            <button type="button" class="toggle" onClick={() => setSeed((s) => s + 1)}>
              {L.again}
            </button>
          </div>
        </>
      }
    />
  );
}
