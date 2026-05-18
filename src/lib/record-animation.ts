// ============================================================
// Procedural map animation: Europe → Catalonia → Connections
// ============================================================

const START_DELAY = 800; // ms blank
const DURATION = 13000; // ms total animation length

// Palette
const CREAM = "#f3ecdf";
const PAPER = "#ece3d2";
const LAND = "#e6d4b0";
const LAND_DIM = "#ede1c8";
const HIGHLIGHT = "#c9a877";
const NAVY = "#0a2342";
const BLUE = "#1e5ea8";
const SEA = "#1e5ea8";
const MUTED = "#7a6a55";

// ---------- Easing ----------
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

// ---------- Geography (lon, lat) ----------
type Pt = [number, number];

// Iberian peninsula outline (rough, clockwise from NW)
const IBERIA: Pt[] = [
  [-9.3, 43.8], [-7.7, 43.8], [-5.8, 43.6], [-3.8, 43.5], [-1.8, 43.4],
  [-0.3, 43.3], [1.7, 42.6], [3.3, 42.4],
  // east coast (Costa Brava → Barcelona → Tarragona → Valencia)
  [3.25, 42.15], [3.15, 41.95], [3.0, 41.78], [2.75, 41.65],
  [2.5, 41.55], [2.25, 41.45], [1.9, 41.3], [1.2, 41.1],
  [0.5, 40.7], [0.0, 40.0], [-0.3, 39.4], [-0.5, 38.8],
  [-0.8, 38.1], [-1.6, 37.4], [-2.4, 36.9], [-3.7, 36.75],
  [-4.7, 36.7], [-5.6, 36.0], [-6.5, 37.0], [-7.4, 37.2],
  [-8.9, 37.0], [-9.0, 38.4], [-9.4, 39.4], [-9.2, 41.0],
  [-8.9, 42.0], [-9.3, 43.0], [-9.3, 43.8],
];

// East-coast trace (Costa Brava): subset from Cap de Creus down past Barcelona
const COSTA_BRAVA: Pt[] = [
  [3.3, 42.4], [3.25, 42.15], [3.15, 41.95], [3.0, 41.78],
  [2.75, 41.65], [2.5, 41.55], [2.25, 41.45], [1.9, 41.3],
];

// France rough silhouette
const FRANCE: Pt[] = [
  [-1.5, 43.3], [2.5, 42.6], [7.5, 43.7], [7.6, 47.5],
  [7.2, 49.0], [4.0, 50.8], [2.0, 51.0], [-1.5, 48.7],
  [-4.7, 48.3], [-1.4, 46.0], [-1.5, 43.3],
];

// UK
const UK: Pt[] = [
  [-5, 50.2], [1.5, 51.0], [1.7, 53.0], [-1.8, 55.5],
  [-3.0, 58.5], [-5.5, 58.0], [-5.7, 55.5], [-4.2, 54.0],
  [-5.5, 51.5], [-5, 50.2],
];

// Italy (very rough)
const ITALY: Pt[] = [
  [7.5, 44.5], [10.5, 45.5], [13.5, 46.0], [13.5, 45.5],
  [12.5, 44.2], [14.5, 42.0], [18.5, 40.0], [17.0, 39.0],
  [15.5, 38.0], [14.0, 38.0], [12.5, 38.2], [11.0, 42.5],
  [8.0, 44.0], [7.5, 44.5],
];

// North Africa coastline strip
const AFRICA: Pt[] = [
  [-10, 30], [20, 30], [20, 36.0], [10, 37.0], [0, 36.0],
  [-3, 35.7], [-6, 35.9], [-10, 35.5], [-10, 30],
];

// Cities / pictograms
const MARKERS = {
  girona_airport: { p: [2.76, 41.9] as Pt, label: "Girona–Costa Brava Airport", icon: "plane" },
  girona_ave: { p: [2.83, 41.98] as Pt, label: "Girona AVE", icon: "train" },
  barcelona_airport: { p: [2.08, 41.3] as Pt, label: "Barcelona–El Prat Airport", icon: "plane" },
  barcelona_ave: { p: [2.14, 41.38] as Pt, label: "Barcelona AVE", icon: "train" },
};

// ---------- Camera viewpoints ----------
type View = { lon: number; lat: number; span: number };
const VIEW_EUROPE: View = { lon: 3, lat: 48, span: 42 };
const VIEW_IBERIA: View = { lon: -1.5, lat: 40, span: 22 };
const VIEW_CATALONIA: View = { lon: 2.0, lat: 41.7, span: 4.5 };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function lerpView(a: View, b: View, t: number): View {
  const e = easeInOut(t);
  // log-interp the span for natural zoom
  const span = Math.exp(lerp(Math.log(a.span), Math.log(b.span), e));
  return { lon: lerp(a.lon, b.lon, e), lat: lerp(a.lat, b.lat, e), span };
}

function project(lon: number, lat: number, view: View, W: number, H: number) {
  const scale = W / view.span;
  const x = W / 2 + (lon - view.lon) * scale;
  const y = H / 2 - (lat - view.lat) * scale;
  return { x, y, scale };
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  view: View,
  W: number,
  H: number,
  fill: string,
  stroke?: string,
  strokeW?: number,
) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const { x, y } = project(p[0], p[1], view, W, H);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeW ?? 1;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

// Draw partial polyline (for coast tracing)
function drawPartialPath(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  view: View,
  W: number,
  H: number,
  progress: number,
  color: string,
  width: number,
) {
  if (progress <= 0) return;
  // Compute cumulative lengths in screen px
  const screenPts = pts.map((p) => project(p[0], p[1], view, W, H));
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < screenPts.length; i++) {
    const dx = screenPts[i].x - screenPts[i - 1].x;
    const dy = screenPts[i].y - screenPts[i - 1].y;
    const l = Math.hypot(dx, dy);
    segLens.push(l);
    total += l;
  }
  const target = total * Math.min(1, progress);
  ctx.beginPath();
  ctx.moveTo(screenPts[0].x, screenPts[0].y);
  let acc = 0;
  for (let i = 1; i < screenPts.length; i++) {
    const seg = segLens[i - 1];
    if (acc + seg <= target) {
      ctx.lineTo(screenPts[i].x, screenPts[i].y);
      acc += seg;
    } else {
      const remain = target - acc;
      const k = remain / seg;
      const x = screenPts[i - 1].x + (screenPts[i].x - screenPts[i - 1].x) * k;
      const y = screenPts[i - 1].y + (screenPts[i].y - screenPts[i - 1].y) * k;
      ctx.lineTo(x, y);
      break;
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

// Wave decorations in sea
function drawWaves(
  ctx: CanvasRenderingContext2D,
  view: View,
  W: number,
  H: number,
  alpha: number,
) {
  const positions: Pt[] = [
    [5.5, 41.5], [4.5, 40.0], [5.8, 39.0], [4.2, 38.0],
    [-1.5, 36.0], [-2.5, 35.0], [10, 40], [11, 41.5], [9, 38.5],
    [3.8, 42.0], [4.5, 42.7],
  ];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = SEA;
  const lineW = Math.max(1, (W / view.span) * 0.015);
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  for (const p of positions) {
    const { x, y, scale } = project(p[0], p[1], view, W, H);
    const w = scale * 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w * 0.25, y - w * 0.2, x + w * 0.5, y);
    ctx.quadraticCurveTo(x + w * 0.75, y + w * 0.2, x + w, y);
    ctx.stroke();
  }
  ctx.restore();
}

// Pictogram circle with icon
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
  // Circle
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.stroke();

  ctx.fillStyle = NAVY;
  ctx.strokeStyle = NAVY;
  if (icon === "plane") {
    // simple plane shape
    const s = r * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.9, cy);
    ctx.lineTo(cx + s * 0.4, cy - s * 0.15);
    ctx.lineTo(cx + s * 0.9, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.05);
    ctx.lineTo(cx + s * 0.9, cy + s * 0.05);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.55);
    ctx.lineTo(cx - s * 0.1, cy + s * 0.15);
    ctx.lineTo(cx - s * 0.9, cy);
    ctx.closePath();
    ctx.fill();
  } else {
    // train: rounded rectangle with two windows and wheels
    const w = r * 1.1, h = r * 0.9;
    const x = cx - w / 2, y = cy - h / 2;
    const rad = r * 0.18;
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
    ctx.fill();
    // windows
    ctx.fillStyle = CREAM;
    const ww = w * 0.28, wh = h * 0.32;
    ctx.fillRect(x + w * 0.12, y + h * 0.18, ww, wh);
    ctx.fillRect(x + w * 0.6, y + h * 0.18, ww, wh);
  }
  ctx.restore();
}

// ---------- Timeline ----------
// All times are absolute (ms from animation start, AFTER START_DELAY subtracted)
const T = {
  scene1_in: 0,        // Europe appears
  scene1_pin: 1000,    // pulsing pin on NE Spain
  zoom1to2_start: 2200,
  zoom1to2_end: 3400,
  costa_trace_start: 4000,
  costa_trace_end: 5400,
  costa_label: 5400,
  zoom2to3_start: 6400,
  zoom2to3_end: 7600,
  picto_appear: 8000,  // pictograms
  picto_labels: 9000,  // labels next to them
  end: 12000,
};

function getView(t: number): View {
  if (t < T.zoom1to2_start) return VIEW_EUROPE;
  if (t < T.zoom1to2_end) {
    const p = (t - T.zoom1to2_start) / (T.zoom1to2_end - T.zoom1to2_start);
    return lerpView(VIEW_EUROPE, VIEW_IBERIA, p);
  }
  if (t < T.zoom2to3_start) return VIEW_IBERIA;
  if (t < T.zoom2to3_end) {
    const p = (t - T.zoom2to3_start) / (T.zoom2to3_end - T.zoom2to3_start);
    return lerpView(VIEW_IBERIA, VIEW_CATALONIA, p);
  }
  return VIEW_CATALONIA;
}

// ---------- Description text segments ----------
const TEXT_SEGMENTS: { t: number; text: string }[] = [
  { t: 500, text: "It offers excellent transport connections." },
  { t: 4200, text: "Girona–Costa Brava Airport is around 40 km from the main coastal towns." },
  { t: 8200, text: "Barcelona–El Prat Airport is approximately 120 km away." },
  { t: 10200, text: "The destination is also connected to the high-speed AVE rail network." },
];

// ---------- Main draw ----------
function drawFrame(
  ctx: CanvasRenderingContext2D,
  tRaw: number,
  W: number,
  H: number,
) {
  // Background
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);

  const t = tRaw - START_DELAY;
  if (t < 0) return;

  const view = getView(t);

  // Land fade-in at scene1 start
  const sceneFade = Math.min(1, t / 500);
  ctx.save();
  ctx.globalAlpha = sceneFade;

  // ----- Distant continents (only useful when far out) -----
  const lonSpan = view.span;
  const farAlpha = Math.max(0, Math.min(1, (lonSpan - 15) / 25));
  if (farAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= farAlpha;
    drawShape(ctx, FRANCE, view, W, H, LAND_DIM, NAVY, 1);
    drawShape(ctx, UK, view, W, H, LAND_DIM, NAVY, 1);
    drawShape(ctx, ITALY, view, W, H, LAND_DIM, NAVY, 1);
    drawShape(ctx, AFRICA, view, W, H, LAND_DIM, NAVY, 1);
    ctx.restore();
  }

  // ----- Iberia (main) -----
  // Highlight Catalonia subtly when zoomed in
  drawShape(ctx, IBERIA, view, W, H, LAND, NAVY, Math.max(0.8, W / 2400));

  // Waves in sea
  drawWaves(ctx, view, W, H, Math.min(1, sceneFade) * 0.9);

  ctx.restore();

  // ----- Scene 1: pulsing pin on NE Spain -----
  if (t < T.zoom1to2_start + 200) {
    const pinT = (t - T.scene1_pin) / 600;
    const appear = Math.max(0, Math.min(1, pinT));
    const pulse = 0.5 + 0.5 * Math.sin((t - T.scene1_pin) / 400);
    if (appear > 0) {
      const { x, y } = project(2.0, 41.8, view, W, H);
      const r = (W * 0.012) * (1 + 0.3 * pulse);
      ctx.save();
      ctx.globalAlpha = appear * 0.35;
      ctx.fillStyle = HIGHLIGHT;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = appear;
      ctx.fillStyle = HIGHLIGHT;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = NAVY;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ----- Scene 2: trace Costa Brava + label -----
  if (t >= T.costa_trace_start && t < T.zoom2to3_start + 400) {
    const p = (t - T.costa_trace_start) / (T.costa_trace_end - T.costa_trace_start);
    const prog = Math.max(0, Math.min(1, p));
    drawPartialPath(
      ctx, COSTA_BRAVA, view, W, H,
      easeOut(prog),
      BLUE,
      Math.max(2, (W / view.span) * 0.05),
    );
    // Costa Brava label
    if (t >= T.costa_label) {
      const la = Math.min(1, (t - T.costa_label) / 600);
      const { x, y } = project(3.6, 41.9, view, W, H);
      ctx.save();
      ctx.globalAlpha = easeOutExpo(la);
      ctx.fillStyle = BLUE;
      const fs = Math.round(H * 0.038);
      ctx.font = `italic 600 ${fs}px "Gentona", "Mulish", "Inter", Georgia, serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText("Costa", x, y - fs * 0.55);
      ctx.fillText("Brava", x, y + fs * 0.55);
      ctx.restore();
    }
  }

  // ----- Scene 3: pictograms + labels -----
  if (t >= T.picto_appear) {
    const items = [
      { key: "girona_airport", delay: 0, labelSide: "right" as const, labelOffset: [0.35, 0] },
      { key: "girona_ave", delay: 250, labelSide: "right" as const, labelOffset: [0.35, 0.5] },
      { key: "barcelona_airport", delay: 500, labelSide: "right" as const, labelOffset: [0.35, 0] },
      { key: "barcelona_ave", delay: 750, labelSide: "right" as const, labelOffset: [0.35, 0.5] },
    ];
    for (const it of items) {
      const m = MARKERS[it.key as keyof typeof MARKERS];
      const tt = t - T.picto_appear - it.delay;
      if (tt <= 0) continue;
      const ap = Math.min(1, tt / 500);
      const { x, y } = project(m.p[0], m.p[1], view, W, H);
      const r = W * 0.022;
      drawPicto(ctx, x, y, r * easeOutExpo(ap), m.icon as "plane" | "train", ap);

      // label
      const lt = t - T.picto_labels - it.delay;
      if (lt > 0) {
        const lp = Math.min(1, lt / 500);
        ctx.save();
        ctx.globalAlpha = easeOutExpo(lp);
        ctx.fillStyle = NAVY;
        const fs = Math.round(H * 0.022);
        ctx.font = `600 ${fs}px "Gentona", "Mulish", "Inter", Arial, sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(m.label, x + r * 1.4, y + r * it.labelOffset[1]);
        ctx.restore();
      }
    }
  }

  // ----- Description text bottom -----
  {
    const fs = Math.round(H * 0.024);
    ctx.font = `500 ${fs}px "Gentona", "Mulish", "Inter", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // bg strip
    const stripH = H * 0.12;
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(0, H - stripH, W, stripH);
    ctx.restore();

    // find current segment
    let current = TEXT_SEGMENTS[0];
    for (const s of TEXT_SEGMENTS) if (t >= s.t) current = s;
    const idx = TEXT_SEGMENTS.indexOf(current);
    const next = TEXT_SEGMENTS[idx + 1];
    const segEnd = next ? next.t : T.end;
    const inP = Math.min(1, (t - current.t) / 400);
    const outP = next ? Math.min(1, Math.max(0, (t - (segEnd - 400)) / 400)) : 0;
    const alpha = easeOutExpo(inP) * (1 - outP);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = NAVY;
    ctx.fillText(current.text, W / 2, H - stripH / 2);
    ctx.restore();
  }
}

// ============================================================
// Recording (unchanged structure)
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
    throw new Error("Aquest navegador no suporta exportació MP4 estable. Prova Chrome o Edge actualitzat.");
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

// Exported for the live preview component
export { drawFrame, DURATION, START_DELAY };
