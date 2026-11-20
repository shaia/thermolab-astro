/**
 * Sums collapsing onto the Gaussian, live (lesson 3.1, figure fig-3-1b). The model is src/physics/sampling.ts.
 *
 * `view: 'standardised'`: the density of (S_n − nμ)/(σ√n) for each chosen distribution (a fair ±1 coin, uniform
 * on [−1, 1], Student-t with 5 degrees of freedom, and the persistent ±1 walk) against the dashed standard
 * Gaussian, from 4 000 sums each. The persistent walk is standardised by the same formula as the coin, so it stays
 * too wide: its variance is inflated by (1 + q)/(1 − q) for persistence q. The readout gives each distribution's
 * Kolmogorov distance from the Gaussian (a true Gaussian sample of 4 000 sits near 0.014) and the variance ratio.
 * `view: 'binomial'`: the exact binomial pmf of the ±1 walk's number of right steps at n against the
 * de Moivre–Laplace Gaussian of mean np and variance np(1 − p), a strip under it with the difference (or, on the
 * log axis, the relative error), and the error read out: the largest gap, and the relative error at ±3σ.
 *
 * The sums grow one term at a time in slices of ten milliseconds, so a jump from n = 1 to n = 400 does not freeze
 * the page; going to a smaller n starts the sums again, from the same seed. Nothing animates, so nothing needs to
 * stop when the figure is off screen.
 *
 * Steps may set { n, dists, view, persistence, seed, p, log }; `p` (the binomial's probability, default 1/2) and
 * `log` (a log axis for the binomial, to see the tails) are additions.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { correlatedVarianceFactor, gaussianPdf } from '~/physics/sampling';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import {
  binomialFrame,
  CLT_DISTS,
  CLT_SAMPLES,
  CltEnsemble,
  cleanDists,
  cleanN,
  cleanP,
  cleanPersistence,
  DENSITY_SPAN,
  errorStrip,
  latticeFloor,
  measure,
  N_MAX,
  nFromSlider,
  rowKey,
  sliderFromN,
  standardGaussian,
  standardisedDensity,
  type CltDist,
} from './core/clt-view';
import { sci } from './core/format';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, insetBox, makePlot, niceTicks, type Box } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

type View = 'standardised' | 'binomial';
type TaskId = 'collapse' | 'correlated' | 'binomial' | 'tails';

const MINUS = '−';
const iso = (s: string) => `⁦${s}⁩`;
const signed = (s: string) => s.replace('-', MINUS);
const tick = (v: number) => signed(sci(v, 2));
const fix = (v: number, d = 3) => v.toFixed(d);
const pct = (v: number) => `${(100 * v).toFixed(v < 0.1 ? 2 : 1)}%`;

const FORMULA = `(S_n ${MINUS} nμ)/(σ√n)`;

const TEXT = {
  en: {
    task: {
      collapse: 'Start at n = 1 and raise n to 64 or more. What happens to the three distributions of independent steps?',
      correlated: 'Show the correlated walk, set its persistence to 0.7 or more and raise n to 64 or more. Does it collapse too?',
      binomial: 'In the binomial view, compare n = 10 with n = 100 or more. How does the gap between the bars and the curve change?',
      tails: 'In the binomial view at n = 100 or more, read the error at three standard deviations. Is it as small as at the peak?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: sums of random steps. The standardised view shows the density of the standardised sum for several step distributions against the standard Gaussian; the binomial view shows the exact binomial against its de Moivre–Laplace Gaussian.',
    keys: 'Keys: left and right arrows change n, Enter draws a new seed.',
    n: 'terms in the sum n',
    view: { standardised: 'standardised', binomial: 'binomial' } satisfies Record<View, string>,
    dist: 'step distribution',
    distName: {
      pm1: '±1 coin',
      uniform: 'uniform on [−1, 1]',
      heavy: 'heavy tail (Student-t, ν = 5)',
      correlated: 'persistent ±1 walk',
    } satisfies Record<CltDist, string>,
    distShort: { pm1: '±1 coin', uniform: 'uniform', heavy: 'heavy tail', correlated: 'persistent' } satisfies Record<CltDist, string>,
    persistence: 'persistence q',
    p: 'probability of a right step p',
    log: 'log axis',
    again: 'New seed',
    xStd: `standardised sum ${FORMULA}`,
    yDensity: 'density',
    gauss: 'standard Gaussian',
    xK: 'right steps k',
    yPmf: 'probability',
    exact: 'exact binomial',
    gaussBin: 'Gaussian, mean np, variance np(1 − p)',
    yStripAbs: 'σ × difference (10⁻³)',
    yStripRel: 'relative error',
    distance: 'distance D',
    variance: 'variance',
    expected: 'expected',
    computing: 'computing…',
    floor: 'a true Gaussian sample of this size has D ≈ 0.014',
    lattice: 'the ±1 coins sit on a lattice, which alone adds',
    maxGap: 'largest gap',
    scaled: 'times σ',
    tailAt: 'error at ±3σ',
    row: (name: string, ks: string, variance: string) => `${name}: D ${ks}, variance ${variance}`,
    describeStd: (n: number, rows: string) => `n = ${n}. ${rows}`,
    describeBin: (n: number, p: number, gap: number, tail: number) => `Binomial, n = ${n}, p = ${p}: largest gap between the exact pmf and the Gaussian ${gap.toExponential(2)}, relative error at three standard deviations ${pct(tail)}.`,
  },
  he: {
    task: {
      collapse: `התחילו ב-${iso('n = 1')} והעלו את ${iso('n')} ל-64 או יותר. מה קורה לשלוש ההתפלגויות של הצעדים הבלתי תלויים?`,
      correlated: `הציגו את ההילוך המתמיד, קבעו את ההתמדה ${iso('q')} ל-0.7 או יותר והעלו את ${iso('n')} ל-64 או יותר. האם גם הוא מתלכד?`,
      binomial: `בתצוגה הבינומית, השוו בין ${iso('n = 10')} ל-${iso('n = 100')} או יותר. איך משתנה הפער בין העמודות לעקומה?`,
      tails: `בתצוגה הבינומית ב-${iso('n = 100')} או יותר, קראו את השגיאה בשלוש סטיות תקן. האם היא קטנה כמו בשיא?`,
    } satisfies Record<TaskId, string>,
    label: 'איור חי: סכומים של צעדים אקראיים. התצוגה המתוקננת מראה את צפיפות הסכום המתוקנן של כמה התפלגויות צעד מול הגאוסית הסטנדרטית; התצוגה הבינומית מראה את ההתפלגות הבינומית המדויקת מול הגאוסית של דה-מואבר-לפלס.',
    keys: `במקלדת: מקשי החצים ימינה ושמאלה משנים את ${iso('n')}, מקש Enter מגריל זרע חדש.`,
    n: `מספר האיברים בסכום ${iso('n')}`,
    view: { standardised: 'מתוקננת', binomial: 'בינומית' } satisfies Record<View, string>,
    dist: 'התפלגות הצעד',
    distName: {
      pm1: `מטבע ${iso('±1')}`,
      uniform: `אחיד על ${iso('[−1, 1]')}`,
      heavy: `זנב כבד (${iso('t')} של סטודנט, ${iso('ν = 5')})`,
      correlated: `הילוך מתמיד ${iso('±1')}`,
    } satisfies Record<CltDist, string>,
    distShort: { pm1: `מטבע ${iso('±1')}`, uniform: 'אחיד', heavy: 'זנב כבד', correlated: 'מתמיד' } satisfies Record<CltDist, string>,
    persistence: `התמדה ${iso('q')}`,
    p: `הסתברות לצעד ימינה ${iso('p')}`,
    log: 'ציר לוגריתמי',
    again: 'זרע חדש',
    xStd: `הסכום המתוקנן ${iso(FORMULA)}`,
    yDensity: 'צפיפות',
    gauss: 'הגאוסית הסטנדרטית',
    xK: `מספר הצעדים ימינה ${iso('k')}`,
    yPmf: 'הסתברות',
    exact: 'בינומית מדויקת',
    gaussBin: `גאוסית, תוחלת ${iso('np')}, שונות ${iso('np(1 − p)')}`,
    yStripAbs: `${iso('σ')} כפול הפרש (${iso('10⁻³')})`,
    yStripRel: 'שגיאה יחסית',
    distance: `מרחק ${iso('D')}`,
    variance: 'שונות',
    expected: 'צפויה',
    computing: 'בחישוב…',
    floor: `למדגם גאוסי אמיתי בגודל כזה ${iso('D ≈ 0.014')}`,
    lattice: `מטבעות ${iso('±1')} יושבים על סריג, וזה לבדו מוסיף`,
    maxGap: 'הפער הגדול ביותר',
    scaled: `כפול ${iso('σ')}`,
    tailAt: `שגיאה ב-${iso('±3σ')}`,
    row: (name: string, ks: string, variance: string) => `${name}: ${iso(`D = ${ks}`)}, שונות ${iso(variance)}`,
    describeStd: (n: number, rows: string) => `${iso(`n = ${n}`)}. ${rows}`,
    describeBin: (n: number, p: number, gap: number, tail: number) =>
      `בינומית, ${iso(`n = ${n}, p = ${p}`)}: הפער הגדול ביותר בין ההסתברות המדויקת לגאוסית ${iso(gap.toExponential(2))}, שגיאה יחסית בשלוש סטיות תקן ${iso(pct(tail))}.`,
  },
} satisfies Record<Lang, unknown>;

export interface CltCollapseProps {
  id: string;
  lang: Lang;
  /** terms in the sum, 1 to 400 (default 1) */
  n?: number;
  /** which of 'pm1' | 'uniform' | 'heavy' | 'correlated' to show (default all four) */
  dists?: CltDist[];
  view?: View;
  /** persistence of the correlated walk (default 0.5) */
  persistence?: number;
  seed?: number;
  /** the binomial's probability of a right step (default 0.5) */
  p?: number;
  /** a log probability axis in the binomial view */
  log?: boolean;
  tasks?: TaskId[];
}

const COLOUR: Record<CltDist, keyof Palette> = { pm1: 'cold', uniform: 'work', heavy: 'entropy', correlated: 'hot' };
const CSS_VAR: Record<CltDist, string> = { pm1: 'var(--cold)', uniform: 'var(--work)', heavy: 'var(--entropy)', correlated: 'var(--hot)' };
const INDEPENDENT: readonly CltDist[] = ['pm1', 'uniform', 'heavy'];

/** a marker shape for each distribution, so that colour is not the only thing telling them apart */
function marker(ctx: CanvasRenderingContext2D, kind: CltDist, x: number, y: number, r: number) {
  ctx.beginPath();
  if (kind === 'pm1') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === 'uniform') ctx.rect(x - r, y - r, 2 * r, 2 * r);
  else if (kind === 'heavy') {
    ctx.moveTo(x, y - r * 1.2);
    ctx.lineTo(x + r * 1.1, y + r * 0.8);
    ctx.lineTo(x - r * 1.1, y + r * 0.8);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y - r * 1.3);
    ctx.lineTo(x + r * 1.3, y);
    ctx.lineTo(x, y + r * 1.3);
    ctx.lineTo(x - r * 1.3, y);
    ctx.closePath();
  }
  ctx.fill();
}

interface Shown {
  key: string;
  n: number;
  x: Float64Array;
  y: Float64Array;
  ks: number;
  variance: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function CltCollapse(props: CltCollapseProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const base = {
    n: cleanN(props.n, 1),
    dists: cleanDists(props.dists, CLT_DISTS),
    view: (props.view === 'binomial' ? 'binomial' : 'standardised') as View,
    persistence: cleanPersistence(props.persistence, 0.5),
    seed: typeof props.seed === 'number' && Number.isFinite(props.seed) ? Math.round(props.seed) : 1,
    p: cleanP(props.p, 0.5),
    log: props.log === true,
  };
  /** the slider's n at once, and the n the figure computes for once the slider has rested */
  const [nLive, setNLive] = useState(base.n);
  const [n, setN] = useState(base.n);
  const [dists, setDists] = useState<CltDist[]>(base.dists);
  const [view, setView] = useState<View>(base.view);
  const [persistence, setPersistence] = useState(base.persistence);
  const [seed, setSeed] = useState(base.seed);
  const [p, setP] = useState(base.p);
  const [log, setLog] = useState(base.log);
  const [live, setLive] = useState('');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const shown = useRef<Partial<Record<CltDist, Shown>>>({});
  const visited = useRef(new Set<number>());
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));
  const ens = useMemo(() => new CltEnsemble(CLT_SAMPLES, seed, base.persistence), [seed]);
  const distsKey = dists.join(',');

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
        if (st.dists !== undefined) setDists(cleanDists(st.dists, CLT_DISTS));
        if (st.view === 'standardised' || st.view === 'binomial') setView(st.view);
        if (typeof st.persistence === 'number') setPersistence(cleanPersistence(st.persistence, base.persistence));
        if (typeof st.seed === 'number' && Number.isFinite(st.seed)) setSeed(Math.round(st.seed));
        if (typeof st.p === 'number') setP(cleanP(st.p, base.p));
        if (typeof st.log === 'boolean') setLog(st.log);
      }),
    [props.id],
  );

  // grow the sums toward n in slices; what is ready is measured and kept, what is not keeps its last picture
  useEffect(() => {
    if (view !== 'standardised') return;
    ens.setPersistence(persistence);
    let cancelled = false;
    let timer = 0;
    const work = () => {
      if (cancelled) return;
      const done = ens.advanceTo(n, dists, 10);
      let changed = false;
      for (const d of dists) {
        const key = rowKey(seed, n, persistence, d);
        if (ens.termsOf(d) !== n || shown.current[d]?.key === key) continue;
        const z = ens.standardised(d);
        const m = measure(z);
        const { x, y } = standardisedDensity(z, d, n);
        shown.current[d] = { key, n, x, y, ks: m.ks, variance: m.varianceRatio };
        changed = true;
      }
      if (changed) setVersion((v) => v + 1);
      setBusy(!done);
      if (!done) timer = window.setTimeout(work, 0);
    };
    work();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [n, distsKey, persistence, seed, view]);

  const frame = useMemo(() => (view === 'binomial' ? binomialFrame(nLive, p) : null), [view, nLive, p]);

  useEffect(() => {
    const t = props.tasks;
    if (view === 'binomial') visited.current.add(n);
    const seen = [...visited.current];
    const independent = dists.filter((d) => INDEPENDENT.includes(d)).length;
    if (t?.includes('collapse') && view === 'standardised' && n >= 64 && independent >= 2) markTask(`${props.id}:collapse`);
    if (t?.includes('correlated') && view === 'standardised' && dists.includes('correlated') && n >= 64 && persistence >= 0.7) markTask(`${props.id}:correlated`);
    if (t?.includes('binomial') && view === 'binomial' && seen.some((a) => seen.some((b) => b / a >= 4))) markTask(`${props.id}:binomial`);
    if (t?.includes('tails') && view === 'binomial' && n >= 100) markTask(`${props.id}:tails`);
  }, [n, view, distsKey, persistence]);

  /** the picture each walk last drew, kept while a new one is computed */
  const pictures = dists.map((d) => ({ d, s: shown.current[d] }));
  /** the readout and the screen-reader text show only rows measured at the current n, seed and persistence */
  const rows = pictures.map(({ d, s }) => ({ d, s: s?.key === rowKey(seed, n, persistence, d) ? s : undefined }));
  const summary = () =>
    view === 'binomial' && frame
      ? L.describeBin(nLive, p, frame.error.maxAbs, frame.error.tailUpper)
      : L.describeStd(
          n,
          rows
            .filter((r) => r.s)
            .map((r) => L.row(L.distShort[r.d], fix(r.s!.ks), fix(r.s!.variance, 2)))
            .join('; '),
        );
  useEffect(() => {
    setLive(summary());
  }, [version, view, nLive, p, distsKey]);

  const draw = ({ ctx, view: vw, palette: pal }: FrameInfo) => {
    if (view === 'standardised') drawStandardised(ctx, vw, pal);
    else if (frame) drawBinomial(ctx, vw, pal, frame);
  };

  function drawStandardised(ctx: CanvasRenderingContext2D, vw: { w: number; h: number }, pal: Palette) {
    const box = insetBox({ x: 0, y: 0, w: vw.w, h: vw.h }, { l: 58, r: 14, t: 12, b: 46 });
    const picked = pictures.filter((r) => r.s);
    let top = 0.45;
    for (const r of picked) for (const v of r.s!.y) top = Math.max(top, v * 1.12);
    const plot = makePlot(
      box,
      { min: -DENSITY_SPAN, max: DENSITY_SPAN, ticks: [-4, -3, -2, -1, 0, 1, 2, 3, 4], label: L.xStd, format: (v) => signed(String(v)) },
      { min: 0, max: top, ticks: niceTicks(0, top, 4), label: L.yDensity, format: (v) => tick(v) },
    );
    drawAxes(ctx, plot, pal, { dir });
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    for (const r of picked) {
      const s = r.s!;
      const colour = pal[COLOUR[r.d]];
      ctx.strokeStyle = colour;
      ctx.fillStyle = colour;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      s.x.forEach((x, i) => (i === 0 ? ctx.moveTo(plot.px(x), plot.py(s.y[i])) : ctx.lineTo(plot.px(x), plot.py(s.y[i]))));
      ctx.stroke();
      s.x.forEach((x, i) => marker(ctx, r.d, plot.px(x), plot.py(s.y[i]), 3));
    }
    ctx.restore();
    drawCurve(ctx, plot, standardGaussian, { color: pal.ink, width: 2, dash: [7, 5] });
  }

  function drawBinomial(ctx: CanvasRenderingContext2D, vw: { w: number; h: number }, pal: Palette, f: NonNullable<typeof frame>) {
    const upper: Box = { x: 0, y: 0, w: vw.w, h: vw.h * 0.66 };
    const lower: Box = { x: 0, y: vw.h * 0.66, w: vw.w, h: vw.h * 0.34 };
    const ub = insetBox(upper, { l: 62, r: 14, t: 12, b: 24 });
    const lb = insetBox(lower, { l: 62, r: 14, t: 6, b: 46 });
    const lo = f.kLo - 0.5;
    const hi = f.kHi + 0.5;
    const xs = niceTicks(lo, hi, narrow ? 5 : 8);
    let peak = 0;
    for (let k = f.kLo; k <= f.kHi; k++) peak = Math.max(peak, f.pmf[k], f.gaussian[k]);
    const yAxis = log
      ? { min: 10 ** Math.floor(Math.log10(peak * 1e-5)), max: peak * 1.6, scale: 'log' as const, label: L.yPmf }
      : { min: 0, max: peak * 1.15, ticks: niceTicks(0, peak * 1.15, 4), label: L.yPmf, format: (v: number) => tick(v) };
    const up = makePlot(ub, { min: lo, max: hi, ticks: xs, format: (v) => String(v) }, yAxis);
    drawAxes(ctx, up, pal, { dir, grid: !log });
    ctx.save();
    ctx.beginPath();
    ctx.rect(ub.x, ub.y - 4, ub.w, ub.h + 8);
    ctx.clip();
    ctx.fillStyle = log ? pal.cold : withAlpha(pal.cold, 0.7);
    for (let k = f.kLo; k <= f.kHi; k++) {
      if (!(f.pmf[k] > 0)) continue;
      if (log) {
        ctx.beginPath();
        ctx.arc(up.px(k), up.py(f.pmf[k]), 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const x0 = up.px(k - 0.5);
        const x1 = up.px(k + 0.5);
        const y = up.py(f.pmf[k]);
        ctx.fillRect(x0 + 0.5, y, Math.max(1, x1 - x0 - 1), ub.y + ub.h - y);
      }
    }
    ctx.restore();
    drawCurve(ctx, up, (x) => gaussianPdf(x, f.mean, f.sigma), { color: pal.hot, width: 2.2, samples: 240 });
    const sigmaMarks = (plot: typeof up, box: Box) => {
      ctx.save();
      ctx.strokeStyle = pal.ink3;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (const sgn of [-1, 1]) {
        const x = f.mean + sgn * 3 * f.sigma;
        if (x < lo || x > hi) continue;
        ctx.beginPath();
        ctx.moveTo(plot.px(x), box.y);
        ctx.lineTo(plot.px(x), box.y + box.h);
        ctx.stroke();
      }
      ctx.restore();
    };
    sigmaMarks(up, ub);

    // the difference is a few thousandths: drawn in units of 10⁻³ so its tick labels stay short
    const strip = errorStrip(f, log);
    if (!log) for (let k = 0; k <= f.n; k++) strip[k] *= 1000;
    let reach = log ? 1 : 0.1;
    if (!log) for (let k = f.kLo; k <= f.kHi; k++) reach = Math.max(reach, Math.abs(strip[k]) * 1.2);
    const lp = makePlot(lb, { min: lo, max: hi, ticks: xs, label: L.xK, format: (v) => String(v) }, { min: -reach, max: reach, ticks: log ? [-1, 0, 1] : niceTicks(-reach, reach, 3), label: log ? L.yStripRel : L.yStripAbs, format: (v) => tick(v) });
    drawAxes(ctx, lp, pal, { dir });
    ctx.save();
    ctx.beginPath();
    ctx.rect(lb.x, lb.y, lb.w, lb.h);
    ctx.clip();
    ctx.strokeStyle = pal.ink2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lb.x, lp.py(0));
    ctx.lineTo(lb.x + lb.w, lp.py(0));
    ctx.stroke();
    ctx.strokeStyle = pal.accent;
    ctx.fillStyle = pal.accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let k = f.kLo; k <= f.kHi; k++) {
      if (k === f.kLo) ctx.moveTo(lp.px(k), lp.py(strip[k]));
      else ctx.lineTo(lp.px(k), lp.py(strip[k]));
    }
    ctx.stroke();
    for (let k = f.kLo; k <= f.kHi; k++) {
      ctx.beginPath();
      ctx.arc(lp.px(k), lp.py(strip[k]), 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    sigmaMarks(lp, lb);
  }

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [version, view, narrow, nLive, p, log, distsKey, props.lang]);

  const step = (dirn: 1 | -1) => {
    const next = nFromSlider(sliderFromN(nLive) + dirn * 0.04);
    setNLive(next === nLive ? clamp(nLive + dirn, 1, N_MAX) : next);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-1);
    else if (e.key === 'Enter') setSeed((s) => s + 1);
    else return;
    e.preventDefault();
  };
  const toggleDist = (d: CltDist) =>
    setDists((cur) => {
      const next = cur.includes(d) ? cur.filter((x) => x !== d) : CLT_DISTS.filter((x) => x === d || cur.includes(x));
      return next.length > 0 ? next : cur;
    });

  const err = frame?.error;
  const pending = nLive !== n || busy;

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
        setNLive(base.n);
        setN(base.n);
        setDists(base.dists);
        setView(base.view);
        setPersistence(base.persistence);
        setSeed(base.seed);
        setP(base.p);
        setLog(base.log);
      }}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          <span>
            <bdi class="ltr">n: <b class="q">{nLive}</b></bdi>
            {view === 'standardised' && pending ? <> · {L.computing}</> : null}
          </span>
          {view === 'standardised' ? (
            <>
              {rows.map(({ d, s }) => (
                <span key={d}>
                  <span class="swatch" style={{ display: 'inline-block', width: '0.9em', height: '0.9em', background: CSS_VAR[d], marginInlineEnd: '0.35em', verticalAlign: 'middle' }} aria-hidden="true" />
                  {L.distShort[d]}: <bdi class="ltr">D = <b class="q">{s ? fix(s.ks) : '–'}</b></bdi>, {L.variance}{' '}
                  <bdi class="ltr">
                    <b class="q">{s ? fix(s.variance, 2) : '–'}</b>
                    {d === 'correlated' && s ? ` (${L.expected} ${fix(correlatedVarianceFactor(persistence, s.n), 2)})` : null}
                  </bdi>
                </span>
              ))}
              <span>{L.floor}</span>
              {dists.includes('pm1') ? (
                <span>
                  {L.lattice} <bdi class="ltr">D ≥ <b class="q">{fix(latticeFloor(n))}</b></bdi>
                </span>
              ) : null}
            </>
          ) : err ? (
            <>
              <span>
                {L.maxGap}: <bdi class="ltr"><b class="q">{err.maxAbs.toExponential(2)}</b></bdi> ({L.scaled}: <bdi class="ltr">{err.maxAbsScaled.toExponential(2)}</bdi>)
              </span>
              <span>
                {L.tailAt}: <bdi class="ltr"><b class="q">{pct(err.tailUpper)}</b> / <b class="q">{pct(err.tailLower)}</b></bdi>
              </span>
              <span>
                <span class="swatch" style={{ display: 'inline-block', width: '0.9em', height: '0.9em', background: 'var(--cold)', marginInlineEnd: '0.35em', verticalAlign: 'middle' }} aria-hidden="true" />
                {L.exact}
              </span>
              <span>
                <span class="swatch" style={{ display: 'inline-block', width: '1.2em', height: '0.18em', background: 'var(--hot)', marginInlineEnd: '0.35em', verticalAlign: 'middle' }} aria-hidden="true" />
                {L.gaussBin}
              </span>
            </>
          ) : null}
        </span>
      }
      controls={
        <>
          <div class="group" role="group" aria-label={L.view[view]}>
            {(['standardised', 'binomial'] as View[]).map((v) => (
              <Toggle key={v} label={L.view[v]} on={view === v} onChange={() => setView(v)} />
            ))}
          </div>
          <Slider label={L.n} min={0} max={1} step={0.005} value={sliderFromN(nLive)} format={() => String(nLive)} onChange={(t) => setNLive(nFromSlider(t))} />
          {view === 'standardised' ? (
            <>
              <div class="group" role="group" aria-label={L.dist}>
                {CLT_DISTS.map((d) => (
                  <Toggle key={d} label={L.distName[d]} on={dists.includes(d)} swatch={CSS_VAR[d]} onChange={() => toggleDist(d)} />
                ))}
              </div>
              <Slider label={L.persistence} min={0} max={0.95} step={0.05} value={persistence} format={(v) => v.toFixed(2)} onChange={(v) => setPersistence(cleanPersistence(v, persistence))} disabled={!dists.includes('correlated')} />
              <div class="group">
                <button type="button" class="toggle" onClick={() => setSeed((s) => s + 1)}>
                  {L.again}
                </button>
              </div>
            </>
          ) : (
            <>
              <Slider label={L.p} min={0.05} max={0.95} step={0.05} value={p} format={(v) => v.toFixed(2)} onChange={(v) => setP(cleanP(v, p))} />
              <div class="group">
                <Toggle label={L.log} on={log} onChange={setLog} />
              </div>
            </>
          )}
        </>
      }
    />
  );
}
