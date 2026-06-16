import type { Easing } from "./easing";

// ============================================================
// Generic animation engine — core types
//
// An animation is plain DATA: a duration, a canvas size and an ordered list
// of layers. Each layer knows how to draw itself for a given moment in time.
// The engine (renderer + recorder) only plays and records; it knows nothing
// about maps, text or any specific topic. Map-specific behaviour lives in
// reusable layer helpers under ./layers, and each concrete animation lives as
// data under src/animations.
// ============================================================

export type RenderContext = {
  ctx: CanvasRenderingContext2D;
  /** Global elapsed time in ms, already offset by startDelay. Always >= 0. */
  t: number;
  /** Eased progress 0..1 across the layer's [start, end] window. */
  p: number;
  /** Un-eased progress 0..1 across the layer's [start, end] window. */
  pRaw: number;
  /** Canvas width in px (the actual render target, may be upscaled). */
  W: number;
  /** Canvas height in px. */
  H: number;
  /**
   * Per-frame shared scratch space. Layers can publish values for later
   * layers to read (e.g. a map layer stores its projection here so that
   * overlay layers can position themselves in the same coordinate space).
   */
  state: Record<string, unknown>;
  anim: Animation;
};

export type Layer = {
  name?: string;
  /** When the layer becomes active, in ms. Default 0. */
  start?: number;
  /** When the layer's progress reaches 1, in ms. Default anim.duration. */
  end?: number;
  /** Easing applied to the progress passed as `p`. Default linear. */
  easing?: Easing;
  /**
   * Draw the layer. Called every frame where `t >= start`. The layer is free
   * to keep drawing after `end` (progress stays clamped at 1), or to hide
   * itself based on `rc.t` for custom visibility windows.
   */
  draw: (rc: RenderContext) => void;
};

export type Background =
  | string
  | ((ctx: CanvasRenderingContext2D, W: number, H: number) => void);

export type Animation = {
  id: string;
  title: string;
  /** Authoring resolution. The recorder may render at a multiple of this. */
  width: number;
  height: number;
  /** Total animation length in ms (excludes startDelay). */
  duration: number;
  /** Delay before anything is drawn, in ms. Default 0. */
  startDelay?: number;
  /** Solid colour string or a custom painter run before every frame. */
  background?: Background;
  /** Async preparation (data loading) run once before playback/recording. */
  setup?: () => Promise<void>;
  layers: Layer[];
};
