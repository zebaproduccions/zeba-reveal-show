import { drawFrame } from "./renderer";
import type { Animation } from "./types";

// ============================================================
// Recorder: renders an Animation frame-by-frame to WebM or MP4.
//
// Generalised from the original Costa Brava recorder. WebM uses MediaRecorder
// + canvas.captureStream; MP4 uses WebCodecs + mp4-muxer with a WebM fallback
// path handled by the caller choosing the format.
// ============================================================

export type RecordFormat = "webm" | "mp4";

const FPS = 30;
/** Recording renders at this multiple of the animation's authoring size. */
const RECORD_SCALE = 2;
const BITRATE = 40_000_000;

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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function getSupportedMp4Config(
  VideoEncoderCtor: VideoEncoderConstructorLike,
  W: number,
  H: number,
): Promise<VideoEncoderConfig> {
  const baseConfig: Omit<VideoEncoderConfig, "codec"> = {
    width: W,
    height: H,
    bitrate: BITRATE,
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
  anim: Animation,
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
  const duration = anim.duration;
  const totalFrames = Math.round((duration / 1000) * FPS);
  const frameDurationUs = Math.round(1_000_000 / FPS);
  const totalDurationUs = duration * 1000;
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
  encoder.configure(await getSupportedMp4Config(VideoEncoderCtor, W, H));
  for (let f = 0; f < totalFrames; f++) {
    const timestamp = f * frameDurationUs;
    const frameDur = f === totalFrames - 1 ? totalDurationUs - timestamp : frameDurationUs;
    // The raw clock starts at 0; drawFrame consumes the animation's startDelay
    // internally.
    drawFrame(ctx, anim, (f / FPS) * 1000, W, H);
    const frame = new VideoFrameCtor(ctx.canvas, { timestamp, duration: frameDur });
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
  downloadBlob(new Blob([target.buffer], { type: "video/mp4" }), `${anim.id}.mp4`);
}

export async function recordAnimation(
  anim: Animation,
  onProgress?: (p: number) => void,
  format: RecordFormat = "webm",
): Promise<void> {
  await anim.setup?.();
  const W = anim.width * RECORD_SCALE;
  const H = anim.height * RECORD_SCALE;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  if (format === "mp4") {
    await recordMp4WithWebCodecs(anim, ctx, W, H, onProgress);
    return;
  }

  const webmCandidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mimeType = webmCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
  recorder.start(100);
  const totalFrames = Math.round((anim.duration / 1000) * FPS);
  for (let f = 0; f <= totalFrames; f++) {
    const t = (f / FPS) * 1000;
    drawFrame(ctx, anim, t, W, H);
    track.requestFrame();
    onProgress?.(Math.min(1, t / anim.duration));
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }
  await new Promise((r) => setTimeout(r, 500));
  recorder.stop();
  const blob = await done;
  downloadBlob(blob, `${anim.id}.webm`);
}
