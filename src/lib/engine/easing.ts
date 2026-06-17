// Shared easing functions for the animation engine.
export type Easing = (t: number) => number;

export const linear: Easing = (t) => t;
export const easeInOut: Easing = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOut: Easing = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutExpo: Easing = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
