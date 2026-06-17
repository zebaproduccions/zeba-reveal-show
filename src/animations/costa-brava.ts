import { geoPath } from "d3-geo";
import { loadGeo, type Geo } from "@/lib/geo-data";
import {
  clamp,
  easeInOut,
  easeOut,
  easeOutExpo,
} from "@/lib/engine/easing";
import {
  createCamera,
  PROJECTION_KEY,
  readProjection,
  readScale,
  SCALE_KEY,
  type Bbox,
} from "@/lib/engine/layers/map";
import type { Animation, Layer, RenderContext } from "@/lib/engine/types";

// ============================================================
// Costa Brava — Europe → Catalonia → Connections.
// The original hand-tuned animation, now expressed as engine DATA: a camera +
// a stack of layers. Visually identical to the previous record-animation.ts.
// ============================================================

const W = 1920;
const H = 1080;
const START_DELAY = 800;
const DURATION = 14000;

// Palette (cream paper, tan land, blue accents).
const CREAM = "#f3ecdf";
const LAND = "#ece1c8";
const LAND_DARK = "#dccdaa";
const OUTLINE = "#b8a98a";
const OUTLINE_FAINT = "#cabb9a";
const NAVY = "#0e3d8f";
const BLUE = "#1f64c0";
const INK = "#0d3a86";
const MUTED = "#6c5d44";

const SCENE_BBOX: Bbox[] = [
  [
    [-11, 36],
    [12, 52],
  ], // Western Europe
  [
    [-2, 39.8],
    [5, 43.4],
  ], // NE Spain / Catalonia
  [
    [1.5, 41.1],
    [3.6, 42.5],
  ], // East Catalonia / coast
];

const T = {
  highlight_in: 900,
  zoom1to2_start: 2400,
  zoom1to2_end: 3800,
  coast_start: 4500,
  coast_end: 6200,
  costa_label: 6000,
  zoom2to3_start: 7400,
  zoom2to3_end: 8800,
  picto_start: 9200,
  city_dots: 9400,
  labels_start: 10200,
};

// Camera: interpolate the geographic bbox + padding through the three scenes.
const camera = createCamera(
  [
    { t: 0, value: SCENE_BBOX[0] },
    { t: T.zoom1to2_start, value: SCENE_BBOX[0] },
    { t: T.zoom1to2_end, value: SCENE_BBOX[1], easing: easeInOut },
    { t: T.zoom2to3_start, value: SCENE_BBOX[1] },
    { t: T.zoom2to3_end, value: SCENE_BBOX[2], easing: easeInOut },
  ],
  [
    { t: 0, value: 80 },
    { t: T.zoom1to2_start, value: 80 },
    { t: T.zoom1to2_end, value: 100, easing: easeInOut },
    { t: T.zoom2to3_start, value: 100 },
    { t: T.zoom2to3_end, value: 120, easing: easeInOut },
  ],
);

// ---------- Sea mask polygon ----------
// Covers the Mediterranean. Drawn after world countries (coarse 50m dataset
// bleeds past the real coast) and before Spain provinces (redrawn on top). The
// western boundary runs inland; the northern boundary follows the real French
// coast so French inland territory stays land. First/last point must match
// COSTA_BRAVA_END (Portbou).
const SEA_MASK: [number, number][] = [
  [3.171, 42.432],
  [3.18, 42.55],
  [3.25, 42.8],
  [3.4, 43.1],
  [3.7, 43.45],
  [5.4, 43.4],
  [7.3, 43.75],
  [8.0, 44.0],
  [18, 44],
  [18, 30],
  [-10, 30],
  [-10, 38],
  [-2.5, 38],
  [-1.0, 39.5],
  [-0.5, 40.0],
  [0.0, 40.5],
  [0.5, 41.0],
  [1.0, 41.5],
  [1.7, 41.7],
  [2.2, 42.0],
  [2.7, 42.3],
  [3.171, 42.432],
];

// Background paper gradient — shared by the canvas background and the sea mask
// so the mask is invisible against the sea.
function paperGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w * 0.7);
  grad.addColorStop(0, "#f7f1e4");
  grad.addColorStop(1, CREAM);
  return grad;
}

// ---------- Pictogram ----------
function drawPicto(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  icon: "plane" | "train",
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.stroke();

  ctx.fillStyle = BLUE;
  if (icon === "plane") {
    const s = r * 0.62;
    ctx.translate(cx, cy);
    ctx.rotate((5 * Math.PI) / 6); // nose upper-right, taking off
    ctx.beginPath();
    ctx.moveTo(-s * 1.05, 0);
    ctx.lineTo(s * 0.05, -s * 0.18);
    ctx.lineTo(s * 0.55, -s * 0.85);
    ctx.lineTo(s * 0.85, -s * 0.85);
    ctx.lineTo(s * 0.45, -s * 0.1);
    ctx.lineTo(s * 1.05, -s * 0.1);
    ctx.lineTo(s * 1.05, s * 0.1);
    ctx.lineTo(s * 0.45, s * 0.1);
    ctx.lineTo(s * 0.85, s * 0.85);
    ctx.lineTo(s * 0.55, s * 0.85);
    ctx.lineTo(s * 0.05, s * 0.18);
    ctx.lineTo(-s * 1.05, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    const w = r * 1.0,
      h = r * 1.05;
    const x = cx - w / 2,
      y = cy - h / 2;
    const rad = r * 0.22;
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h * 0.78);
    ctx.quadraticCurveTo(x + w, y + h * 0.88, x + w - rad * 0.6, y + h * 0.88);
    ctx.lineTo(x + rad * 0.6, y + h * 0.88);
    ctx.quadraticCurveTo(x, y + h * 0.88, x, y + h * 0.78);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    const ww = w * 0.3,
      wh = h * 0.28;
    ctx.fillRect(x + w * 0.1, y + h * 0.16, ww, wh);
    ctx.fillRect(x + w * 0.6, y + h * 0.16, ww, wh);
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.arc(x + w * 0.22, y + h * 0.95, r * 0.13, 0, Math.PI * 2);
    ctx.arc(x + w * 0.78, y + h * 0.95, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Geo data ----------
let geo: Geo | null = null;

// ---------- Layers ----------

// Basemap: camera + world / sea mask / Spain provinces / Catalonia. Publishes
// the projection and scale for the overlay layers that follow.
const basemap: Layer = {
  name: "basemap",
  draw({ ctx, t, W, H, state }: RenderContext) {
    const { projection: proj, scale: scaleNow } = camera(t, W, H);
    state[PROJECTION_KEY] = proj;
    state[SCALE_KEY] = scaleNow;

    if (!geo) {
      ctx.fillStyle = MUTED;
      ctx.font = `400 ${Math.round(H * 0.025)}px "Mulish", "Inter", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Carregant mapa…", W / 2, H / 2);
      return;
    }

    const path = geoPath(proj, ctx);
    const fadeIn = clamp(t / 600);
    const grad = paperGradient(ctx, W, H);

    ctx.save();
    ctx.globalAlpha = fadeIn;

    const strokeWorld = scaleNow < 800;
    const strokeSpain = scaleNow >= 800 && scaleNow < 2000;
    const strokeCatalonia = scaleNow >= 800;

    ctx.fillStyle = LAND;
    ctx.strokeStyle = OUTLINE_FAINT;
    ctx.lineWidth = 0.5;
    for (const f of geo.worldCountries.features) {
      ctx.beginPath();
      path(f);
      ctx.fill();
      if (strokeWorld) ctx.stroke();
    }

    if (scaleNow >= 400) {
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < SEA_MASK.length; i++) {
        const p = proj(SEA_MASK[i]);
        if (!p) continue;
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    if (scaleNow >= 800) {
      ctx.save();
      ctx.fillStyle = LAND;
      for (const f of geo.spainProvinces.features) {
        ctx.beginPath();
        path(f);
        ctx.fill();
      }
      if (strokeSpain) {
        const alpha = clamp((scaleNow - 800) / 600);
        ctx.globalAlpha *= alpha * 0.6;
        ctx.strokeStyle = OUTLINE_FAINT;
        ctx.lineWidth = 0.5;
        for (const f of geo.spainProvinces.features) {
          ctx.beginPath();
          path(f);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    ctx.fillStyle = LAND_DARK;
    for (const f of geo.cataloniaProvinces) {
      ctx.beginPath();
      path(f);
      ctx.fill();
    }
    if (strokeCatalonia) {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 0.6;
      for (const f of geo.cataloniaProvinces) {
        ctx.beginPath();
        path(f);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};

// Scene 1: pulsing blue circle around Catalonia with a dotted leader.
const highlight: Layer = {
  name: "highlight",
  draw({ ctx, t, state }: RenderContext) {
    if (t >= T.zoom1to2_start + 200) return;
    const proj = readProjection(state);
    const scaleNow = readScale(state);
    if (!proj) return;
    const p = clamp((t - T.highlight_in) / 700);
    if (p <= 0) return;
    const e = easeOutExpo(p);
    const center = proj([1.7, 41.7]);
    if (!center) return;
    const r = scaleNow * 0.05 * (0.9 + 0.1 * Math.sin(t / 250));
    ctx.save();
    ctx.globalAlpha = e * 0.95;
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = Math.max(2, scaleNow * 0.0015);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(center[0], center[1], r, 0, Math.PI * 2 * e);
    ctx.stroke();
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = Math.max(1, scaleNow * 0.0008);
    ctx.beginPath();
    ctx.moveTo(center[0] + r * 1.05, center[1]);
    ctx.lineTo(center[0] + r * 1.6, center[1]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },
};

// Costa Brava coastline, drawn progressively and kept visible afterwards.
const coastTrace: Layer = {
  name: "coast",
  start: T.coast_start,
  draw({ ctx, t, state }: RenderContext) {
    if (!geo) return;
    const proj = readProjection(state);
    const scaleNow = readScale(state);
    if (!proj) return;
    const prog = clamp((t - T.coast_start) / (T.coast_end - T.coast_start));
    const pts = geo.costaBravaCoast.map((p) => proj(p)).filter(Boolean) as [number, number][];
    if (pts.length < 2) return;
    const lens: number[] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l);
      total += l;
    }
    const targetLen = total * easeOut(prog);
    ctx.save();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = Math.max(0.8, Math.min(scaleNow * 0.0004, H * 0.0022));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      if (acc + lens[i - 1] <= targetLen) {
        ctx.lineTo(pts[i][0], pts[i][1]);
        acc += lens[i - 1];
      } else {
        const k = (targetLen - acc) / lens[i - 1];
        ctx.lineTo(
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k,
        );
        break;
      }
    }
    ctx.stroke();
    ctx.restore();
  },
};

// "Costa Brava" label, visible until the final zoom begins.
const costaLabel: Layer = {
  name: "costa-label",
  start: T.costa_label,
  draw({ ctx, t, H, state }: RenderContext) {
    if (t >= T.zoom2to3_start + 200) return;
    const proj = readProjection(state);
    if (!proj) return;
    const la = clamp((t - T.costa_label) / 700);
    const anchor = proj([3.75, 41.78]) ?? proj([3.6, 41.8]);
    if (!anchor) return;
    ctx.save();
    ctx.globalAlpha = easeOutExpo(la);
    ctx.fillStyle = INK;
    const fs = Math.round(H * 0.05);
    ctx.font = `600 ${fs}px "DM Sans", "Manrope", "Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText("Costa Brava", anchor[0], anchor[1]);
    ctx.restore();
  },
};

// Scene 3: coastal city dots with serif labels.
const cityDots: Layer = {
  name: "city-dots",
  start: T.city_dots,
  draw({ ctx, t, H, state }: RenderContext) {
    if (!geo) return;
    const proj = readProjection(state);
    if (!proj) return;
    geo.cities.forEach((city, i) => {
      const tt = t - T.city_dots - i * 120;
      if (tt < 0) return;
      const a = clamp(tt / 400);
      const pt = proj(city.lonLat);
      if (!pt) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 6, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();
      const lt = t - T.labels_start - i * 120;
      if (lt > 0) {
        const la = clamp(lt / 400);
        ctx.globalAlpha = la;
        ctx.fillStyle = INK;
        const fs = Math.round(H * 0.022);
        ctx.font = `400 ${fs}px "Cormorant Garamond", Georgia, serif`;
        ctx.textBaseline = "middle";
        const isRoses = city.name === "Roses";
        const labelDy = city.name === "L'Escala" ? -12 : city.name === "Lloret de Mar" ? 14 : 0;
        if (isRoses) {
          ctx.textAlign = "right";
          ctx.fillText(city.name, pt[0] - 14, pt[1] + labelDy);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(city.name, pt[0] + 14, pt[1] + labelDy);
        }
      }
      ctx.restore();
    });
  },
};

// Scene 3: airport + AVE pictograms, paired and pushed apart so they never
// overlap, with two-line airport labels.
const pictograms: Layer = {
  name: "pictograms",
  start: T.picto_start,
  draw({ ctx, t, H, state }: RenderContext) {
    if (!geo) return;
    const proj = readProjection(state);
    if (!proj) return;
    const r = H * 0.032;
    type Item = {
      anchor: [number, number];
      icon: "plane" | "train";
      title: string;
      delay: number;
      side: "left" | "right";
    };
    const pairs: [Item, Item][] = [
      [
        { anchor: geo.aves[0].lonLat, icon: "train", title: "Girona AVE", delay: 0, side: "left" },
        {
          anchor: geo.airports[0].lonLat,
          icon: "plane",
          title: "Airport Girona–Costa Brava",
          delay: 250,
          side: "left",
        },
      ],
      [
        {
          anchor: geo.aves[1].lonLat,
          icon: "train",
          title: "Barcelona AVE",
          delay: 500,
          side: "left",
        },
        {
          anchor: geo.airports[1].lonLat,
          icon: "plane",
          title: "Airport Barcelona–El Prat",
          delay: 750,
          side: "right",
        },
      ],
    ];
    const minDist = 2 * r + r * 0.08;
    const placements: { it: Item; pos: [number, number] }[] = [];
    pairs.forEach(([a, b]) => {
      const pa = proj(a.anchor);
      const pb = proj(b.anchor);
      if (!pa || !pb) return;
      const mx = (pa[0] + pb[0]) / 2;
      const my = (pa[1] + pb[1]) / 2;
      let dx = pb[0] - pa[0];
      let dy = pb[1] - pa[1];
      let d = Math.hypot(dx, dy);
      if (d < 1e-3) {
        dx = 1;
        dy = 0;
        d = 1;
      }
      const need = Math.max(d, minDist);
      const ux = dx / d;
      const uy = dy / d;
      const half = need / 2;
      const trainPos: [number, number] = [mx - ux * half, my - uy * half];
      const planePos: [number, number] = [mx + ux * half, my + uy * half];
      const trainItem = a.icon === "train" ? a : b;
      const planeItem = a.icon === "plane" ? a : b;
      placements.push({ it: trainItem, pos: trainPos });
      placements.push({ it: planeItem, pos: planePos });
    });
    placements.forEach(({ it, pos }) => {
      const tt = t - T.picto_start - it.delay;
      if (tt < 0) return;
      const a = clamp(tt / 500);
      const [cx, cy] = pos;
      drawPicto(ctx, cx, cy, r * easeOutExpo(a), it.icon, a);
      const lt = t - T.labels_start - 400 - it.delay;
      if (lt > 0) {
        const la = clamp(lt / 500);
        ctx.save();
        ctx.globalAlpha = easeOutExpo(la);
        ctx.fillStyle = INK;
        const fs = Math.round(H * 0.024);
        ctx.font = `500 ${fs}px "Cormorant Garamond", Georgia, serif`;
        ctx.textBaseline = "middle";
        const labelOnLeft = it.side === "left";
        ctx.textAlign = labelOnLeft ? "right" : "left";
        const tx = labelOnLeft ? cx - r - 12 : cx + r + 12;
        if (it.icon === "plane" && it.title.startsWith("Airport ")) {
          const rest = it.title.slice("Airport ".length);
          ctx.fillText("Airport", tx, cy - fs * 0.55);
          ctx.fillText(rest, tx, cy + fs * 0.55);
        } else {
          ctx.fillText(it.title, tx, cy);
        }
        ctx.restore();
      }
    });
  },
};

export const costaBrava: Animation = {
  id: "costa-brava-connections",
  title: "Costa Brava — Connexions",
  width: W,
  height: H,
  duration: DURATION,
  startDelay: START_DELAY,
  background: (ctx, w, h) => {
    ctx.fillStyle = paperGradient(ctx, w, h);
    ctx.fillRect(0, 0, w, h);
  },
  async setup() {
    if (!geo) geo = await loadGeo();
  },
  layers: [basemap, highlight, coastTrace, costaLabel, cityDots, pictograms],
};
