/**
 * Drawing and axis helpers shared by the three Ising figures. Pure functions (niceMax, ladder, peaks) are
 * unit-tested in tests/unit/ising-view.test.ts; SpinImage and polyline need a canvas.
 */

import { parabolaPeak } from '~/physics/ising';
import { mix } from './ink';
import type { Plot } from './plot';

/** The smallest of 1, 2, 5 × 10ⁿ that is at least `v` and at least `floor`: an axis that grows in steps as a run goes on. */
export function niceMax(v: number, floor = 100): number {
  const target = Math.max(v, floor);
  const mag = 10 ** Math.floor(Math.log10(target));
  for (const f of [1, 2, 5, 10]) if (f * mag >= target - 1e-9) return f * mag;
  return 10 * mag;
}

/** The annealing ladder from `hot` down to `cold` in steps of `step`, as exact multiples (no accumulated rounding). */
export function ladder(hot: number, cold: number, step: number): number[] {
  const n = Math.round((hot - cold) / step);
  return Array.from({ length: n + 1 }, (_, i) => Number((hot - i * step).toFixed(6)));
}

/** The peak of y(T): a parabola through the highest point and its neighbours, or null with fewer than three points. */
export function peakOf(T: number[], y: number[]): { T: number; y: number } | null {
  if (T.length < 3 || y.length !== T.length) return null;
  const order = T.map((_, i) => i).sort((a, b) => T[a] - T[b]);
  const p = parabolaPeak(order.map((i) => T[i]), order.map((i) => y[i]));
  return { T: p.x, y: p.y };
}

const rgbOf = (c: string): [number, number, number] => {
  const m = mix(c, c, 0).match(/(\d+)/g) ?? ['0', '0', '0'];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
};

/** An L × L lattice painted into a small offscreen canvas and scaled up without smoothing: one pixel per spin. */
export class SpinImage {
  // made on first draw: the figure is also rendered on the server, which has neither document nor ImageData
  private canvas: HTMLCanvasElement | null = null;
  private img: ImageData | null = null;

  constructor(readonly size: number) {}

  /** up spins in `up`, down spins in `down` (CSS colours) */
  draw(ctx: CanvasRenderingContext2D, lattice: Int8Array, up: string, down: string, x: number, y: number, side: number) {
    if (!this.canvas || !this.img) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.size;
      this.canvas.height = this.size;
      this.img = new ImageData(this.size, this.size);
    }
    const [ur, ug, ub] = rgbOf(up);
    const [dr, dg, db] = rgbOf(down);
    const d = this.img.data;
    for (let i = 0; i < lattice.length; i++) {
      const k = 4 * i;
      const u = lattice[i] > 0;
      d[k] = u ? ur : dr;
      d[k + 1] = u ? ug : dg;
      d[k + 2] = u ? ub : db;
      d[k + 3] = 255;
    }
    this.canvas.getContext('2d')!.putImageData(this.img, 0, 0);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, x, y, side, side);
    ctx.restore();
  }
}

/** A polyline through data points, clipped to the plot box. */
export function polyline(ctx: CanvasRenderingContext2D, plot: Plot, xs: ArrayLike<number>, ys: ArrayLike<number>, color: string, width = 1.6, dash: number[] = []) {
  if (xs.length < 2) return;
  const { box } = plot;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y - 1, box.w, box.h + 2);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i < xs.length; i++) {
    const sx = plot.px(xs[i]);
    const sy = plot.py(ys[i]);
    if (i) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
  }
  ctx.stroke();
  ctx.restore();
}

/** A filled marker: shape 0 circle, 1 square, 2 triangle, 3 diamond; never colour alone. */
export function marker(ctx: CanvasRenderingContext2D, x: number, y: number, shape: number, r: number, fill: string | null, stroke?: string) {
  ctx.beginPath();
  if (shape === 0) ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 1) ctx.rect(x - r, y - r, 2 * r, 2 * r);
  else if (shape === 2) {
    ctx.moveTo(x, y - r * 1.2);
    ctx.lineTo(x + r * 1.1, y + r * 0.8);
    ctx.lineTo(x - r * 1.1, y + r * 0.8);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y - r * 1.2);
    ctx.lineTo(x + r * 1.2, y);
    ctx.lineTo(x, y + r * 1.2);
    ctx.lineTo(x - r * 1.2, y);
    ctx.closePath();
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}

/** "T" with a subscript c, then `rest`, in the context's current font and fill; `align` says which end of the run `x` is. */
export function fillTc(ctx: CanvasRenderingContext2D, x: number, y: number, align: 'left' | 'right', rest = '') {
  const px = (f: string, size: number) => f.replace(/\d+(?:\.\d+)?px/, `${size}px`);
  const font = ctx.font;
  const base = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '12');
  const small = px(font, Math.round(base * 0.75));
  const wT = ctx.measureText('T').width;
  const wRest = rest ? ctx.measureText(rest).width : 0;
  ctx.font = small;
  const wc = ctx.measureText('c').width;
  ctx.textAlign = 'left';
  let x0 = align === 'left' ? x : x - (wT + wc + wRest);
  ctx.font = font;
  ctx.fillText('T', x0, y);
  x0 += wT;
  ctx.font = small;
  ctx.fillText('c', x0, y + base * 0.3);
  x0 += wc;
  ctx.font = font;
  if (rest) ctx.fillText(rest, x0, y);
}
