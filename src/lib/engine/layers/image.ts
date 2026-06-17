import { clamp, easeOut, type Easing } from "../easing";
import type { Layer } from "../types";

// ============================================================
// Image layer — draws a loaded image onto the canvas. The image element is
// resolved at build time (it lives client-side, loaded from an attachment),
// so it renders identically on screen and on the upscaled recording canvas.
// Position is the normalized centre; width is a fraction of canvas width and
// height is derived from the image's aspect ratio unless given.
// ============================================================

export type ImageLayerOptions = {
  img: HTMLImageElement;
  x: number;
  y: number;
  /** Width as a fraction of canvas width. */
  w: number;
  /** Optional height as a fraction of canvas height (else derived from aspect). */
  h?: number;
  start?: number;
  in?: number;
  fade?: boolean;
  scaleIn?: boolean;
  easing?: Easing;
  name?: string;
};

export function image(o: ImageLayerOptions): Layer {
  const start = o.start ?? 0;
  const dur = o.in ?? 600;
  const fade = o.fade ?? true;
  const scaleIn = o.scaleIn ?? true;
  return {
    name: o.name ?? "image",
    start,
    end: start + dur,
    easing: o.easing ?? easeOut,
    draw({ ctx, p, W, H }) {
      const iw = o.img.naturalWidth || o.img.width;
      const ih = o.img.naturalHeight || o.img.height;
      if (!iw || !ih) return;
      const s = scaleIn ? p : 1;
      const wPx = o.w * W * s;
      const hPx = (o.h != null ? o.h * H : o.w * W * (ih / iw)) * s;
      if (wPx <= 0 || hPx <= 0) return;
      ctx.globalAlpha = fade ? clamp(p) : 1;
      ctx.drawImage(o.img, o.x * W - wPx / 2, o.y * H - hPx / 2, wPx, hPx);
    },
  };
}
