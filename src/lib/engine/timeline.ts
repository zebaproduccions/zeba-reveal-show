import { clamp, lerp, linear, type Easing } from "./easing";

// ============================================================
// Timeline helpers: keyframe interpolation shared by layers.
// ============================================================

export type Keyframe<V> = { t: number; value: V; easing?: Easing };

/**
 * Sample a keyframed track at time `t`. Keyframes must be sorted by `t`.
 * Between two keyframes the segment's progress is eased by the *second*
 * keyframe's easing (the one being approached). `interp` blends two values.
 */
export function sampleKeyframes<V>(
  keyframes: Keyframe<V>[],
  t: number,
  interp: (a: V, b: V, p: number) => V,
): V {
  if (keyframes.length === 0) throw new Error("sampleKeyframes: no keyframes");
  if (t <= keyframes[0].t) return keyframes[0].value;
  const last = keyframes[keyframes.length - 1];
  if (t >= last.t) return last.value;
  for (let i = 1; i < keyframes.length; i++) {
    const a = keyframes[i - 1];
    const b = keyframes[i];
    if (t <= b.t) {
      const span = b.t - a.t;
      const raw = span <= 0 ? 1 : clamp((t - a.t) / span);
      const ease = b.easing ?? linear;
      return interp(a.value, b.value, ease(raw));
    }
  }
  return last.value;
}

/** Number track convenience wrapper. */
export const sampleNumber = (keyframes: Keyframe<number>[], t: number) =>
  sampleKeyframes(keyframes, t, lerp);
