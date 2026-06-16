import { clamp, easeOut, type Easing } from "../easing";
import type { Layer } from "../types";

// ============================================================
// Shape layers — reusable, topic-agnostic primitives (circle, bar, line).
// Normalized positions (0..1) and height-fraction sizes, like the text layer.
// ============================================================

export type CircleOptions = {
  x: number;
  y: number;
  /** Radius as a fraction of canvas height. */
  r: number;
  fill?: string;
  stroke?: string;
  /** Stroke width as a fraction of canvas height. */
  lineWidth?: number;
  start?: number;
  in?: number;
  /** Grow from 0 during entrance (default true). */
  scaleIn?: boolean;
  fade?: boolean;
  easing?: Easing;
  name?: string;
};

export function circle(o: CircleOptions): Layer {
  const start = o.start ?? 0;
  const dur = o.in ?? 500;
  const scaleIn = o.scaleIn ?? true;
  const fade = o.fade ?? true;
  return {
    name: o.name ?? "circle",
    start,
    end: start + dur,
    easing: o.easing ?? easeOut,
    draw({ ctx, p, W, H }) {
      const r = o.r * H * (scaleIn ? p : 1);
      if (r <= 0) return;
      ctx.globalAlpha = fade ? clamp(p) : 1;
      ctx.beginPath();
      ctx.arc(o.x * W, o.y * H, r, 0, Math.PI * 2);
      if (o.fill) {
        ctx.fillStyle = o.fill;
        ctx.fill();
      }
      if (o.stroke) {
        ctx.strokeStyle = o.stroke;
        ctx.lineWidth = (o.lineWidth ?? 0.004) * H;
        ctx.stroke();
      }
    },
  };
}

export type BarOptions = {
  /** Normalized centre. */
  x: number;
  y: number;
  /** Width as a fraction of canvas width, height as a fraction of height. */
  w: number;
  h: number;
  fill: string;
  /** Corner radius as a fraction of height. */
  radius?: number;
  start?: number;
  in?: number;
  /** Grow horizontally from the centre during entrance (default true). */
  grow?: boolean;
  fade?: boolean;
  easing?: Easing;
  name?: string;
};

export function bar(o: BarOptions): Layer {
  const start = o.start ?? 0;
  const dur = o.in ?? 500;
  const grow = o.grow ?? true;
  const fade = o.fade ?? true;
  return {
    name: o.name ?? "bar",
    start,
    end: start + dur,
    easing: o.easing ?? easeOut,
    draw({ ctx, p, W, H }) {
      const ww = o.w * W * (grow ? p : 1);
      const hh = o.h * H;
      if (ww <= 0 || hh <= 0) return;
      const x = o.x * W - ww / 2;
      const y = o.y * H - hh / 2;
      const rad = Math.min((o.radius ?? 0) * H, hh / 2, ww / 2);
      ctx.globalAlpha = fade ? clamp(p) : 1;
      ctx.fillStyle = o.fill;
      ctx.beginPath();
      ctx.roundRect(x, y, ww, hh, rad);
      ctx.fill();
    },
  };
}

export type LineOptions = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  /** Stroke width as a fraction of canvas height. */
  lineWidth?: number;
  cap?: CanvasLineCap;
  start?: number;
  in?: number;
  easing?: Easing;
  name?: string;
};

// A line that draws itself progressively from (x1,y1) toward (x2,y2).
export function line(o: LineOptions): Layer {
  const start = o.start ?? 0;
  const dur = o.in ?? 600;
  return {
    name: o.name ?? "line",
    start,
    end: start + dur,
    easing: o.easing ?? easeOut,
    draw({ ctx, p, W, H }) {
      const x1 = o.x1 * W;
      const y1 = o.y1 * H;
      const x2 = o.x2 * W;
      const y2 = o.y2 * H;
      ctx.strokeStyle = o.stroke;
      ctx.lineWidth = (o.lineWidth ?? 0.003) * H;
      ctx.lineCap = o.cap ?? "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p);
      ctx.stroke();
    },
  };
}
