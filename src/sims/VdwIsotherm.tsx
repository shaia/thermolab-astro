/**
 * An isotherm of the van der Waals gas (lesson 2.1, figure fig-2-1b), in reduced variables. The P–v plane: the isotherm at
 * T_r, the ideal-gas isotherm at the same T, the critical isotherm faint for reference, the critical point, and where
 * T_r < 1 the stretch with (∂P/∂v)_T > 0 shaded and labelled as not a stable state. Or Z = P v/(k_B T) against v_r, with
 * Z = 1 and the critical Z_c = 3/8 marked. With `co2`, NIST's CO₂ isotherm at 280 K (T_r = 280/304.13, with CO₂'s
 * critical constants) is laid over it and the temperature is held at that T_r. A cursor along v reads off P_r and Z.
 * Pure model, from src/physics/gases.ts; the helpers are in core/isotherm-view.ts. The v axis is logarithmic.
 * Steps may set { tr, view, ideal, co2, cursor }. Tasks: wiggle, critical, co2, z-dilute.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { vdwPressureReduced } from '~/physics/gases';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo } from './core/canvas';
import { TR_CO2, co2Reduced, dataAt, slopeReadout, idealReduced, pressureSpan, unstableInterval, zVdw } from './core/isotherm-view';
import { withAlpha } from './core/ink';
import { drawAxes, drawCurve, drawMarker, makePlot, niceTicks, type Plot } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

type View = 'pv' | 'z';
type TaskId = 'wiggle' | 'critical' | 'co2' | 'z-dilute';
const MINUS = '−';
const iso = (s: string) => `⁦${s}⁩`;
const signed = (v: number, digits = 2) => {
  const t = Math.abs(v).toFixed(digits);
  return Number(t) === 0 ? (0).toFixed(digits) : (v < 0 ? MINUS : '') + t;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const TR_MIN = 0.8;
const TR_MAX = 1.5;
/** the v_r window: the lesson's own, and the wider one that holds all of the CO₂ data (v_r from 0.37 to 39) */
const X_PLAIN = [0.4, 10] as const;
const X_CO2 = [0.35, 50] as const;
const P_TOP = 2.5;
const Z_TOP = 1.5;

const TEXT = {
  en: {
    task: {
      wiggle: 'Lower the temperature below the critical value. What happens to the isotherm, and where is it no longer a possible state?',
      critical: 'Bring T_r to exactly 1. What is special about the isotherm at the critical point, and what does the slope at the inflection point read?',
      co2: 'Switch on the CO₂ data. Where do the ideal gas and van der Waals each part from the measurements?',
      'z-dilute': 'Look at Z and move the cursor to large volumes. What does Z tend to, and why?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: an isotherm of the van der Waals gas in reduced variables, pressure against volume or the compressibility factor against volume, with the ideal gas, the critical isotherm and, optionally, the CO₂ measurements at 280 K.',
    keys: 'Keys: left and right arrows move the cursor along the volume axis, up and down arrows change the temperature, Enter switches between pressure and Z.',
    xAxis: 'reduced volume v_r (log scale)',
    yAxis: { pv: 'reduced pressure P_r', z: 'compressibility factor Z = P v/(k_B T)' } satisfies Record<View, string>,
    tr: 'temperature T_r',
    trCo2: 'temperature T_r (held at 280 K by the data)',
    cursor: 'cursor v_r',
    view: 'view',
    ideal: 'ideal gas',
    vdw: 'van der Waals',
    critical: 'critical isotherm',
    criticalPoint: 'critical point marked',
    unstable: 'not a stable state',
    zc: 'Z_c = 3/8',
    z1: 'Z = 1',
    co2: 'CO₂ at 280 K',
    co2Switch: 'CO₂ data',
    slopeAt: 'slope at the inflection point',
    flatAt: 'at',
    convex: 'no inflection point: above T_r = 1.068 the isotherm is convex everywhere',
    risesOn: 'the pressure rises with volume (∂P/∂v > 0) for',
    cursorLine: 'at the cursor',
    datum: 'CO₂ measured at the cursor',
    noDatum: 'no CO₂ datum at this volume',
    stableNote: 'the stretch with ∂P/∂v > 0 is shaded',
    describe: (tr: number, view: View, co2: boolean, v: number, p: number, z: number) =>
      `${co2 ? 'CO₂ at 280 K, ' : ''}T_r = ${signed(tr)}; ${view === 'pv' ? 'pressure against volume' : 'compressibility factor against volume'}; ${tr < 1 ? 'the isotherm has a stretch with positive slope, not a stable state' : 'the isotherm falls steadily'}. At v_r = ${v.toFixed(2)}: P_r = ${signed(p, 3)}, Z = ${signed(z, 3)}.`,
  },
  he: {
    task: {
      wiggle: 'הורידו את הטמפרטורה מתחת לערך הקריטי. מה קורה לאיזותרמה, והיכן היא כבר אינה מצב אפשרי?',
      critical: `הביאו את ${iso('T_r')} בדיוק ל-1. מה מיוחד באיזותרמה בנקודה הקריטית, ומה מראה השיפוע בנקודת הפיתול?`,
      co2: `הפעילו את נתוני ${iso('CO₂')}. היכן כל אחד מהם, הגז האידיאלי וגז ואן דר ואלס, מתחיל להתרחק מן המדידות?`,
      'z-dilute': `עברו לתצוגת ${iso('Z')} והזיזו את הסמן לנפחים גדולים. לאן שואף ${iso('Z')}, ומדוע?`,
    } satisfies Record<TaskId, string>,
    label: `איור חי: איזותרמה של גז ואן דר ואלס במשתנים מצומצמים, הלחץ כפונקציה של הנפח או מקדם הדחיסות כפונקציה של הנפח, עם הגז האידיאלי, האיזותרמה הקריטית ולפי בחירה גם מדידות ${iso('CO₂')} ב-${iso('280 K')}.`,
    keys: `במקלדת: חיצי ימין ושמאל מזיזים את הסמן לאורך ציר הנפח, חיצי למעלה ולמטה משנים את הטמפרטורה, מקש Enter מחליף בין לחץ ל-${iso('Z')}.`,
    xAxis: `נפח מצומצם ${iso('v_r')} (סולם לוגריתמי)`,
    yAxis: { pv: `לחץ מצומצם ${iso('P_r')}`, z: `מקדם הדחיסות ${iso('Z = P v/(k_B T)')}` } satisfies Record<View, string>,
    tr: `טמפרטורה ${iso('T_r')}`,
    trCo2: `טמפרטורה ${iso('T_r')} (קבועה ב-${iso('280 K')} לפי הנתונים)`,
    cursor: `סמן ${iso('v_r')}`,
    view: 'תצוגה',
    ideal: 'גז אידיאלי',
    vdw: 'ואן דר ואלס',
    critical: 'איזותרמה קריטית',
    criticalPoint: 'הנקודה הקריטית מסומנת',
    unstable: 'אינו מצב יציב',
    zc: 'Z_c = 3/8',
    z1: 'Z = 1',
    co2: `${iso('CO₂')} ב-${iso('280 K')}`,
    co2Switch: `נתוני ${iso('CO₂')}`,
    slopeAt: 'השיפוע בנקודת הפיתול',
    flatAt: 'בנקודה',
    convex: `אין נקודת פיתול: מעל ${iso('T_r = 1.068')} האיזותרמה קעורה כלפי מעלה בכל מקום`,
    risesOn: `הלחץ עולה עם הנפח (${iso('∂P/∂v > 0')}) עבור`,
    cursorLine: 'בסמן',
    datum: `${iso('CO₂')} ממשי בסמן`,
    noDatum: `אין נתון ${iso('CO₂')} בנפח הזה`,
    stableNote: `התחום שבו ${iso('∂P/∂v > 0')} מוצל`,
    describe: (tr: number, view: View, co2: boolean, v: number, p: number, z: number) =>
      `${co2 ? `${iso('CO₂')} ב-${iso('280 K')}, ` : ''}${iso(`T_r = ${signed(tr)}`)}; ${view === 'pv' ? 'לחץ כפונקציה של נפח' : 'מקדם הדחיסות כפונקציה של נפח'}; ${tr < 1 ? 'באיזותרמה יש קטע בעל שיפוע חיובי, שאינו מצב יציב' : 'האיזותרמה יורדת בהתמדה'}. ב-${iso(`v_r = ${v.toFixed(2)}`)}: ${iso(`P_r = ${signed(p, 3)}`)}, ${iso(`Z = ${signed(z, 3)}`)}.`,
  },
} satisfies Record<Lang, unknown>;

export interface VdwIsothermProps {
  id: string;
  lang: Lang;
  /** reduced temperature, 0.80 to 1.50 (default 1.20) */
  tr?: number;
  /** pressure against volume, or the compressibility factor against volume (default 'pv') */
  view?: View;
  /** draw the ideal-gas isotherm at the same temperature (default true) */
  ideal?: boolean;
  /** overlay the CO₂ data at 280 K in reduced variables, T_r = 280/304.13; the temperature is then held there (default false) */
  co2?: boolean;
  /** the cursor's reduced volume v_r (default 2) */
  cursor?: number;
  tasks?: TaskId[];
}

const TICKS_PLAIN = [0.5, 1, 2, 5, 10];
const TICKS_CO2 = [0.5, 1, 2, 5, 10, 20, 50];
const VIEW_LIST: View[] = ['pv', 'z'];

const roundTo = (v: number, step: number, up: boolean) => (up ? Math.ceil(v / step - 1e-9) : Math.floor(v / step + 1e-9)) * step;

export default function VdwIsotherm(props: VdwIsothermProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const base = {
    tr: clamp(props.tr ?? 1.2, TR_MIN, TR_MAX),
    view: (props.view ?? 'pv') as View,
    ideal: props.ideal ?? true,
    co2: props.co2 ?? false,
    cursor: props.cursor ?? 2,
  };
  const [tr, setTr] = useState(base.tr);
  const [view, setView] = useState<View>(base.view);
  const [ideal, setIdeal] = useState(base.ideal);
  const [co2, setCo2] = useState(base.co2);
  const [cursor, setCursor] = useState(base.cursor);
  const [live, setLive] = useState('');
  const plotRef = useRef<Plot | null>(null);
  const dragging = useRef(false);
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  const data = useMemo(() => co2Reduced(), []);
  const effTr = co2 ? TR_CO2 : tr;
  const [xLo, xHi] = co2 ? X_CO2 : X_PLAIN;
  const cur = clamp(cursor, xLo, xHi);

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        if (typeof st.tr === 'number') setTr(clamp(st.tr, TR_MIN, TR_MAX));
        if (st.view === 'pv' || st.view === 'z') setView(st.view);
        if (typeof st.ideal === 'boolean') setIdeal(st.ideal);
        if (typeof st.co2 === 'boolean') setCo2(st.co2);
        if (typeof st.cursor === 'number') setCursor(st.cursor);
      }),
    [props.id],
  );

  const band = useMemo(() => unstableInterval(effTr), [effTr]);
  const flat = useMemo(() => slopeReadout(effTr), [effTr]);
  const pCur = vdwPressureReduced(cur, effTr);
  const zCur = zVdw(cur, effTr);
  const pIdeal = idealReduced(cur, effTr);
  const datum = co2 ? dataAt(data, cur) : null;

  useEffect(() => {
    const t = props.tasks;
    if (t?.includes('wiggle') && view === 'pv' && effTr <= 0.95) markTask(`${props.id}:wiggle`);
    if (t?.includes('critical') && !co2 && Math.abs(tr - 1) <= 0.005) markTask(`${props.id}:critical`);
    if (t?.includes('co2') && co2) markTask(`${props.id}:co2`);
    if (t?.includes('z-dilute') && view === 'z' && cur >= 4) markTask(`${props.id}:z-dilute`);
    setLive(L.describe(effTr, view, co2, cur, pCur, zCur));
  }, [effTr, view, co2, Math.round(Math.log(cur) * 4)]);

  const draw = ({ ctx, view: vw, palette: p }: FrameInfo) => {
    const box = { x: 58, y: 14, w: Math.max(1, vw.w - 58 - 16), h: Math.max(1, vw.h - 14 - 50) };
    // y range
    let yMin = 0;
    let yMax: number = view === 'pv' ? P_TOP : Z_TOP;
    if (view === 'pv') {
      yMin = Math.min(0, roundTo(pressureSpan(effTr, xLo, xHi).lo, 0.5, false));
      if (yMin > -0.5 && effTr < 1) yMin = -0.5;
    } else {
      let lo = 0;
      for (let i = 0; i <= 300; i++) {
        const v = Math.max(xLo, 1 / 3 + 1e-3) * (xHi / Math.max(xLo, 1 / 3 + 1e-3)) ** (i / 300);
        lo = Math.min(lo, zVdw(v, effTr));
      }
      yMin = Math.max(-1, roundTo(lo, 0.25, false));
      if (co2) yMax = Z_TOP;
    }
    const yTicks = niceTicks(yMin, yMax, 6);
    const plot = makePlot(
      box,
      { min: xLo, max: xHi, scale: 'log', ticks: co2 ? TICKS_CO2 : TICKS_PLAIN, label: L.xAxis, format: (v) => String(v) },
      { min: yMin, max: yMax, ticks: yTicks, label: L.yAxis[view], format: (v) => signed(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 2) },
    );
    plotRef.current = plot;
    drawAxes(ctx, plot, p, { dir });

    const f = (T: number) => (v: number) => (v <= 1 / 3 + 1e-6 ? NaN : view === 'pv' ? vdwPressureReduced(v, T) : zVdw(v, T));
    const fIdeal = (T: number) => (v: number) => (view === 'pv' ? idealReduced(v, T) : 1);

    // the unstable stretch: a band over the whole height, and the curve itself heavier inside it
    if (band) {
      ctx.save();
      ctx.fillStyle = withAlpha(p.accent, 0.14);
      ctx.fillRect(plot.px(band[0]), box.y, plot.px(band[1]) - plot.px(band[0]), box.h);
      ctx.strokeStyle = withAlpha(p.accent, 0.7);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      for (const v of band) {
        ctx.beginPath();
        ctx.moveTo(plot.px(v), box.y);
        ctx.lineTo(plot.px(v), box.y + box.h);
        ctx.stroke();
      }
      ctx.restore();
    }

    // reference: Z = 1 and Z_c = 3/8 lines, the critical isotherm
    ctx.save();
    ctx.font = `11.5px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.textBaseline = 'bottom';
    if (view === 'z') {
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = p.ink3;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(box.x, plot.py(0.375));
      ctx.lineTo(box.x + box.w, plot.py(0.375));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = p.ink2;
      ctx.textAlign = 'right';
      ctx.fillText(L.zc, box.x + box.w - 4, plot.py(0.375) - 3);
    }
    ctx.restore();
    drawCurve(ctx, plot, f(1), { color: withAlpha(p.ink3, 0.9), width: 1.6, dash: [6, 4], samples: 320 });
    if (ideal) drawCurve(ctx, plot, fIdeal(effTr), { color: p.cold, width: 2.2, dash: [7, 4], samples: 120 });
    drawCurve(ctx, plot, f(effTr), { color: p.hot, width: 2.8, samples: 480 });
    if (band) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
      ctx.clip();
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const n = 120;
      for (let i = 0; i <= n; i++) {
        const v = band[0] * (band[1] / band[0]) ** (i / n);
        const y = view === 'pv' ? vdwPressureReduced(v, effTr) : zVdw(v, effTr);
        if (i === 0) ctx.moveTo(plot.px(v), plot.py(y));
        else ctx.lineTo(plot.px(v), plot.py(y));
      }
      ctx.stroke();
      ctx.restore();
    }
    // the critical point
    drawMarker(ctx, plot, 1, view === 'pv' ? 1 : 0.375, p.ink, { radius: 5 });
    ctx.save();
    ctx.fillStyle = p.paper;
    ctx.beginPath();
    ctx.arc(plot.px(1), plot.py(view === 'pv' ? 1 : 0.375), 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // the CO₂ data
    if (co2) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x, box.y - 2, box.w, box.h + 4);
      ctx.clip();
      const pts = data.map((d) => ({ x: plot.px(d.vR), y: plot.py(view === 'pv' ? d.pR : d.z) }));
      ctx.strokeStyle = withAlpha(p.ink, 0.45);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
      ctx.stroke();
      ctx.fillStyle = p.ink;
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 1;
      for (const q of pts) {
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - 3.8);
        ctx.lineTo(q.x + 3.8, q.y);
        ctx.lineTo(q.x, q.y + 3.8);
        ctx.lineTo(q.x - 3.8, q.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // the band's label, with a halo so it reads over the grid
    if (band) {
      ctx.save();
      ctx.font = `600 11.5px ${p.fontUi}`;
      ctx.direction = dir;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const x = clamp((plot.px(band[0]) + plot.px(band[1])) / 2, box.x + 50, box.x + box.w - 50);
      ctx.lineWidth = 4;
      ctx.strokeStyle = withAlpha(p.paper, 0.9);
      ctx.strokeText(L.unstable, x, box.y + 6);
      ctx.fillStyle = p.ink;
      ctx.fillText(L.unstable, x, box.y + 6);
      ctx.restore();
    }

    // the cursor and its points
    const sx = plot.px(cur);
    ctx.save();
    ctx.strokeStyle = withAlpha(p.ink2, 0.8);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, box.y);
    ctx.lineTo(sx, box.y + box.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    const at = (y: number, color: string, r = 4.5) => {
      if (y < yMin || y > yMax) return;
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sx, plot.py(y), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    if (ideal) at(view === 'pv' ? pIdeal : 1, p.cold);
    if (cur > 1 / 3 + 1e-6) at(view === 'pv' ? pCur : zCur, p.hot, 5.5);
    if (datum) at(view === 'pv' ? datum.pR : datum.z, p.ink, 4);
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [effTr, view, ideal, co2, cursor, narrow, props.lang]);

  const setCursorFrom = (e: PointerEvent) => {
    const plot = plotRef.current;
    if (!plot) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = clamp((e.clientX - rect.left - plot.box.x) / plot.box.w, 0, 1);
    setCursor(xLo * (xHi / xLo) ** t);
  };
  const onPointerDown = (e: PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setCursorFrom(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging.current || e.pointerType === 'mouse') setCursorFrom(e);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setCursor(clamp(cur * 1.08, xLo, xHi));
    else if (e.key === 'ArrowLeft') setCursor(clamp(cur / 1.08, xLo, xHi));
    else if (e.key === 'ArrowUp' && !co2) setTr((t) => clamp(Number((t + 0.01).toFixed(2)), TR_MIN, TR_MAX));
    else if (e.key === 'ArrowDown' && !co2) setTr((t) => clamp(Number((t - 0.01).toFixed(2)), TR_MIN, TR_MAX));
    else if (e.key === 'Enter') setView(view === 'pv' ? 'z' : 'pv');
    else return;
    e.preventDefault();
  };

  const swatch = (c: string, dashed = false) => (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', width: '1.1em', height: 0, borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${c}`, marginInlineEnd: '0.35em', verticalAlign: 'middle' }}
    />
  );
  const num = (x: number, d = 3) => <b class="q">{signed(x, d)}</b>;
  const logOf = (v: number) => Math.log(v / xLo) / Math.log(xHi / xLo);

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${L.describe(effTr, view, co2, cur, pCur, zCur)} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 1.05 : 1.75}
      live={live}
      tasks={tasks}
      cursor="crosshair"
      touchAction="pan-y"
      onReset={() => {
        setTr(base.tr);
        setView(base.view);
        setIdeal(base.ideal);
        setCo2(base.co2);
        setCursor(base.cursor);
      }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      readout={
        <span class="gas-readout">
          <span>
            {swatch('var(--hot)')}
            {L.vdw} · <bdi class="ltr">T_r = {num(effTr, co2 ? 4 : 3)}</bdi>
            {co2 && (
              <>
                {' '}
                (<bdi class="ltr">280 K</bdi>)
              </>
            )}
          </span>
          {ideal && (
            <span>
              {swatch('var(--cold)', true)}
              {L.ideal}
            </span>
          )}
          {co2 && (
            <span>
              <span aria-hidden="true">◆ </span>
              {L.co2}
            </span>
          )}
          <span>
            {swatch('var(--ink-3)', true)}
            {L.critical} (<bdi class="ltr">T_r = 1</bdi>), {L.criticalPoint}
          </span>
          <span>
            {flat.kind === 'slope' ? (
              <>
                {L.slopeAt}: <bdi class="ltr">−∂P_r/∂v_r = {num(flat.slope, 4)}</bdi> {L.flatAt} <bdi class="ltr">v_r = {num(flat.vR, 3)}</bdi>
              </>
            ) : flat.kind === 'convex' ? (
              L.convex
            ) : (
              <>
                {L.risesOn}: <bdi class="ltr">{num(flat.from, 2)} &lt; v_r &lt; {num(flat.to, 2)}</bdi>
              </>
            )}
          </span>
          <span>
            {L.cursorLine}: <bdi class="ltr">v_r = {num(cur, 2)}</bdi>
          </span>
          <span>
            {L.vdw}: <bdi class="ltr">P_r = {num(pCur)}, Z = {num(zCur)}</bdi>
          </span>
          {ideal && (
            <span>
              {L.ideal}: <bdi class="ltr">P_r = {num(pIdeal)}, Z = {num(1, 0)}</bdi>
            </span>
          )}
          {co2 && (
            <span>
              {L.datum}:{' '}
              {datum ? (
                <bdi class="ltr">
                  P_r = {num(datum.pR)}, Z = {num(datum.z)}
                </bdi>
              ) : (
                L.noDatum
              )}
            </span>
          )}
          {band && <span class="gas-previous">{L.stableNote}</span>}
        </span>
      }
      controls={
        <>
          <Slider label={co2 ? L.trCo2 : L.tr} min={TR_MIN} max={TR_MAX} step={0.01} value={effTr} disabled={co2} format={(v) => v.toFixed(2)} onChange={setTr} />
          <div class="group" role="group" aria-label={L.view}>
            {VIEW_LIST.map((v) => (
              <Toggle key={v} label={<bdi class="ltr">{v === 'pv' ? 'P–v' : 'Z–v'}</bdi>} on={view === v} onChange={() => setView(v)} />
            ))}
            <Toggle label={L.ideal} on={ideal} onChange={setIdeal} />
            <Toggle label={L.co2Switch} on={co2} onChange={setCo2} />
          </div>
          <Slider label={L.cursor} min={0} max={1} step={0.002} value={logOf(cur)} format={() => cur.toFixed(2)} onChange={(t) => setCursor(xLo * (xHi / xLo) ** t)} />
        </>
      }
    />
  );
}
