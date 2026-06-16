import { geoMercator } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { lerp } from "../easing";
import { sampleKeyframes, sampleNumber, type Keyframe } from "../timeline";

// ============================================================
// Map camera — the reusable, hard-won part of any map animation.
//
// The camera interpolates the geographic BOUNDING BOX (not projected pixel
// translates) so the move is always rectilinear over the Earth, then fits a
// geoMercator projection to that box. A concrete map animation supplies bbox
// and padding keyframes; everything else (basemap palette, overlays) lives in
// the animation's own layers.
// ============================================================

export type Bbox = [[number, number], [number, number]];

export type CameraSample = { projection: GeoProjection; scale: number };

// Fit a projection to a bbox. Use a LineString instead of a Polygon: d3-geo
// treats spherical polygon winding specially and a bbox polygon can be read as
// the rest of the globe.
export function projForBbox(bbox: Bbox, W: number, H: number, pad: number) {
  const outline = {
    type: "LineString" as const,
    coordinates: [
      [bbox[0][0], bbox[0][1]],
      [bbox[1][0], bbox[0][1]],
      [bbox[1][0], bbox[1][1]],
      [bbox[0][0], bbox[1][1]],
      [bbox[0][0], bbox[0][1]],
    ],
  };
  const p = geoMercator();
  p.fitExtent(
    [
      [pad, pad],
      [W - pad, H - pad],
    ],
    outline,
  );
  return { scale: p.scale(), translate: p.translate() as [number, number] };
}

const lerpBbox = (a: Bbox, b: Bbox, p: number): Bbox => [
  [lerp(a[0][0], b[0][0], p), lerp(a[0][1], b[0][1], p)],
  [lerp(a[1][0], b[1][0], p), lerp(a[1][1], b[1][1], p)],
];

/**
 * Build a camera from bbox + padding keyframes. Returns a function that, given
 * a moment and the render size, yields a fitted projection and its scale.
 */
export function createCamera(bbox: Keyframe<Bbox>[], pad: Keyframe<number>[]) {
  return (t: number, W: number, H: number): CameraSample => {
    const box = sampleKeyframes(bbox, t, lerpBbox);
    const padding = sampleNumber(pad, t);
    const { scale, translate } = projForBbox(box, W, H, padding);
    const projection = geoMercator().scale(scale).translate(translate);
    return { projection, scale };
  };
}

/** Key under which map layers publish their projection for overlay layers. */
export const PROJECTION_KEY = "projection";
export const SCALE_KEY = "mapScale";

export function readProjection(state: Record<string, unknown>): GeoProjection | null {
  return (state[PROJECTION_KEY] as GeoProjection | undefined) ?? null;
}
export function readScale(state: Record<string, unknown>): number {
  return (state[SCALE_KEY] as number | undefined) ?? 0;
}
