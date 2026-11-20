/**
 * Line integrals of a differential form in the plane (lesson 0.1, figure fig-0-1c). A form M dx + N dy, the field
 * (M, N) as faint arrows, the three paths from A = (1, 1) to B = (2, 2) (a: x first, b: y first, c: the straight
 * line) and the loop a − b. A point is traced along the chosen path; the right panel shows the integral accumulated
 * up to it. An exact form gives the same total on every path and 0 around the loop; an inexact one does not.
 * The readout gives the integral along each path, the mixed partials ∂M/∂y and ∂N/∂x at the traced point, and the
 * verdict. Pure mathematics, from src/physics/forms.ts; the thermodynamic forms are in units with N k_B = 1.
 * Steps may set { form, path, trace }.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { cumulativeLineIntegral, FORMS, pathPoints, type FormName, type PathName } from '~/physics/forms';
import { markTask } from '~/progress/store';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { arrow, withAlpha } from './core/ink';
import { arclength, exactnessReadout, FORM_META, fieldArrows, locate, pointAlong } from './core/form-view';
import { drawAxes, insetBox, makePlot, niceTicks } from './core/plot';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import { useNarrow } from './core/useNarrow';

const FORM_LIST: FormName[] = ['exact', 'inexact', 'heat', 'entropy'];
const PATH_LIST: PathName[] = ['a', 'b', 'c', 'loop'];
type TaskId = 'two-routes' | 'mixed-partials' | 'loop' | 'integrating-factor';

const PER_LEG = 1000;
const LO = 0.5;
const HI = 2.5;
const MINUS = '−';
const iso = (s: string) => `⁦${s}⁩`;
const signed = (v: number, digits = 3) => {
  const t = Math.abs(v).toFixed(digits);
  return Number(t) === 0 ? (0).toFixed(digits) : (v < 0 ? MINUS : '') + t;
};

const FORMULA: Record<FormName, string> = {
  exact: 'y dx + x dy',
  inexact: 'y dx',
  heat: 'δQ = (3/2) dT + (T/V) dV',
  entropy: 'δQ/T = (3/2) dT/T + dV/V',
};

const TEXT = {
  en: {
    task: {
      'two-routes': 'Take the form y dx and choose path a, then path b. Why do the two integrals differ?',
      'mixed-partials': 'Compare the mixed partials for the exact and the inexact forms. What do they say?',
      loop: 'Choose the loop a − b for each form. For which forms is the integral zero?',
      'integrating-factor': 'Compare the heat form with the entropy form. What did dividing by T do?',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: a differential form in the plane, its field, three paths from A to B and the loop between two of them, with the integral accumulated along the chosen path.',
    keys: 'Keys: up and down arrows change the path, left and right arrows trace it, Enter changes the form.',
    form: { exact: 'exact', inexact: 'inexact', heat: 'heat δQ', entropy: 'entropy δQ/T' } satisfies Record<FormName, string>,
    formGroup: 'form',
    pathGroup: 'path',
    path: { a: 'path a', b: 'path b', c: 'path c', loop: `loop a ${MINUS} b` } satisfies Record<PathName, string>,
    trace: 'trace',
    integral: 'integral along',
    around: 'around the loop',
    partials: 'mixed partials at the point',
    exact: 'exact',
    inexact: 'not exact',
    accumulated: 'accumulated integral',
    along: 'fraction of the path',
    units: 'units with N k_B = 1; the plane is (V, T)',
    describe: (form: string, path: string, total: number, verdict: string) => `${form}, ${path}: integral ${signed(total)}; the form is ${verdict}.`,
  },
  he: {
    task: {
      'two-routes': `קחו את התבנית ${iso('y dx')} ובחרו במסלול a ואז במסלול b. מדוע שני האינטגרלים שונים?`,
      'mixed-partials': 'השוו את הנגזרות המעורבות של התבנית המדויקת ושל התבנית הלא מדויקת. מה הן אומרות?',
      loop: `בחרו בלולאה ${iso(`a ${MINUS} b`)} בכל תבנית. באילו תבניות האינטגרל מתאפס?`,
      'integrating-factor': 'השוו את תבנית החום לתבנית האנטרופיה. מה עשתה החלוקה ב-T?',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: תבנית דיפרנציאלית במישור, השדה שלה, שלושה מסלולים מ-A ל-B והלולאה בין שניים מהם, עם האינטגרל שנצבר לאורך המסלול שנבחר.',
    keys: 'במקלדת: חיצי למעלה ולמטה מחליפים מסלול, חיצי ימין ושמאל עוברים לאורכו, אנטר מחליף תבנית.',
    form: { exact: 'מדויקת', inexact: 'לא מדויקת', heat: 'חום δQ', entropy: 'אנטרופיה δQ/T' } satisfies Record<FormName, string>,
    formGroup: 'תבנית',
    pathGroup: 'מסלול',
    path: { a: 'מסלול a', b: 'מסלול b', c: 'מסלול c', loop: `לולאה a ${MINUS} b` } satisfies Record<PathName, string>,
    trace: 'התקדמות',
    integral: 'האינטגרל לאורך',
    around: 'סביב הלולאה',
    partials: 'הנגזרות המעורבות בנקודה',
    exact: 'מדויקת',
    inexact: 'לא מדויקת',
    accumulated: 'האינטגרל שנצבר',
    along: 'חלק המסלול',
    units: 'ביחידות שבהן N k_B = 1; המישור הוא (V, T)',
    describe: (form: string, path: string, total: number, verdict: string) => `${form}, ${path}: האינטגרל ${iso(signed(total))}; התבנית ${verdict}.`,
  },
} satisfies Record<Lang, unknown>;

export interface FormPathsProps {
  id: string;
  lang: Lang;
  form?: FormName;
  path?: PathName;
  /** how far along the chosen path the traced point is, 0 to 1 (default 1: the whole path) */
  trace?: number;
  tasks?: TaskId[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const PATH_COLOR: Record<'a' | 'b' | 'c', keyof Palette> = { a: 'cold', b: 'hot', c: 'work' };

interface PathData {
  x: Float64Array;
  y: Float64Array;
  /** cumulative arclength and cumulative integral at every point */
  len: Float64Array;
  integral: Float64Array;
}

function pathData(form: FormName, path: PathName): PathData {
  const f = FORMS[form];
  const { x, y } = pathPoints(path, PER_LEG);
  return { x, y, len: arclength(x, y), integral: cumulativeLineIntegral(f.m, f.n, x, y) };
}

const total = (d: PathData) => d.integral[d.integral.length - 1];

/** the accumulated integral a fraction s of the way along the path */
function integralAt(d: PathData, s: number): number {
  const { i, f } = locate(d.len, s);
  const j = Math.min(i + 1, d.integral.length - 1);
  return d.integral[i] + (d.integral[j] - d.integral[i]) * f;
}

export default function FormPaths(props: FormPathsProps) {
  const L = TEXT[props.lang];
  const dir = props.lang === 'he' ? 'rtl' : 'ltr';
  const narrow = useNarrow();
  const base = { form: props.form ?? 'inexact', path: props.path ?? 'a', trace: clamp(props.trace ?? 1, 0, 1) };
  const [form, setForm] = useState<FormName>(base.form);
  const [path, setPath] = useState<PathName>(base.path);
  const [trace, setTrace] = useState(base.trace);
  const [live, setLive] = useState('');
  const seen = useRef({ forms: new Set<FormName>(), pathsOf: {} as Record<string, Set<PathName>>, loop: false });
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  const data = useMemo(() => {
    const out = {} as Record<PathName, PathData>;
    for (const p of PATH_LIST) out[p] = pathData(form, p);
    return out;
  }, [form]);
  const arrows = useMemo(() => fieldArrows(form, 9, 9, LO, HI), [form]);

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        if (typeof st.form === 'string' && (FORM_LIST as string[]).includes(st.form)) setForm(st.form as FormName);
        if (typeof st.path === 'string' && (PATH_LIST as string[]).includes(st.path)) setPath(st.path as PathName);
        if (typeof st.trace === 'number') setTrace(clamp(st.trace, 0, 1));
      }),
    [props.id],
  );

  const chosen = data[path];
  const here = pointAlong(chosen.x, chosen.y, chosen.len, trace);
  const partials = exactnessReadout(form, here.x, here.y);
  const verdict = partials.exact ? L.exact : L.inexact;
  const shown = integralAt(chosen, trace);

  useEffect(() => {
    setLive(L.describe(L.form[form], L.path[path], total(chosen), verdict));
    const t = props.tasks;
    const s = seen.current;
    s.forms.add(form);
    (s.pathsOf[form] ??= new Set()).add(path);
    if (path === 'loop') s.loop = true;
    if (t?.includes('two-routes') && Object.values(s.pathsOf).some((set) => [...set].filter((p) => p !== 'loop').length >= 2)) markTask(`${props.id}:two-routes`);
    if (t?.includes('mixed-partials') && s.forms.has('exact') && s.forms.has('inexact')) markTask(`${props.id}:mixed-partials`);
    if (t?.includes('loop') && s.loop) markTask(`${props.id}:loop`);
    if (t?.includes('integrating-factor') && s.forms.has('heat') && s.forms.has('entropy')) markTask(`${props.id}:integrating-factor`);
  }, [form, path]);

  const draw = ({ ctx, view: vw, palette: p }: FrameInfo) => {
    const meta = FORM_META[form];
    // ---- the plane
    const region = narrow ? { x: 0, y: 0, w: vw.w, h: vw.h * 0.64 } : { x: 0, y: 0, w: vw.w * 0.52, h: vw.h };
    const m = { l: 44, r: 14, t: 12, b: 44 };
    const side = Math.max(1, Math.min(region.w - m.l - m.r, region.h - m.t - m.b));
    const box = { x: region.x + m.l + (region.w - m.l - m.r - side) / 2, y: region.y + m.t, w: side, h: side };
    const ticks = [0.5, 1, 1.5, 2, 2.5];
    const plot = makePlot(box, { min: LO, max: HI, ticks, label: meta.xLabel, format: (v) => v.toFixed(1) }, { min: LO, max: HI, ticks, label: meta.yLabel, format: (v) => v.toFixed(1) });
    drawAxes(ctx, plot, p, { dir, grid: false });

    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.w, box.h);
    ctx.clip();
    for (const a of arrows) {
      const sx = plot.px(a.x);
      const sy = plot.py(a.y);
      const len = Math.min(18, side / 11);
      arrow(ctx, sx - (a.ux * len) / 2, sy + (a.uy * len) / 2, sx + (a.ux * len) / 2, sy - (a.uy * len) / 2, { color: p.ink3, width: 1.1, head: 5, alpha: 0.45 });
    }
    ctx.restore();

    const stroke = (d: PathData, color: string, width: number, alpha: number, upTo = 1) => {
      const { i, f } = locate(d.len, upTo);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(plot.px(d.x[0]), plot.py(d.y[0]));
      for (let k = 1; k <= i; k++) ctx.lineTo(plot.px(d.x[k]), plot.py(d.y[k]));
      if (f > 0 && i + 1 < d.x.length) ctx.lineTo(plot.px(d.x[i] + (d.x[i + 1] - d.x[i]) * f), plot.py(d.y[i] + (d.y[i + 1] - d.y[i]) * f));
      ctx.stroke();
      ctx.restore();
    };
    const isLoop = path === 'loop';
    for (const k of ['a', 'b', 'c'] as const) {
      const on = isLoop ? k !== 'c' : k === path;
      stroke(data[k], p[PATH_COLOR[k]] as string, on ? 3 : 2, on ? 0.3 : 0.28);
    }
    // the part traced so far, in the chosen path's own colour (the loop is drawn as a out, b back)
    if (isLoop) stroke(data.loop, p.accent, 3.4, 1, trace);
    else stroke(chosen, p[PATH_COLOR[path as 'a' | 'b' | 'c']] as string, 3.6, 1, trace);

    // A, B, the traced point and the path letters
    ctx.save();
    ctx.font = `600 13px ${p.fontUi}`;
    ctx.direction = 'ltr';
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [pt, name, dx, dy] of [[[1, 1], 'A', -12, 12], [[2, 2], 'B', 12, -12]] as const) {
      ctx.beginPath();
      ctx.arc(plot.px(pt[0]), plot.py(pt[1]), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(name, plot.px(pt[0]) + dx, plot.py(pt[1]) + dy);
    }
    ctx.font = `600 12px ${p.fontUi}`;
    for (const [k, x, y, dx, dy] of [['a', 1.5, 1, 0, 11], ['b', 1.5, 2, 0, -11], ['c', 1.5, 1.5, 11, 8]] as const) {
      ctx.fillStyle = p[PATH_COLOR[k]] as string;
      ctx.fillText(k, plot.px(x) + dx, plot.py(y) + dy);
    }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = p.accent;
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(plot.px(here.x), plot.py(here.y), 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // ---- the integral accumulated along the path
    const rRegion = narrow ? { x: 0, y: vw.h * 0.64, w: vw.w, h: vw.h * 0.36 } : { x: vw.w * 0.52, y: 0, w: vw.w * 0.48, h: vw.h };
    const rBox = insetBox(rRegion, narrow ? { l: 52, r: 14, t: 8, b: 40 } : { l: 52, r: 14, t: 12, b: 46 });
    const curves: PathName[] = isLoop ? ['loop'] : ['a', 'b', 'c'];
    let lo = 0;
    let hi = 0;
    for (const k of curves) for (let i = 0; i < data[k].integral.length; i += 10) {
      lo = Math.min(lo, data[k].integral[i]);
      hi = Math.max(hi, data[k].integral[i]);
    }
    const pad = Math.max(0.2, 0.1 * (hi - lo));
    const yTicks = niceTicks(lo - pad, hi + pad, 5);
    const ip = makePlot(
      rBox,
      { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], label: L.along, format: (v) => String(v) },
      { min: lo - pad, max: hi + pad, ticks: yTicks, label: L.accumulated, format: (v) => signed(v, 1) },
    );
    drawAxes(ctx, ip, p, { dir });
    ctx.save();
    ctx.beginPath();
    ctx.rect(rBox.x, rBox.y, rBox.w, rBox.h);
    ctx.clip();
    for (const k of curves) {
      const d = data[k];
      const on = k === path || isLoop;
      ctx.strokeStyle = k === 'loop' ? p.accent : (p[PATH_COLOR[k as 'a' | 'b' | 'c']] as string);
      ctx.globalAlpha = on ? 1 : 0.55;
      ctx.lineWidth = on ? 2.6 : 1.8;
      ctx.beginPath();
      const last = d.integral.length - 1;
      for (let i = 0; i <= last; i += 5) {
        const x = ip.px(d.len[i] / d.len[last]);
        const y = ip.py(d.integral[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(ip.px(1), ip.py(d.integral[last]));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = withAlpha(p.ink2, 0.8);
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(ip.px(trace), rBox.y);
    ctx.lineTo(ip.px(trace), rBox.y + rBox.h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = p.accent;
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ip.px(trace), ip.py(shown), 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [form, path, trace, narrow, props.lang]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') setPath(PATH_LIST[(PATH_LIST.indexOf(path) + PATH_LIST.length - 1) % PATH_LIST.length]);
    else if (e.key === 'ArrowDown') setPath(PATH_LIST[(PATH_LIST.indexOf(path) + 1) % PATH_LIST.length]);
    else if (e.key === 'ArrowRight') setTrace((t) => clamp(t + 0.05, 0, 1));
    else if (e.key === 'ArrowLeft') setTrace((t) => clamp(t - 0.05, 0, 1));
    else if (e.key === 'Enter') setForm(FORM_LIST[(FORM_LIST.indexOf(form) + 1) % FORM_LIST.length]);
    else return;
    e.preventDefault();
  };

  const meta = FORM_META[form];
  const loopValue = total(data.loop);

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${L.describe(L.form[form], L.path[path], total(chosen), verdict)} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 0.7 : 1.9}
      live={live}
      tasks={tasks}
      onReset={() => {
        setForm(base.form);
        setPath(base.path);
        setTrace(base.trace);
      }}
      onKeyDown={onKeyDown}
      readout={
        <span class="gas-readout">
          <span>
            <bdi class="ltr">{FORMULA[form]}</bdi>
          </span>
          {(['a', 'b', 'c'] as const).map((k) => (
            <span key={k} style={{ fontWeight: path === k ? 600 : 400 }}>
              <span class="swatch" style={{ display: 'inline-block', width: '0.7em', height: '0.7em', borderRadius: '50%', background: `var(--${k === 'a' ? 'cold' : k === 'b' ? 'hot' : 'work'})`, marginInlineEnd: '0.35em' }} aria-hidden="true" />
              {L.integral} {k}: <bdi class="ltr"><b class="q">{signed(total(data[k]))}</b></bdi>
            </span>
          ))}
          <span>
            {L.around}: <bdi class="ltr"><b class="q">{signed(loopValue)}</b></bdi>
          </span>
          <span>
            {L.partials} (<bdi class="ltr">{here.x.toFixed(2)}, {here.y.toFixed(2)}</bdi>):{' '}
            <bdi class="ltr">
              ∂M/∂{meta.yLabel} = <b class="q">{signed(partials.dMdy, 2)}</b>, ∂N/∂{meta.xLabel} = <b class="q">{signed(partials.dNdx, 2)}</b>
            </bdi>{' '}
            · <b class="q">{verdict}</b>
          </span>
          {(form === 'heat' || form === 'entropy') && <span class="gas-previous">{L.units}</span>}
        </span>
      }
      controls={
        <>
          <div class="group" role="group" aria-label={L.formGroup}>
            {FORM_LIST.map((f) => (
              <Toggle key={f} label={L.form[f]} on={form === f} onChange={() => setForm(f)} />
            ))}
          </div>
          <div class="group" role="group" aria-label={L.pathGroup}>
            {PATH_LIST.map((k) => (
              <Toggle key={k} label={L.path[k]} on={path === k} onChange={() => setPath(k)} />
            ))}
          </div>
          <Slider label={L.trace} min={0} max={1} step={0.01} value={trace} format={(v) => `${Math.round(100 * v)}%`} onChange={setTrace} />
        </>
      }
    />
  );
}
