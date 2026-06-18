import { createServerFn } from "@tanstack/react-start";

// Cloudflare Workers expose secrets/vars on process.env when nodejs_compat is
// enabled (see wrangler.jsonc). Declared locally to avoid pulling node types.
declare const process: { env: Record<string, string | undefined> };

// ============================================================
// Image-to-video via Replicate. Bringing a still image to life ("the boy
// waves", "the product rotates") is a different technology from the Canvas
// engine — it needs a video model. Replicate hosts several behind one key.
//
// Generation is async: `startVideo` creates a prediction and returns its id;
// the client polls `pollVideo` until the video URL is ready.
// ============================================================

// Model is referenced by owner/name (latest version). Swap here if needed.
const MODEL = "kwaivgi/kling-v1.6-standard";

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN;
  if (!t) {
    throw new Error(
      "Falta la clau de vídeo. Afegeix el secret REPLICATE_API_TOKEN a Cloudflare (Settings → Variables and Secrets).",
    );
  }
  return t;
}

export type VideoStatus = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  url?: string;
  error?: string;
};

function pickUrl(output: unknown): string | undefined {
  if (typeof output === "string") return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  return undefined;
}

export const startVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): { prompt: string; image: string } => {
    const obj = (input ?? {}) as { prompt?: unknown; image?: unknown };
    if (typeof obj.prompt !== "string" || obj.prompt.trim().length === 0) {
      throw new Error("Cal una descripció del moviment.");
    }
    if (typeof obj.image !== "string" || !obj.image.startsWith("data:")) {
      throw new Error("Cal adjuntar una imatge per animar.");
    }
    return { prompt: obj.prompt.trim().slice(0, 1000), image: obj.image };
  })
  .handler(async ({ data }): Promise<VideoStatus> => {
    const res = await fetch(`https://api.replicate.com/v1/models/${MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt: data.prompt,
          start_image: data.image,
          duration: 5,
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Error iniciant el vídeo (${res.status}). ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { id: string; status: VideoStatus["status"] };
    return { id: json.id, status: json.status };
  });

export const pollVideo = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): { id: string } => {
    const obj = (input ?? {}) as { id?: unknown };
    if (typeof obj.id !== "string" || obj.id.length === 0) throw new Error("Falta l'id.");
    return { id: obj.id };
  })
  .handler(async ({ data }): Promise<VideoStatus> => {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${data.id}`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Error consultant el vídeo (${res.status}). ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      id: string;
      status: VideoStatus["status"];
      output?: unknown;
      error?: string;
    };
    return {
      id: json.id,
      status: json.status,
      url: pickUrl(json.output),
      error: json.error,
    };
  });
