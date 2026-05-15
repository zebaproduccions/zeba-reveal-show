import logoZeba from "@/assets/logo-zeba.png";
import logoZebby from "@/assets/logo-zebby.png";
import logoZuite from "@/assets/logo-zuite.png";
import logoMcp from "@/assets/logo-mcp.png";

const SUBTITLE = "Les nostres aplicacions";
const DURATION = 5000; // ms

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
  ctx.font = `300 44px "Inter", "Helvetica Neue", Arial, sans-serif`;
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

export async function recordAnimation(
  onProgress?: (p: number) => void,
): Promise<void> {
  const W = 1920;
  const H = 1080;
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

  // Determine supported mime
  const mimeCandidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const mimeType =
    mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ||
    "video/webm";

  const stream = canvas.captureStream(60);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();

  // Render an initial frame (white)
  drawFrame(ctx, 0, imgs, W, H);

  const startTs = performance.now();
  await new Promise<void>((resolve) => {
    function tick() {
      const t = performance.now() - startTs;
      drawFrame(ctx, t, imgs, W, H);
      onProgress?.(Math.min(1, t / DURATION));
      if (t < DURATION) {
        requestAnimationFrame(tick);
      } else {
        // hold last frame briefly
        setTimeout(resolve, 400);
      }
    }
    requestAnimationFrame(tick);
  });

  recorder.stop();
  const blob = await done;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "zeba-aplicacions.webm";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
