import { geoMercator, geoPath } from "d3-geo";
import type { GeoProjection } from "d3-geo";
import { loadGeo, type Geo } from "./geo-data";

// ============================================================
// Animation: Europe → Catalonia → Connections (real geo data)
// ============================================================

const START_DELAY = 800;
const DURATION = 14000;

// Palette inspired by the reference (cream paper, tan land, blue accents)
const CREAM = "#f3ecdf";
const LAND = "#ece1c8";
const LAND_DARK = "#dccdaa";
const LAND_HIGHLIGHT = "#d4c19a";
const OUTLINE = "#b8a98a";
const OUTLINE_FAINT = "#cabb9a";
const NAVY = "#0e3d8f";
const BLUE = "#1f64c0";
const BLUE_LIGHT = "#4f8fd9";
const INK = "#0d3a86";
const MUTED = "#6c5d44";

// Bbox per scene [[minLon, minLat], [maxLon, maxLat]]
const SCENE_BBOX: [[number, number], [number, number]][] = [
  [
    [-11, 36],
    [12, 52],
  ], // Western Europe (Iberia + France + UK south)
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
  scene1_in: 0,
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
  end: 13500,
};

// ---------- Easing ----------
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

// Build a projection sized to fit a bbox into canvas.
// Use a LineString instead of a Polygon: d3-geo treats spherical polygon winding
// specially, and a bbox polygon can be interpreted as the rest of the globe.
function projForBbox(bbox: [[number, number], [number, number]], W: number, H: number, pad = 60) {
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

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Interpolate bbox geographically so the camera always moves straight to the
// target region (no curved drift from lerping projected pixel translates while
// scale changes non-linearly).
function lerpBbox(
  a: [[number, number], [number, number]],
  b: [[number, number], [number, number]],
  p: number,
): [[number, number], [number, number]] {
  return [
    [lerp(a[0][0], b[0][0], p), lerp(a[0][1], b[0][1], p)],
    [lerp(a[1][0], b[1][0], p), lerp(a[1][1], b[1][1], p)],
  ];
}

function getProjection(t: number, W: number, H: number): GeoProjection {
  const pads = [80, 100, 120];
  let bbox: [[number, number], [number, number]];
  let pad: number;

  if (t < T.zoom1to2_start) {
    bbox = SCENE_BBOX[0];
    pad = pads[0];
  } else if (t < T.zoom1to2_end) {
    const p = easeInOut(clamp((t - T.zoom1to2_start) / (T.zoom1to2_end - T.zoom1to2_start)));
    bbox = lerpBbox(SCENE_BBOX[0], SCENE_BBOX[1], p);
    pad = lerp(pads[0], pads[1], p);
  } else if (t < T.zoom2to3_start) {
    bbox = SCENE_BBOX[1];
    pad = pads[1];
  } else if (t < T.zoom2to3_end) {
    const p = easeInOut(clamp((t - T.zoom2to3_start) / (T.zoom2to3_end - T.zoom2to3_start)));
    bbox = lerpBbox(SCENE_BBOX[1], SCENE_BBOX[2], p);
    pad = lerp(pads[1], pads[2], p);
  } else {
    bbox = SCENE_BBOX[2];
    pad = pads[2];
  }
  const { scale, translate } = projForBbox(bbox, W, H, pad);
  return geoMercator().scale(scale).translate(translate);
}

// ---------- Decorative sea waves ----------
const WAVE_POSITIONS: [number, number][] = [
  [5.5, 41.6], [5.0, 40.5], [4.8, 39.5], [5.5, 38.5], [4.0, 37.5],
  [-3.5, 35.5], [-1.5, 35.5], [10.5, 41.0], [11.0, 39.5], [13, 40.5],
  [3.6, 42.7], [4.2, 42.3], [3.8, 41.4], [3.2, 40.8],
];

function drawWaves(
  ctx: CanvasRenderingContext2D,
  proj: GeoProjection,
  scale: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = BLUE_LIGHT;
  const baseW = Math.max(8, scale * 0.012);
  ctx.lineWidth = Math.max(1.5, baseW * 0.18);
  ctx.lineCap = "round";
  for (const [lon, lat] of WAVE_POSITIONS) {
    const p = proj([lon, lat]);
    if (!p) continue;
    const [x, y] = p;
    const w = baseW * 6;
    const h = baseW * 1.2;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ox = -w / 2;
      const oy = i * h * 1.1 - h * 1.1;
      ctx.moveTo(x + ox, y + oy);
      ctx.quadraticCurveTo(x + ox + w * 0.25, y + oy - h * 0.5, x + ox + w * 0.5, y + oy);
      ctx.quadraticCurveTo(x + ox + w * 0.75, y + oy + h * 0.5, x + ox + w, y + oy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Pictograms
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
    ctx.rotate(-Math.PI / 6);
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
    const w = r * 1.0, h = r * 1.05;
    const x = cx - w / 2, y = cy - h / 2;
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
    // windows
    ctx.fillStyle = "#ffffff";
    const ww = w * 0.3, wh = h * 0.28;
    ctx.fillRect(x + w * 0.1, y + h * 0.16, ww, wh);
    ctx.fillRect(x + w * 0.6, y + h * 0.16, ww, wh);
    // wheels
    ctx.fillStyle = BLUE;
    ctx.beginPath();
    ctx.arc(x + w * 0.22, y + h * 0.95, r * 0.13, 0, Math.PI * 2);
    ctx.arc(x + w * 0.78, y + h * 0.95, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Mountain icon (Pyrenees indicator)
function drawMountain(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#a8967a";
  ctx.strokeStyle = "#6e5e44";
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s * 0.3, y - s * 0.9);
  ctx.lineTo(x + s * 0.1, y - s * 0.4);
  ctx.lineTo(x + s * 0.4, y - s * 0.95);
  ctx.lineTo(x + s, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------- Main draw ----------
let geoCache: Geo | null = null;

export function setGeo(g: Geo) {
  geoCache = g;
}

export function drawFrame(ctx: CanvasRenderingContext2D, tRaw: number, W: number, H: number) {
  // Background paper
  const grad = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.7);
  grad.addColorStop(0, "#f7f1e4");
  grad.addColorStop(1, CREAM);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  if (!geoCache) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 ${Math.round(H * 0.025)}px "Mulish", "Inter", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Carregant mapa…", W / 2, H / 2);
    return;
  }

  const t = tRaw - START_DELAY;
  if (t < 0) return;

  const proj = getProjection(t, W, H);
  const path = geoPath(proj, ctx);
  const scaleNow = proj.scale();
  const fadeIn = clamp(t / 600);

  ctx.save();
  ctx.globalAlpha = fadeIn;

  // ---- Country fills + strokes ----
  // Use hairlines and avoid stroking layers that overlap (the coast was
  // drawn 3× before: world + Spain provinces + Catalonia provinces).
  const strokeWorld = scaleNow < 800;
  const strokeSpain = scaleNow >= 800 && scaleNow < 2000;
  const strokeCatalonia = scaleNow >= 800;

  ctx.fillStyle = LAND;
  ctx.strokeStyle = OUTLINE_FAINT;
  ctx.lineWidth = 0.5;
  // At higher zoom, skip the world-atlas Spain polygon — its coastline is at
  // a coarser resolution than spainProvinces and shows as a light-brown sliver
  // along the coast. The spainProvinces layer below fills Spain consistently.
  const skipSpainWorld = scaleNow >= 800;
  for (const f of geoCache.worldCountries.features) {
    if (skipSpainWorld && (f.properties as { name?: string })?.name === "Spain") continue;
    ctx.beginPath();
    path(f);
    ctx.fill();
    if (strokeWorld) ctx.stroke();
  }

  // ---- Spain provinces: fill (so Catalonia sits on the SAME geo source and
  // edges align), and only stroke at mid zoom. Without this we used to see a
  // light-brown sliver from world-atlas Spain peeking beyond Catalonia's
  // higher-resolution boundary.
  if (scaleNow >= 800) {
    ctx.save();
    ctx.fillStyle = LAND;
    for (const f of geoCache.spainProvinces.features) {
      ctx.beginPath();
      path(f);
      ctx.fill();
    }
    if (strokeSpain) {
      const alpha = clamp((scaleNow - 800) / 600);
      ctx.globalAlpha *= alpha * 0.6;
      ctx.strokeStyle = OUTLINE_FAINT;
      ctx.lineWidth = 0.5;
      for (const f of geoCache.spainProvinces.features) {
        ctx.beginPath();
        path(f);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- Catalonia highlight (fill always; stroke only when close) ----
  ctx.fillStyle = LAND_DARK;
  for (const f of geoCache.cataloniaProvinces) {
    ctx.beginPath();
    path(f);
    ctx.fill();
  }

  // At high zoom, redraw the world countries (skipping Spain) ON TOP of
  // Catalonia. This covers any Catalonia overflow north of the France border.
  // Additionally STROKE with LAND to expand the France polygon outward by a
  // few px — this closes the white seam between Catalonia (dark) and France
  // (light) caused by the two datasets having different boundary resolutions.
  if (scaleNow >= 800) {
    ctx.save();
    ctx.fillStyle = LAND;
    ctx.strokeStyle = LAND;
    ctx.lineWidth = Math.max(2, scaleNow * 0.004);
    ctx.lineJoin = "round";
    for (const f of geoCache.worldCountries.features) {
      if ((f.properties as { name?: string })?.name === "Spain") continue;
      ctx.beginPath();
      path(f);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (strokeCatalonia) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 0.6;
    for (const f of geoCache.cataloniaProvinces) {
      ctx.beginPath();
      path(f);
      ctx.stroke();
    }
  }

  ctx.restore();

  // ---- Sea waves removed ----

  // ---- Scene 1: blue circle around Catalonia ----
  if (t < T.zoom1to2_start + 200) {
    const p = clamp((t - T.highlight_in) / 700);
    if (p > 0) {
      const e = easeOutExpo(p);
      const center = proj([1.7, 41.7]);
      if (center) {
        const r = scaleNow * 0.05 * (0.9 + 0.1 * Math.sin(t / 250));
        ctx.save();
        ctx.globalAlpha = e * 0.95;
        ctx.strokeStyle = NAVY;
        ctx.lineWidth = Math.max(2, scaleNow * 0.0015);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(center[0], center[1], r, 0, Math.PI * 2 * e);
        ctx.stroke();
        // dotted leader line toward small label
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = Math.max(1, scaleNow * 0.0008);
        ctx.beginPath();
        ctx.moveTo(center[0] + r * 1.05, center[1]);
        ctx.lineTo(center[0] + r * 1.6, center[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  // ---- Pyrenees mountain icons removed ----

  // ---- Costa Brava coast trace (stays visible through the final scene) ----
  if (t >= T.coast_start) {
    const prog = clamp((t - T.coast_start) / (T.coast_end - T.coast_start));
    const pts = geoCache.costaBravaCoast.map((p) => proj(p)).filter(Boolean) as [number, number][];
    // Compute lengths
    const lens: number[] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l);
      total += l;
    }
    const target = total * easeOut(prog);
    ctx.save();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = Math.max(0.8, Math.min(scaleNow * 0.0004, H * 0.0022));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      if (acc + lens[i - 1] <= target) {
        ctx.lineTo(pts[i][0], pts[i][1]);
        acc += lens[i - 1];
      } else {
        const k = (target - acc) / lens[i - 1];
        ctx.lineTo(
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k,
        );
        break;
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- "Costa Brava" label ----
  if (t >= T.costa_label && t < T.zoom2to3_start + 200) {
    const la = clamp((t - T.costa_label) / 700);
    const anchor = proj([3.75, 41.78]) ?? proj([3.6, 41.8]);
    if (anchor) {
      ctx.save();
      ctx.globalAlpha = easeOutExpo(la);
      ctx.fillStyle = INK;
      const fs = Math.round(H * 0.05);
      ctx.font = `400 ${fs}px "Cormorant Garamond", "Cormorant", Georgia, serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("Costa", anchor[0], anchor[1] - fs * 0.55);
      ctx.fillText("Brava", anchor[0], anchor[1] + fs * 0.55);
      ctx.restore();
    }
  }

  // ---- Scene 3 city dots ----
  if (t >= T.city_dots) {
    geoCache.cities.forEach((city, i) => {
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
      // label
      const lt = t - T.labels_start - i * 120;
      if (lt > 0) {
        const la = clamp(lt / 400);
        ctx.globalAlpha = la;
        ctx.fillStyle = INK;
        const fs = Math.round(H * 0.022);
        ctx.font = `400 ${fs}px "Cormorant Garamond", Georgia, serif`;
        ctx.textBaseline = "middle";
        // Place labels at SEA (to the right of the dot, beyond the blue
        // coastline). Exception: Roses sits at the top corner where there is
        // no sea room to the right — keep it inland (to the left).
        const isRoses = city.name === "Roses";
        if (isRoses) {
          ctx.textAlign = "right";
          ctx.fillText(city.name, pt[0] - 14, pt[1]);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(city.name, pt[0] + 14, pt[1]);
        }
      }
      ctx.restore();
    });
  }

  // ---- Scene 3 pictograms (airports + AVE) ----
  if (t >= T.picto_start) {
    const items: {
      lonLat: [number, number];
      icon: "plane" | "train";
      title: string;
      sub?: string;
      delay: number;
    }[] = [
      { lonLat: geoCache.aves[0].lonLat, icon: "train", title: "Girona AVE", sub: "Girona", delay: 0 },
      {
        lonLat: geoCache.airports[0].lonLat,
        icon: "plane",
        title: "Girona–Costa Brava",
        sub: "Airport",
        delay: 250,
      },
      {
        lonLat: geoCache.aves[1].lonLat,
        icon: "train",
        title: "Barcelona AVE",
        sub: "Barcelona",
        delay: 500,
      },
      {
        lonLat: geoCache.airports[1].lonLat,
        icon: "plane",
        title: "Barcelona–El Prat",
        sub: "Airport",
        delay: 750,
      },
    ];
    // Pictogram offsets (in screen px) to avoid covering coast
    const offsets: [number, number][] = [
      [-110, -40],
      [-110, 50],
      [-110, -40],
      [-110, 50],
    ];
    items.forEach((it, i) => {
      const tt = t - T.picto_start - it.delay;
      if (tt < 0) return;
      const a = clamp(tt / 500);
      const cityPt = proj(it.lonLat);
      if (!cityPt) return;
      const [cx, cy] = [cityPt[0] + offsets[i][0], cityPt[1] + offsets[i][1]];
      const r = H * 0.032;
      drawPicto(ctx, cx, cy, r * easeOutExpo(a), it.icon, a);
      // Labels appear with second wave
      const lt = t - T.labels_start - 400 - it.delay;
      if (lt > 0) {
        const la = clamp(lt / 500);
        ctx.save();
        ctx.globalAlpha = easeOutExpo(la);
        ctx.fillStyle = INK;
        const fs = Math.round(H * 0.024);
        ctx.font = `500 ${fs}px "Cormorant Garamond", Georgia, serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(it.title, cx + r + 12, cy - fs * 0.55);
        if (it.sub) {
          ctx.fillStyle = "#000000";
          ctx.font = `400 ${fs}px "Cormorant Garamond", Georgia, serif`;
          ctx.fillText(it.sub, cx + r + 12, cy + fs * 0.55);
        }
        ctx.restore();
      }
    });
  }
}

// ============================================================
// Recording
// ============================================================

export type RecordFormat = "webm" | "mp4";

type VideoFrameLike = { close: () => void };
type VideoFrameConstructorLike = new (
  source: HTMLCanvasElement,
  init: { timestamp: number; duration?: number },
) => VideoFrameLike;
type VideoEncoderLike = {
  configure: (config: VideoEncoderConfig) => void;
  encode: (frame: VideoFrameLike, options?: { keyFrame?: boolean }) => void;
  flush: () => Promise<void>;
  close: () => void;
};
type VideoEncoderConstructorLike = {
  new (init: {
    output: (chunk: unknown, meta?: unknown) => void;
    error: (error: unknown) => void;
  }): VideoEncoderLike;
  isConfigSupported?: (config: VideoEncoderConfig) => Promise<VideoEncoderSupport>;
};

function downloadBlob(blob: Blob, extension: RecordFormat) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `costa-brava-connections.${extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function getSupportedMp4Config(
  VideoEncoderCtor: VideoEncoderConstructorLike,
  W: number,
  H: number,
  FPS: number,
): Promise<VideoEncoderConfig> {
  const baseConfig: Omit<VideoEncoderConfig, "codec"> = {
    width: W,
    height: H,
    bitrate: 40_000_000,
    framerate: FPS,
    latencyMode: "quality",
    avc: { format: "avc" },
  };
  const configs: VideoEncoderConfig[] = [
    { ...baseConfig, codec: "avc1.640034" },
    { ...baseConfig, codec: "avc1.640033" },
    { ...baseConfig, codec: "avc1.4D4034" },
    { ...baseConfig, codec: "avc1.420034" },
    { ...baseConfig, codec: "avc1.42E034" },
  ];
  if (!VideoEncoderCtor.isConfigSupported) return configs[0];
  for (const config of configs) {
    const support = await VideoEncoderCtor.isConfigSupported(config);
    if (support.supported) return support.config ?? config;
  }
  throw new Error("Aquest navegador no pot codificar MP4/H.264 a aquesta resolució.");
}

async function recordMp4WithWebCodecs(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  onProgress?: (p: number) => void,
) {
  const globals = globalThis as typeof globalThis & {
    VideoEncoder?: VideoEncoderConstructorLike;
    VideoFrame?: VideoFrameConstructorLike;
  };
  const VideoEncoderCtor = globals.VideoEncoder;
  const VideoFrameCtor = globals.VideoFrame;
  if (!VideoEncoderCtor || !VideoFrameCtor) {
    throw new Error("Aquest navegador no suporta exportació MP4. Prova Chrome o Edge actualitzat.");
  }
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const FPS = 30;
  const totalFrames = Math.round((DURATION / 1000) * FPS);
  const frameDurationUs = Math.round(1_000_000 / FPS);
  const totalDurationUs = DURATION * 1000;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: W, height: H, frameRate: FPS },
    fastStart: { expectedVideoChunks: totalFrames },
  });
  const muxerWriter = muxer as unknown as {
    addVideoChunk: (chunk: unknown, meta?: unknown) => void;
    finalize: () => void;
  };
  let encoderError: unknown = null;
  const encoder = new VideoEncoderCtor({
    output: (chunk, meta) => muxerWriter.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error;
    },
  });
  encoder.configure(await getSupportedMp4Config(VideoEncoderCtor, W, H, FPS));
  for (let f = 0; f < totalFrames; f++) {
    const timestamp = f * frameDurationUs;
    const duration = f === totalFrames - 1 ? totalDurationUs - timestamp : frameDurationUs;
    drawFrame(ctx, (f / FPS) * 1000, W, H);
    const frame = new VideoFrameCtor(ctx.canvas, { timestamp, duration });
    encoder.encode(frame, { keyFrame: f % FPS === 0 });
    frame.close();
    onProgress?.(Math.min(0.95, (f + 1) / totalFrames));
    await new Promise((r) => setTimeout(r, 0));
    if (encoderError) throw encoderError;
  }
  await encoder.flush();
  if (encoderError) throw encoderError;
  encoder.close();
  muxerWriter.finalize();
  onProgress?.(1);
  downloadBlob(new Blob([target.buffer], { type: "video/mp4" }), "mp4");
}

export async function recordAnimation(
  onProgress?: (p: number) => void,
  format: RecordFormat = "webm",
): Promise<void> {
  if (!geoCache) {
    const g = await loadGeo();
    setGeo(g);
  }
  const W = 3840;
  const H = 2160;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  if (format === "mp4") {
    await recordMp4WithWebCodecs(ctx, W, H, onProgress);
    return;
  }

  const webmCandidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mimeType =
    webmCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

  const FPS = 30;
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 40_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
  recorder.start(100);
  const totalFrames = Math.round((DURATION / 1000) * FPS);
  for (let f = 0; f <= totalFrames; f++) {
    const t = (f / FPS) * 1000;
    drawFrame(ctx, t, W, H);
    track.requestFrame();
    onProgress?.(Math.min(1, t / DURATION));
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }
  await new Promise((r) => setTimeout(r, 500));
  recorder.stop();
  const blob = await done;
  downloadBlob(blob, "webm");
}

export { DURATION, START_DELAY };
