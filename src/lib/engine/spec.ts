import { image } from "./layers/image";
import { bar, circle, line } from "./layers/shape";
import { text } from "./layers/text";
import type { Animation, Layer } from "./types";

// ============================================================
// Animation spec — a JSON-serializable description of an animation that maps
// onto the engine's reusable layers. This is the bridge between AI-generated
// data and the renderer: the AI fills a spec (never code), and `fromSpec`
// turns it into a real Animation. Everything is validated/clamped defensively
// because the input is external.
// ============================================================

export type SpecTextLayer = {
  kind: "text";
  text: string | string[];
  x: number;
  y: number;
  size: number;
  color: string;
  weight?: number;
  align?: "left" | "center" | "right";
  start?: number;
  in?: number;
  rise?: number;
};

export type SpecCircleLayer = {
  kind: "circle";
  x: number;
  y: number;
  r: number;
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  start?: number;
  in?: number;
};

export type SpecBarLayer = {
  kind: "bar";
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  radius?: number;
  start?: number;
  in?: number;
};

export type SpecLineLayer = {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  lineWidth?: number;
  start?: number;
  in?: number;
};

export type SpecImageLayer = {
  kind: "image";
  /** Index into the attached images (0-based). */
  ref: number;
  x: number;
  y: number;
  w: number;
  h?: number;
  start?: number;
  in?: number;
};

export type SpecLayer =
  | SpecTextLayer
  | SpecCircleLayer
  | SpecBarLayer
  | SpecLineLayer
  | SpecImageLayer;

export type AnimationSpec = {
  title: string;
  duration: number;
  background?: string;
  layers: SpecLayer[];
};

const DEFAULT_BG = "#0a1c3f";

const num = (v: unknown, fallback: number) => (typeof v === "number" && isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === "string" && v.length > 0 ? v : fallback);

function toLayer(l: SpecLayer, images: HTMLImageElement[]): Layer | null {
  switch (l.kind) {
    case "image": {
      const img = images[num(l.ref, 0)];
      if (!img) return null;
      return image({
        img,
        x: num(l.x, 0.5),
        y: num(l.y, 0.5),
        w: num(l.w, 0.3),
        h: typeof l.h === "number" ? l.h : undefined,
        start: num(l.start, 0),
        in: num(l.in, 600),
      });
    }
    case "text":
      return text({
        text: Array.isArray(l.text) ? l.text : str(l.text, ""),
        x: num(l.x, 0.5),
        y: num(l.y, 0.5),
        size: num(l.size, 0.06),
        color: str(l.color, "#ffffff"),
        weight: num(l.weight, 600),
        align: l.align ?? "center",
        baseline: "middle",
        start: num(l.start, 0),
        in: num(l.in, 600),
        rise: num(l.rise, 0.03),
      });
    case "circle":
      return circle({
        x: num(l.x, 0.5),
        y: num(l.y, 0.5),
        r: num(l.r, 0.04),
        fill: l.fill,
        stroke: l.stroke,
        lineWidth: l.lineWidth,
        start: num(l.start, 0),
        in: num(l.in, 500),
      });
    case "bar":
      return bar({
        x: num(l.x, 0.5),
        y: num(l.y, 0.5),
        w: num(l.w, 0.2),
        h: num(l.h, 0.01),
        fill: str(l.fill, "#ffffff"),
        radius: l.radius,
        start: num(l.start, 0),
        in: num(l.in, 500),
      });
    case "line":
      return line({
        x1: num(l.x1, 0.3),
        y1: num(l.y1, 0.5),
        x2: num(l.x2, 0.7),
        y2: num(l.y2, 0.5),
        stroke: str(l.stroke, "#ffffff"),
        lineWidth: l.lineWidth,
        start: num(l.start, 0),
        in: num(l.in, 600),
      });
    default:
      return null;
  }
}

/** Build a runnable Animation from a (possibly AI-generated) spec. */
export function fromSpec(
  spec: AnimationSpec,
  images: HTMLImageElement[] = [],
  id = `ai-${Date.now()}`,
): Animation {
  const layers = (Array.isArray(spec.layers) ? spec.layers : [])
    .map((l) => toLayer(l, images))
    .filter((l): l is Layer => l !== null);
  return {
    id,
    title: str(spec.title, "Animació generada"),
    width: 1920,
    height: 1080,
    duration: Math.min(Math.max(num(spec.duration, 6000), 1000), 20000),
    startDelay: 0,
    background: str(spec.background, DEFAULT_BG),
    layers,
  };
}
