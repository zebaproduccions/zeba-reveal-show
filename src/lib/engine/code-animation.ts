import { clamp, easeInOut, easeOut, easeOutExpo, lerp } from "./easing";
import type { Animation } from "./types";

// ============================================================
// Code animation — the "Lovable-style" path. The AI writes the BODY of a
// per-frame draw function in JavaScript; we run it each frame with a fixed set
// of arguments (ctx, t, W, H, u). This gives near-unlimited expressiveness
// while still flowing through the same renderer + recorder.
//
// Safety: this executes model-generated code in the browser. It runs only in
// the user's own session, authored by Claude from the user's own prompt. We
// add light defenses (an API denylist + per-frame try/catch) but this is not a
// true sandbox — it's a single-user creative tool, not a place to run
// untrusted third-party input.
// ============================================================

export type CodeAnimationData = {
  title: string;
  duration: number;
  background?: string;
  code: string;
};

// Block obvious non-drawing APIs (network, storage, DOM, timers, dynamic eval).
const FORBIDDEN =
  /\b(fetch|XMLHttpRequest|WebSocket|import|require|eval|Function|document|window|globalThis|localStorage|sessionStorage|navigator|setTimeout|setInterval|postMessage|indexedDB)\b/;

export type DrawUtils = {
  images: HTMLImageElement[];
  lerp: typeof lerp;
  clamp: typeof clamp;
  ease: { inOut: typeof easeInOut; out: typeof easeOut; outExpo: typeof easeOutExpo };
  TAU: number;
};

export function fromCode(
  data: CodeAnimationData,
  images: HTMLImageElement[] = [],
  id = `ai-${Date.now()}`,
): Animation {
  const code = String(data.code ?? "");
  if (!code.trim()) throw new Error("El model no ha retornat codi. Torna-ho a provar.");
  if (FORBIDDEN.test(code)) {
    throw new Error("El codi generat feia servir funcions no permeses. Torna-ho a provar.");
  }

  let fn: (ctx: CanvasRenderingContext2D, t: number, W: number, H: number, u: DrawUtils) => void;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    fn = new Function("ctx", "t", "W", "H", "u", code) as typeof fn;
  } catch {
    throw new Error("El codi generat tenia un error de sintaxi. Torna-ho a provar.");
  }

  const u: DrawUtils = {
    images,
    lerp,
    clamp,
    ease: { inOut: easeInOut, out: easeOut, outExpo: easeOutExpo },
    TAU: Math.PI * 2,
  };

  const duration = Math.min(Math.max(Number(data.duration) || 6000, 1000), 30000);

  return {
    id,
    title: data.title || "Animació generada",
    width: 1920,
    height: 1080,
    duration,
    startDelay: 0,
    // Safety net background; the generated code repaints its own each frame.
    background: data.background || "#0a1c3f",
    layers: [
      {
        name: "code",
        draw(rc) {
          try {
            fn(rc.ctx, rc.t, rc.W, rc.H, u);
          } catch {
            // Swallow per-frame runtime errors so playback/recording survive.
          }
        },
      },
    ],
  };
}
