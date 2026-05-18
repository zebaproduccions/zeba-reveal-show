import familyImgSrc from "@/assets/family-illustration.png";

const START_DELAY = 1000; // ms — pantalla en blanc inicial
const DURATION = 7000; // ms total

const NAVY = "#0a2342";
const TEAL = "#5cb8b2";
const MUTED = "#737373";

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

type Stat = { value: string; unit: string; label: string };
const stats: Stat[] = [
  { value: "19", unit: "setmanes", label: "per progenitor" },
  { value: "32", unit: "setmanes", label: "en famílies monoparentals" },
  { value: "100%", unit: "", label: "de la base reguladora" },
];

function drawFrame(
  ctx: CanvasRenderingContext2D,
  tRaw: number,
  family: HTMLImageElement,
  W: number,
  H: number,
) {
  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const t = tRaw - START_DELAY;
  if (t < 0) return;

  // Layout
  const leftX = W * 0.08;
  const rightX = W * 0.55;
  const rightCenterX = rightX + (W - rightX - W * 0.08) / 2;
  const centerY = H / 2;

  // ===== Family illustration (right): fades in early =====
  {
    const p = Math.max(0, Math.min(1, t / 1200));
    const e = easeOutExpo(p);
    const targetW = (W - rightX - W * 0.08) * 0.95;
    const imgW = targetW;
    const imgH = (imgW / family.width) * family.height;
    const maxH = H * 0.78;
    const scale = imgH > maxH ? maxH / imgH : 1;
    const dw = imgW * scale;
    const dh = imgH * scale;

    // Soft teal blob behind
    ctx.save();
    ctx.globalAlpha = 0.18 * e;
    ctx.fillStyle = TEAL;
    ctx.filter = `blur(${Math.round(H * 0.04)}px)`;
    ctx.beginPath();
    ctx.ellipse(rightCenterX, centerY, dw * 0.42, dh * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = e;
    const yOffset = 20 * (1 - e);
    ctx.drawImage(family, rightCenterX - dw / 2, centerY - dh / 2 + yOffset, dw, dh);
    ctx.restore();
  }

  // ===== Kicker (eyebrow) =====
  ctx.textBaseline = "alphabetic";
  {
    const start = 1000;
    const p = Math.max(0, Math.min(1, (t - start) / 800));
    const e = easeOutExpo(p);
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha = e;
      ctx.fillStyle = TEAL;
      const fs = Math.round(H * 0.018);
      ctx.font = `600 ${fs}px "Gentona", "Mulish", "Inter", Arial, sans-serif`;
      ctx.textAlign = "left";
      const text = "NOVETATS LABORALS · ESPANYA";
      // letter-spacing emulate
      let x = leftX;
      const y = H * 0.18 + 10 * (1 - e);
      const spacing = fs * 0.18;
      for (const ch of text) {
        ctx.fillText(ch, x, y);
        x += ctx.measureText(ch).width + spacing;
      }
      ctx.restore();
    }
  }

  // ===== Title =====
  {
    const start = 1150;
    const p = Math.max(0, Math.min(1, (t - start) / 1000));
    const e = easeOutExpo(p);
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha = e;
      ctx.fillStyle = NAVY;
      const fs = Math.round(H * 0.072);
      ctx.font = `700 ${fs}px "Gentona", "Mulish", "Inter", Arial, sans-serif`;
      ctx.textAlign = "left";
      const y1 = H * 0.265 + 18 * (1 - e);
      const lineH = fs * 1.05;
      ctx.fillText("Permís per naixement", leftX, y1);
      ctx.fillText("i cura del menor", leftX, y1 + lineH);
      ctx.restore();
    }
  }

  // ===== Teal underline =====
  {
    const start = 1900;
    const p = Math.max(0, Math.min(1, (t - start) / 700));
    const e = easeOutExpo(p);
    if (p > 0) {
      ctx.save();
      ctx.fillStyle = TEAL;
      const w = W * 0.09 * e;
      const h = Math.max(3, Math.round(H * 0.004));
      ctx.fillRect(leftX, H * 0.46, w, h);
      ctx.restore();
    }
  }

  // ===== Stats =====
  {
    const baseY = H * 0.56;
    const rowH = H * 0.085;
    const valueFs = Math.round(H * 0.062);
    const unitFs = Math.round(H * 0.03);
    const labelFs = Math.round(H * 0.022);

    stats.forEach((s, i) => {
      const start = 2400 + i * 350;
      const p = Math.max(0, Math.min(1, (t - start) / 700));
      const e = easeOutExpo(p);
      if (p <= 0) return;

      const xOffset = -30 * (1 - e);
      const y = baseY + i * rowH;

      ctx.save();
      ctx.globalAlpha = e;

      // Animated number
      const numeric = parseInt(s.value.replace(/\D/g, ""), 10);
      const suffix = s.value.replace(/[0-9]/g, "");
      const np = Math.max(0, Math.min(1, (t - start) / 900));
      const ne = easeOutCubic(np);
      const displayVal = Math.round(numeric * ne) + suffix;

      ctx.fillStyle = NAVY;
      ctx.font = `700 ${valueFs}px "Gentona", "Mulish", "Inter", Arial, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const valX = leftX + xOffset;
      ctx.fillText(displayVal, valX, y);
      const valW = ctx.measureText(displayVal).width;

      let cursorX = valX + valW + valueFs * 0.25;

      if (s.unit) {
        ctx.font = `600 ${unitFs}px "Gentona", "Mulish", "Inter", Arial, sans-serif`;
        ctx.fillStyle = NAVY;
        ctx.fillText(s.unit, cursorX, y);
        cursorX += ctx.measureText(s.unit).width + unitFs * 0.5;
      }

      ctx.font = `400 ${labelFs}px "Gentona", "Mulish", "Inter", Arial, sans-serif`;
      ctx.fillStyle = MUTED;
      ctx.fillText(s.label, cursorX, y);

      ctx.restore();
    });
  }

  // ===== Footer note =====
  {
    const start = 4200;
    const p = Math.max(0, Math.min(1, (t - start) / 700));
    const e = easeOutExpo(p);
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha = e;
      ctx.fillStyle = MUTED;
      const fs = Math.round(H * 0.016);
      ctx.font = `400 ${fs}px "Gentona", "Mulish", "Inter", Arial, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("RDL 9/2025 · vigent des del 31/07/2025", leftX, H * 0.9);
      ctx.restore();
    }
  }
}

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
  a.download = `permis-naixement.${extension}`;
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
  family: HTMLImageElement,
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
    drawFrame(ctx, (f / FPS) * 1000, family, W, H);
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

  const family = await loadImage(familyImgSrc);

  if (format === "mp4") {
    await recordMp4WithWebCodecs(ctx, family, W, H, onProgress);
    return;
  }

  const webmCandidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
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
    drawFrame(ctx, t, family, W, H);
    track.requestFrame();
    onProgress?.(Math.min(1, t / DURATION));
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }

  await new Promise((r) => setTimeout(r, 500));

  recorder.stop();
  const blob = await done;

  downloadBlob(blob, "webm");
}
