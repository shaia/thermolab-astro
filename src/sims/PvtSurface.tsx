/**
 * The equation-of-state surface (lesson 2.1, figure fig-2-1a): P_r over (v_r, T_r) for a gas whose a and b are turned on
 * from nothing (the ideal gas) to their full van der Waals values, drawn on a 2D canvas with a projection that rotates
 * by dragging, by the arrow keys or by the two angle sliders. The surface is clipped to −0.5 ≤ P_r ≤ 2.5, the
 * critical isotherm T_r = 1 is highlighted and the cells where ∂P/∂v > 0 (the fold, which only exists below T_c) are
 * coloured apart. With `legs` a state point travels three legs, at constant T, then constant v, then constant P, and
 * its shadows on the three back walls trace an isotherm, an isochore and an isobar.
 * Pure model, from src/physics/gases.ts (morphedPressureReduced); the projection and clipping are in core/surface-view.ts.
 * Steps may set { morph, legs, azimuth, elevation }. Tasks: fold, ideal-flat, shadows, rotate.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang } from '~/i18n';
import { markTask } from '~/progress/store';
import { motionAllowed } from '~/progress/settings';
import { subscribeSteps } from '~/ui/steps';
import { useFigureCanvas, type FrameInfo, type Palette } from './core/canvas';
import { mix, withAlpha } from './core/ink';
import SimShell, { Slider, Toggle, type TaskDef } from './core/SimShell';
import {
  DEFAULT_VIEW,
  ELEVATION_RANGE,
  HALF,
  P_RANGE,
  backWalls,
  clamp,
  clipPolygonZ,
  clipPolylineZ,
  criticalPoint,
  fitScale,
  isothermLine,
  legPath,
  legPoint,
  project,
  shadowOf,
  surfaceCells,
  toBox,
  wrapAzimuth,
  type Vec3,
  type ViewAngles,
} from './core/surface-view';
import { useNarrow } from './core/useNarrow';

type TaskId = 'fold' | 'ideal-flat' | 'shadows' | 'rotate';
const MINUS = '−';
const iso = (s: string) => `⁦${s}⁩`;
const NV = 56;
const NT = 18;
/** seconds the state point takes for its three legs */
const JOURNEY = 9;

const TEXT = {
  en: {
    task: {
      fold: 'Turn a and b up from nothing to their full values. Where does the surface develop a fold, and at which temperatures?',
      'ideal-flat': 'Set a and b to zero. Is there any fold left, at any temperature?',
      shadows: 'Switch on the three legs and watch the shadows on the walls. Which wall shows an isotherm, which an isochore, which an isobar?',
      rotate: 'Rotate the surface by dragging it, or with the arrow keys, until the fold is seen from the side.',
    } satisfies Record<TaskId, string>,
    label: 'Live figure: the pressure of a gas over volume and temperature in reduced variables, a three-dimensional surface that can be rotated, from the ideal gas to the van der Waals gas.',
    keys: 'Keys: the arrow keys rotate the surface, Home restores the view; the sliders below set the strength of a and b, the two angles and the point on its three legs.',
    morph: 'a, b (share of their full values)',
    azimuth: 'turn',
    elevation: 'tilt',
    legs: 'state point on three legs',
    play: 'play',
    pause: 'pause',
    replay: 'replay',
    progress: 'point along its path',
    morphReadout: (pct: number) => `a, b at ${pct}% of their values`,
    foldKey: (t: string) => `fold: ∂P/∂v > 0, only below ${t}`,
    critKey: (t: string) => `critical isotherm ${t}`,
    clipNote: 'the surface is cut where P_r leaves its range',
    axes: `axes: v_r from 0.4 to 5 (right), T_r from 0.8 to 1.6 (into the page), P_r from ${MINUS}0.5 to 2.5 (up)`,
    legName: ['constant T (isotherm)', 'constant v (isochore)', 'constant P (isobar)'],
    legWall: ['P–v wall', 'P–T wall', 'v–T floor'],
    point: 'state point',
    walls: 'shadows on the walls',
    view: 'view',
    foldNone: 'no fold on the surface',
    foldSome: 'the surface has a fold',
    describe: (morph: number, legs: boolean, az: number, el: number, pt: string) =>
      `a and b at ${Math.round(100 * morph)}% of their values; ${morph > 0.4 ? 'the surface has a fold below the critical temperature' : 'no fold on the surface'}; viewed at ${Math.round(az)} degrees turn and ${Math.round(el)} degrees tilt.${legs ? ` State point ${pt}.` : ''}`,
  },
  he: {
    task: {
      fold: `הגבירו את ${iso('a')} ואת ${iso('b')} מאפס עד לערכיהם המלאים. היכן מתפתח קפל במשטח, ובאילו טמפרטורות?`,
      'ideal-flat': `קבעו את ${iso('a')} ואת ${iso('b')} על אפס. האם נשאר קפל כלשהו, בטמפרטורה כלשהי?`,
      shadows: 'הפעילו את שלושת הקטעים והתבוננו בצללים על הדפנות. איזו דופן מראה איזותרמה, איזו איזוכורה ואיזו איזוברה?',
      rotate: 'סובבו את המשטח בגרירה או בחצי המקלדת, עד שהקפל נראה מן הצד.',
    } satisfies Record<TaskId, string>,
    label: 'איור חי: הלחץ של גז כפונקציה של הנפח והטמפרטורה במשתנים מצומצמים, משטח תלת-ממדי שאפשר לסובב, מן הגז האידיאלי ועד גז ואן דר ואלס.',
    keys: `במקלדת: חצי המקלדת מסובבים את המשטח, Home מחזיר את התצוגה; המחוונים שלמטה קובעים את עוצמת ${iso('a')} ו-${iso('b')}, את שתי הזוויות ואת מקום הנקודה על שלושת הקטעים.`,
    morph: `${iso('a, b')} (חלק מערכיהם המלאים)`,
    azimuth: 'סיבוב',
    elevation: 'הטיה',
    legs: 'נקודת מצב על שלושה קטעים',
    play: 'הפעלה',
    pause: 'עצירה',
    replay: 'שוב',
    progress: 'הנקודה לאורך מסלולה',
    morphReadout: (pct: number) => `${iso('a, b')} ב-${iso(`${pct}%`)} מערכיהם`,
    foldKey: (t: string) => `קפל: ${iso('∂P/∂v > 0')}, רק מתחת ל-${iso(t)}`,
    critKey: (t: string) => `איזותרמה קריטית ${iso(t)}`,
    clipNote: `המשטח נחתך היכן ש-${iso('P_r')} יוצא מתחומו`,
    axes: `צירים: ${iso('v_r')} מ-${iso('0.4')} עד ${iso('5')} (ימינה), ${iso('T_r')} מ-${iso('0.8')} עד ${iso('1.6')} (פנימה), ${iso('P_r')} מ-${iso(`${MINUS}0.5`)} עד ${iso('2.5')} (למעלה)`,
    legName: ['טמפרטורה קבועה (איזותרמי)', 'נפח קבוע (איזוכורי)', 'לחץ קבוע (איזוברי)'],
    legWall: ['דופן P–v', 'דופן P–T', 'רצפת v–T'],
    point: 'נקודת מצב',
    walls: 'צללים על הדפנות',
    view: 'תצוגה',
    foldNone: 'אין קפל במשטח',
    foldSome: 'יש קפל במשטח',
    describe: (morph: number, legs: boolean, az: number, el: number, pt: string) =>
      `${iso('a')} ו-${iso('b')} ב-${iso(`${Math.round(100 * morph)}%`)} מערכיהם; ${morph > 0.4 ? 'יש קפל במשטח מתחת לטמפרטורה הקריטית' : 'אין קפל במשטח'}; התצוגה בסיבוב ${iso(`${Math.round(az)}°`)} ובהטיה ${iso(`${Math.round(el)}°`)}.${legs ? ` נקודת המצב ${pt}.` : ''}`,
  },
} satisfies Record<Lang, unknown>;

export interface PvtSurfaceProps {
  id: string;
  lang: Lang;
  /** how much of a and b is on, 0 (the ideal gas) to 1 (van der Waals); default 1 */
  morph?: number;
  /** a state point travels three legs, constant T, then constant v, then constant P, with its shadows on the walls; default false */
  legs?: boolean;
  /** degrees of turn about the vertical axis */
  azimuth?: number;
  /** degrees of tilt, from −10 (a little from below) to 85 (almost from above) */
  elevation?: number;
  tasks?: TaskId[];
}

const signed = (v: number, digits = 2) => {
  const t = Math.abs(v).toFixed(digits);
  return Number(t) === 0 ? (0).toFixed(digits) : (v < 0 ? MINUS : '') + t;
};
const LEG_KEYS = ['cold', 'work', 'hot'] as const satisfies readonly (keyof Palette)[];

export default function PvtSurface(props: PvtSurfaceProps) {
  const L = TEXT[props.lang];
  const narrow = useNarrow();
  const base = {
    morph: clamp(props.morph ?? 1, 0, 1),
    legs: props.legs ?? false,
    azimuth: wrapAzimuth(props.azimuth ?? DEFAULT_VIEW.azimuth),
    elevation: clamp(props.elevation ?? DEFAULT_VIEW.elevation, ELEVATION_RANGE[0], ELEVATION_RANGE[1]),
  };
  const [morph, setMorph] = useState(base.morph);
  const [legs, setLegs] = useState(base.legs);
  const [azimuth, setAzimuth] = useState(base.azimuth);
  const [elevation, setElevation] = useState(base.elevation);
  const [progress, setProgress] = useState(base.legs ? 0 : 1);
  const [playing, setPlaying] = useState(() => base.legs && motionAllowed());
  const legsOn = useRef(base.legs);
  const [live, setLive] = useState('');
  const drag = useRef<{ x: number; y: number } | null>(null);
  const turned = useRef(0);
  const seen = useRef({ low: false });
  const tasks: TaskDef[] = (props.tasks ?? []).map((id) => ({ id, label: L.task[id] }));

  const cells = useMemo(() => surfaceCells(morph, NV, NT), [morph]);
  const critical = useMemo(() => isothermLine(morph, 1, 2 * NV), [morph]);
  const fullPath = useMemo(() => legPath(morph, 150), [morph]);
  const here = legPoint(morph, progress);

  const startLegs = () => {
    legsOn.current = true;
    setLegs(true);
    setProgress(0);
    setPlaying(motionAllowed());
  };

  useEffect(
    () =>
      subscribeSteps(props.id, (st) => {
        if (typeof st.morph === 'number') setMorph(clamp(st.morph, 0, 1));
        if (typeof st.azimuth === 'number') setAzimuth(wrapAzimuth(st.azimuth));
        if (typeof st.elevation === 'number') setElevation(clamp(st.elevation, ELEVATION_RANGE[0], ELEVATION_RANGE[1]));
        if (typeof st.legs === 'boolean') {
          if (st.legs) {
            if (!legsOn.current) startLegs();
          } else {
            legsOn.current = false;
            setLegs(false);
            setPlaying(false);
          }
        }
      }),
    [props.id],
  );

  // the point's journey: advance while playing, stop at the end
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let done = false;
      setProgress((s) => {
        const next = s + dt / JOURNEY;
        if (next >= 1) {
          done = true;
          return 1;
        }
        return next;
      });
      if (done) setPlaying(false);
      else raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => {
    const t = props.tasks;
    const s = seen.current;
    if (morph <= 0.5) s.low = true;
    if (t?.includes('ideal-flat') && morph <= 0.05) markTask(`${props.id}:ideal-flat`);
    if (t?.includes('fold') && s.low && morph >= 0.9) markTask(`${props.id}:fold`);
  }, [morph]);
  useEffect(() => {
    if (props.tasks?.includes('shadows') && legs && progress >= 0.999) markTask(`${props.id}:shadows`);
  }, [legs, progress]);

  const ptText = `P_r = ${signed(here.p)}, v_r = ${signed(here.v)}, T_r = ${signed(here.t)}`;
  useEffect(() => {
    setLive(L.describe(morph, legs, azimuth, elevation, iso(ptText)));
  }, [morph, legs, Math.round(azimuth / 15), Math.round(elevation / 15), Math.round(progress * 6)]);

  const rotateBy = (da: number, de: number, byReader = true) => {
    setAzimuth((a) => wrapAzimuth(a + da));
    setElevation((e) => clamp(e + de, ELEVATION_RANGE[0], ELEVATION_RANGE[1]));
    if (byReader) {
      turned.current += Math.abs(da) + Math.abs(de);
      if (props.tasks?.includes('rotate') && turned.current >= 40) markTask(`${props.id}:rotate`);
    }
  };

  const draw = ({ ctx, view: vw, palette: p }: FrameInfo) => {
    const ang: ViewAngles = { azimuth, elevation };
    const scale = fitScale(vw.w, vw.h, 6) * (narrow ? 1 : 1.04);
    const cx = vw.w / 2;
    const cy = vw.h / 2;
    const pr = (q: Vec3) => project(q, ang, scale, cx, cy);
    const [hx, hy, hz] = HALF;
    const walls = backWalls(ang);
    const path2 = (pts: Vec3[], close = false) => {
      ctx.beginPath();
      pts.forEach((q, i) => {
        const s = pr(q);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      if (close) ctx.closePath();
    };

    // ---- the three back walls
    const wallFaces: Vec3[][] = [
      [[walls.x * hx, -hy, -hz], [walls.x * hx, hy, -hz], [walls.x * hx, hy, hz], [walls.x * hx, -hy, hz]],
      [[-hx, walls.y * hy, -hz], [hx, walls.y * hy, -hz], [hx, walls.y * hy, hz], [-hx, walls.y * hy, hz]],
      [[-hx, -hy, walls.z * hz], [hx, -hy, walls.z * hz], [hx, hy, walls.z * hz], [-hx, hy, walls.z * hz]],
    ];
    ctx.save();
    ctx.lineJoin = 'round';
    for (const face of wallFaces) {
      path2(face, true);
      ctx.fillStyle = withAlpha(p.paper2, 0.7);
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink3, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      // a quarter-grid on the wall
      ctx.strokeStyle = withAlpha(p.rule, 0.8);
      ctx.lineWidth = 0.7;
      for (let k = 1; k < 4; k++) {
        const s = k / 4;
        const mixV = (a: Vec3, b: Vec3, u: number): Vec3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        path2([mixV(face[0], face[1], s), mixV(face[3], face[2], s)]);
        ctx.stroke();
        path2([mixV(face[0], face[3], s), mixV(face[1], face[2], s)]);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ---- the shadows of the state point's path on the walls
    const toB = (q: { v: number; t: number; p: number }) => toBox(q.v, q.t, q.p);
    const legOf = (i: number, n: number) => Math.min(2, Math.floor((3 * i) / n));
    if (legs) {
      const drawShadow = (pick: 'onX' | 'onY' | 'onZ') => {
        const pts = fullPath.map((q) => shadowOf(toB(q), walls)[pick]);
        const n = fullPath.length - 1;
        const upTo = Math.round(progress * n);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i <= n; i++) {
          const traced = i <= upTo;
          ctx.strokeStyle = p[LEG_KEYS[legOf(i - 1, n)]] as string;
          ctx.globalAlpha = traced ? 1 : 0.28;
          ctx.lineWidth = traced ? 3 : 1.8;
          path2([pts[i - 1], pts[i]]);
          ctx.stroke();
        }
        ctx.restore();
      };
      drawShadow('onX');
      drawShadow('onY');
      drawShadow('onZ');
    }

    // ---- the surface, far cells first
    interface Item {
      depth: number;
      paint: () => void;
    }
    const items: Item[] = [];
    for (const c of cells) {
      const poly = clipPolygonZ(c.corners, -hz, hz);
      if (poly.length < 3) continue;
      const pts = poly.map(pr);
      const depth = pts.reduce((s, q) => s + q.depth, 0) / pts.length;
      const warm = clamp((c.p - P_RANGE[0]) / (P_RANGE[1] - P_RANGE[0]), 0, 1);
      const fill = c.fold ? mix(mix(p.cold, p.hot, warm), p.accent, 0.78) : mix(p.cold, p.hot, 0.15 + 0.7 * warm);
      items.push({
        depth,
        paint: () => {
          ctx.beginPath();
          pts.forEach((q, i) => (i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)));
          ctx.closePath();
          ctx.fillStyle = withAlpha(fill, c.fold ? 0.95 : 0.8);
          ctx.fill();
          ctx.strokeStyle = withAlpha(c.fold ? p.ink : p.paper, c.fold ? 0.4 : 0.5);
          ctx.lineWidth = 0.7;
          ctx.stroke();
        },
      });
    }
    // the critical isotherm, in the same depth order so a nearer ridge can hide it
    for (const run of clipPolylineZ(critical, -hz, hz)) {
      for (let i = 1; i < run.length; i++) {
        const a = pr(run[i - 1]);
        const b = pr(run[i]);
        items.push({
          depth: (a.depth + b.depth) / 2 - 0.05,
          paint: () => {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = p.ink;
            ctx.lineWidth = 3.4;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.strokeStyle = p.accent;
            ctx.lineWidth = 2;
            ctx.stroke();
          },
        });
      }
    }
    items.sort((a, b) => b.depth - a.depth);
    ctx.save();
    ctx.lineJoin = 'round';
    for (const it of items) it.paint();
    ctx.restore();

    const cp = criticalPoint(morph);
    if (cp) {
      const s = pr(toBox(cp.v, cp.t, cp.p));
      ctx.save();
      ctx.fillStyle = p.paper;
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // ---- axis names and end values, on the edges of the back walls
    ctx.save();
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centre = pr([0, 0, 0]);
    const label = (a: Vec3, b: Vec3, name: string) => {
      const sa = pr(a);
      const sb = pr(b);
      const mx = (sa.x + sb.x) / 2;
      const my = (sa.y + sb.y) / 2;
      let ox = mx - centre.x;
      let oy = my - centre.y;
      const len = Math.hypot(ox, oy) || 1;
      ox /= len;
      oy /= len;
      ctx.font = `600 12px ${p.fontUi}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = withAlpha(p.paper, 0.9);
      ctx.lineJoin = 'round';
      ctx.strokeText(name, mx + ox * 16, my + oy * 16);
      ctx.fillStyle = p.ink;
      ctx.fillText(name, mx + ox * 16, my + oy * 16);
    };
    label([-hx, -walls.y * hy, walls.z * hz], [hx, -walls.y * hy, walls.z * hz], 'v_r');
    label([walls.x * hx, -hy, walls.z * hz], [walls.x * hx, hy, walls.z * hz], 'T_r');
    label([walls.x * hx, -walls.y * hy, -hz], [walls.x * hx, -walls.y * hy, hz], 'P_r');
    ctx.restore();

    // ---- the state point, the part of the path it has travelled and its guides to the walls
    if (legs) {
      const n = fullPath.length - 1;
      const upTo = Math.round(progress * n);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i <= upTo; i++) {
        ctx.strokeStyle = p[LEG_KEYS[legOf(i - 1, n)]] as string;
        ctx.lineWidth = 3.2;
        path2([toB(fullPath[i - 1]), toB(fullPath[i])]);
        ctx.stroke();
      }
      const pt = toB(here);
      const sh = shadowOf(pt, walls);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = withAlpha(p.ink2, 0.8);
      ctx.lineWidth = 1.1;
      for (const w of [sh.onX, sh.onY, sh.onZ]) {
        path2([pt, w]);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = p.accent;
      ctx.strokeStyle = p.paper;
      ctx.lineWidth = 1.6;
      for (const w of [sh.onX, sh.onY, sh.onZ]) {
        const s = pr(w);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      const s = pr(pt);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };

  const { canvasRef, invalidate } = useFigureCanvas(draw, { worldWidth: 1, worldHeight: 1, animate: false });
  useEffect(invalidate, [morph, legs, azimuth, elevation, progress, narrow, props.lang]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') rotateBy(-5, 0);
    else if (e.key === 'ArrowRight') rotateBy(5, 0);
    else if (e.key === 'ArrowUp') rotateBy(0, 5);
    else if (e.key === 'ArrowDown') rotateBy(0, -5);
    else if (e.key === 'Home') {
      setAzimuth(DEFAULT_VIEW.azimuth);
      setElevation(DEFAULT_VIEW.elevation);
    } else return;
    e.preventDefault();
  };
  const onPointerDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    rotateBy((e.clientX - d.x) * 0.5, (e.clientY - d.y) * 0.5);
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const leg = Math.min(2, Math.floor(3 * progress));
  const pct = Math.round(100 * morph);
  const swatch = (c: string) => (
    <span class="swatch" style={{ display: 'inline-block', width: '0.7em', height: '0.7em', borderRadius: '50%', background: c, marginInlineEnd: '0.35em' }} aria-hidden="true" />
  );

  return (
    <SimShell
      fig={props.id}
      lang={props.lang}
      label={`${L.label} ${L.describe(morph, legs, azimuth, elevation, ptText)} ${L.keys}`}
      canvasRef={canvasRef}
      aspect={narrow ? 1 : 1.55}
      live={live}
      tasks={tasks}
      cursor="grab"
      touchAction="pan-y"
      onReset={() => {
        setMorph(base.morph);
        setAzimuth(base.azimuth);
        setElevation(base.elevation);
        legsOn.current = base.legs;
        setLegs(base.legs);
        setProgress(base.legs ? 0 : 1);
        setPlaying(base.legs && motionAllowed());
      }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      readout={
        <span class="gas-readout">
          <span>{L.morphReadout(pct)}</span>
          <span>
            {swatch('var(--accent)')}
            {L.foldKey('T_c')} · {morph > 0.4 ? L.foldSome : L.foldNone}
          </span>
          <span>{L.critKey('T_r = 1')}</span>
          {legs && (
            <span>
              {L.point}: <bdi class="ltr"><b class="q">{ptText}</b></bdi> · {L.legName[leg]} · {L.legWall[leg]}
            </span>
          )}
          <span class="gas-previous">
            {L.clipNote} · {L.axes}
          </span>
        </span>
      }
      controls={
        <>
          <Slider label={L.morph} min={0} max={1} step={0.01} value={morph} format={(v) => `${Math.round(100 * v)}%`} onChange={setMorph} />
          <div class="group" role="group" aria-label={L.legs}>
            <Toggle label={L.legs} on={legs} onChange={(on) => (on ? startLegs() : ((legsOn.current = false), setLegs(false), setPlaying(false)))} />
            {legs && <Toggle label={playing ? L.pause : progress >= 1 ? L.replay : L.play} on={playing} onChange={() => (playing ? setPlaying(false) : (progress >= 1 && setProgress(0), setPlaying(true)))} />}
          </div>
          {legs && (
            <Slider
              label={L.progress}
              min={0}
              max={1}
              step={0.005}
              value={progress}
              format={(v) => `${Math.round(100 * v)}%`}
              onChange={(v) => {
                setPlaying(false);
                setProgress(v);
              }}
            />
          )}
          <Slider label={L.azimuth} min={-180} max={179} step={1} value={azimuth} format={(v) => `${Math.round(v)}°`} onChange={(v) => rotateBy(v - azimuth, 0)} />
          <Slider label={L.elevation} min={ELEVATION_RANGE[0]} max={ELEVATION_RANGE[1]} step={1} value={elevation} format={(v) => `${Math.round(v)}°`} onChange={(v) => rotateBy(0, v - elevation)} />
        </>
      }
    />
  );
}
