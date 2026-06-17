import { clamp, easeOut, type Easing } from "../easing";
import type { Layer } from "../types";

// ============================================================
// Text layer — a reusable, topic-agnostic building block.
//
// Positions are normalized (0..1 of the canvas) and sizes are fractions of the
// height, so a layer renders identically on the on-screen canvas and on the
// upscaled recording canvas. The layer animates in across [start, start+in]
// (fade + optional rise) and then holds.
// ============================================================

const GEOMETRIC_SANS =
  '"DM Sans", "Manrope", "Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif';

export type TextLayerOptions = {
  text: string | string[];
  /** Normalized anchor (0..1). */
  x: number;
  y: number;
  /** Font size as a fraction of canvas height. */
  size: number;
  color: string;
  font?: string;
  weight?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Line height as a multiple of the font size (for multi-line text). */
  lineHeight?: number;
  /** Extra letter-spacing as a fraction of height (approximate). */
  start?: number;
  /** Entrance duration in ms. */
  in?: number;
  /** Normalized vertical distance the text rises from during entrance. */
  rise?: number;
  fade?: boolean;
  easing?: Easing;
  name?: string;
};

export function text(o: TextLayerOptions): Layer {
  const start = o.start ?? 0;
  const dur = o.in ?? 600;
  const rise = o.rise ?? 0.03;
  const fade = o.fade ?? true;
  const lineH = o.lineHeight ?? 1.2;
  return {
    name: o.name ?? "text",
    start,
    end: start + dur,
    easing: o.easing ?? easeOut,
    draw({ ctx, p, W, H }) {
      const fs = o.size * H;
      ctx.font = `${o.weight ?? 600} ${fs}px ${o.font ?? GEOMETRIC_SANS}`;
      ctx.textAlign = o.align ?? "center";
      ctx.textBaseline = o.baseline ?? "alphabetic";
      ctx.fillStyle = o.color;
      ctx.globalAlpha = fade ? clamp(p) : 1;
      const dy = (1 - p) * rise * H;
      const lines = Array.isArray(o.text) ? o.text : [o.text];
      const x = o.x * W;
      const y0 = o.y * H + dy;
      lines.forEach((ln, i) => ctx.fillText(ln, x, y0 + i * fs * lineH));
    },
  };
}

export { GEOMETRIC_SANS };
