import { clamp, linear } from "./easing";
import type { Animation, RenderContext } from "./types";

// ============================================================
// Renderer: plays an Animation onto a 2D context for a given moment.
// Resolution-independent — every layer scales off the W/H it receives, so
// the same draw code serves both the on-screen canvas and the upscaled
// recording canvas.
// ============================================================

function paintBackground(anim: Animation, ctx: CanvasRenderingContext2D, W: number, H: number) {
  const bg = anim.background;
  if (!bg) {
    ctx.clearRect(0, 0, W, H);
    return;
  }
  if (typeof bg === "string") {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  bg(ctx, W, H);
}

/**
 * Draw a single frame. `tRaw` is the elapsed time since playback began,
 * including the animation's startDelay.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  anim: Animation,
  tRaw: number,
  W: number,
  H: number,
) {
  paintBackground(anim, ctx, W, H);

  const t = tRaw - (anim.startDelay ?? 0);
  if (t < 0) return;

  const state: Record<string, unknown> = {};
  for (const layer of anim.layers) {
    const start = layer.start ?? 0;
    if (t < start) continue;
    const end = layer.end ?? anim.duration;
    const span = end - start;
    const pRaw = span <= 0 ? 1 : clamp((t - start) / span);
    const ease = layer.easing ?? linear;
    const rc: RenderContext = {
      ctx,
      t,
      p: ease(pRaw),
      pRaw,
      W,
      H,
      state,
      anim,
    };
    ctx.save();
    layer.draw(rc);
    ctx.restore();
  }
}
