import logoZeba from "@/assets/logo-zeba.png";
import logoZebby from "@/assets/logo-zebby.png";
import logoZuite from "@/assets/logo-zuite.png";
import logoMcp from "@/assets/logo-mcp.png";

const SUBTITLE = "Les nostres aplicacions";
const START_DELAY = 1000; // ms — pantalla en blanc inicial
const DURATION = 6000; // ms (5000 + 1000 delay)

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
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

function drawFrame(
  ctx: CanvasRenderingContext2D,
  t: number, // elapsed ms
  imgs: { zeba: HTMLImageElement; apps: HTMLImageElement[] },
  W: number,
  H: number,
) {
  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Offset everything by START_DELAY for blank intro
  t = t - START_DELAY;

  // ===== Zeba main logo: 0 - 1000ms =====
  const zebaP = Math.max(0, Math.min(1, t / 1000));
  const zebaE = easeOutExpo(zebaP);
  const zebaOpacity = zebaE;
  const zebaScale = 0.93 + 0.07 * zebaE;
  const zebaY = 12 * (1 - zebaE);

  const zebaW = W * 0.32;
  const zebaH = (zebaW / imgs.zeba.width) * imgs.zeba.height;
  const zebaCx = W / 2;
  const zebaCy = H * 0.28 + zebaY;

  ctx.save();
  ctx.globalAlpha = zebaOpacity;
  ctx.translate(zebaCx, zebaCy);
  ctx.scale(zebaScale, zebaScale);
  ctx.drawImage(imgs.zeba, -zebaW / 2, -zebaH / 2, zebaW, zebaH);
  ctx.restore();

  // ===== Subtitle: starts 1000ms, char by char =====
  const charDelay = 40;
  const charDur = 350;
  const fontSize = Math.round(H * 0.0407); // ~44px @1080, ~88px @2160
  ctx.font = `400 ${fontSize}px "Gentona", "Mulish", "Inter", "Helvetica Neue", Arial, sans-serif`;
  ctx.fillStyle = "#0a0a0a";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // Measure full subtitle to center it
  const totalWidth = ctx.measureText(SUBTITLE).width;
  let cursorX = W / 2 - totalWidth / 2;
  const subY = H * 0.52;

  for (let i = 0; i < SUBTITLE.length; i++) {
    const char = SUBTITLE[i];
    const start = 1000 + i * charDelay;
    const p = Math.max(0, Math.min(1, (t - start) / charDur));
    const e = easeOutExpo(p);
    const cw = ctx.measureText(char).width;
    if (p > 0) {
      ctx.save();
      ctx.globalAlpha = e;
      ctx.fillText(char, cursorX, subY + 8 * (1 - e));
      ctx.restore();
    }
    cursorX += cw;
  }

  // ===== Three logos: starts 2000ms, stagger 300ms =====
  const appW = W * 0.13;
  const gap = W * 0.06;
  const totalAppsW = imgs.apps.length * appW + (imgs.apps.length - 1) * gap;
  let appX = W / 2 - totalAppsW / 2;
  const appY = H * 0.72;

  imgs.apps.forEach((img, i) => {
    const aw = appW;
    const ah = (aw / img.width) * img.height;
    const start = 2000 + i * 300;
    const p = Math.max(0, Math.min(1, (t - start) / 800));
    const e = easeOutExpo(p);
    const opacity = e;
    const scale = 0.95 + 0.05 * e;
    const y = appY + 16 * (1 - e);

    if (p > 0) {
      ctx.save();
      ctx.globalAlpha = opacity;
      // soft shadow
      ctx.shadowColor = "rgba(0,0,0,0.12)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      const cx = appX + aw / 2;
      const cy = y;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.drawImage(img, -aw / 2, -ah / 2, aw, ah);
      ctx.restore();
    }
    appX += aw + gap;
  });
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
  a.download = `zeba-aplicacions.${extension}`;
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
  imgs: { zeba: HTMLImageElement; apps: HTMLImageElement[] },
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
    drawFrame(ctx, (f / FPS) * 1000, imgs, W, H);
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

  const [zeba, zebby, zuite, mcp] = await Promise.all([
    loadImage(logoZeba),
    loadImage(logoZebby),
    loadImage(logoZuite),
    loadImage(logoMcp),
  ]);
  const imgs = { zeba, apps: [zebby, zuite, mcp] };

  if (format === "mp4") {
    await recordMp4WithWebCodecs(ctx, imgs, W, H, onProgress);
    return;
  }

  // Determine supported mime based on requested format
  const mp4Candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=h264",
    "video/mp4",
  ];
  const webmCandidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const candidates = format === "mp4" ? mp4Candidates : webmCandidates;
  const mimeType =
    candidates.find((m) => MediaRecorder.isTypeSupported(m)) ||
    webmCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ||
    "video/webm";
  const actualFormat = mimeType.startsWith("video/mp4") ? "mp4" : "webm";

  if (format === "mp4" && actualFormat !== "mp4") {
    console.warn(
      "MP4 no és suportat per aquest navegador, gravant en WebM. Prova Chrome/Edge recents o Safari.",
    );
  }

  // captureStream(0) → no automatic capture; we trigger requestFrame() manually
  // per garantir que cap frame es perdi encara que el render sigui més lent que real-time.
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

  // timeslice 100ms → flush periòdic perquè el muxer MP4 no truncai el fitxer
  recorder.start(100);

  // Render frame-by-frame en temps virtual (no real-time) per no perdre cap frame
  const totalFrames = Math.round((DURATION / 1000) * FPS);
  for (let f = 0; f <= totalFrames; f++) {
    const t = (f / FPS) * 1000;
    drawFrame(ctx, t, imgs, W, H);
    track.requestFrame();
    onProgress?.(Math.min(1, t / DURATION));
    // cedeix al main thread perquè el recorder pugui processar el frame
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }

  // hold last frame perquè el muxer tanqui correctament
  await new Promise((r) => setTimeout(r, 500));

  recorder.stop();
  const blob = await done;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zeba-aplicacions.${actualFormat}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
