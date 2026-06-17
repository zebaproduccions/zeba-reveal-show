import { clamp, easeInOut, easeOut, linear, lerp, type Easing } from "./easing";
import { sampleKeyframes } from "./timeline";
import type { Layer } from "./types";

// ============================================================
// Motion — time-based transforms (move / scale / rotate) applied on top of a
// layer's entrance. Each track is a list of keyframes over a 0..1 cycle phase;
// motion can loop. Transforms are applied around the layer's pivot via the
// canvas matrix, so they compose cleanly with the layer's own draw (including
// its entrance fade). Opacity is left to the entrance — motion is geometry.
// ============================================================

export type MotionEase = "linear" | "inOut" | "out";
export type MotionKeyframe = { t: number; v: number; ease?: MotionEase };

export type Motion = {
  /** Repeat the cycle for the whole animation. Default false. */
  loop?: boolean;
  /** Length of one cycle in ms. Default: the animation's duration. */
  duration?: number;
  /** Horizontal offset, as a fraction of canvas width. */
  x?: MotionKeyframe[];
  /** Vertical offset, as a fraction of canvas height. */
  y?: MotionKeyframe[];
  /** Uniform scale multiplier (1 = original size). */
  scale?: MotionKeyframe[];
  /** Rotation in degrees. */
  rotate?: MotionKeyframe[];
};

const EASE: Record<MotionEase, Easing> = { linear, inOut: easeInOut, out: easeOut };

function sampleTrack(kfs: MotionKeyframe[] | undefined, phase: number, fallback: number) {
  if (!kfs || kfs.length === 0) return fallback;
  const mapped = kfs.map((k) => ({ t: k.t, value: k.v, easing: EASE[k.ease ?? "linear"] }));
  return sampleKeyframes(mapped, phase, lerp);
}

/**
 * Wrap a layer so its drawing is transformed over time. `pivotX`/`pivotY` are
 * normalized (0..1) — the point the layer rotates/scales around and moves from.
 */
export function withMotion(layer: Layer, motion: Motion, pivotX: number, pivotY: number): Layer {
  return {
    name: layer.name,
    start: layer.start,
    end: layer.end,
    easing: layer.easing,
    draw(rc) {
      const { ctx, t, W, H, anim } = rc;
      const dur = motion.duration && motion.duration > 0 ? motion.duration : anim.duration;
      const phase = motion.loop ? (((t % dur) + dur) % dur) / dur : clamp(t / dur);

      const dx = sampleTrack(motion.x, phase, 0) * W;
      const dy = sampleTrack(motion.y, phase, 0) * H;
      const sc = sampleTrack(motion.scale, phase, 1);
      const rot = (sampleTrack(motion.rotate, phase, 0) * Math.PI) / 180;

      const px = pivotX * W;
      const py = pivotY * H;
      ctx.save();
      ctx.translate(px + dx, py + dy);
      ctx.rotate(rot);
      ctx.scale(sc, sc);
      ctx.translate(-px, -py);
      layer.draw(rc);
      ctx.restore();
    },
  };
}
