import { createServerFn } from "@tanstack/react-start";
import type { AnimationSpec } from "@/lib/engine/spec";

// Cloudflare Workers expose secrets/vars on process.env when nodejs_compat is
// enabled (see wrangler.jsonc). Declared locally to avoid pulling node types.
declare const process: { env: Record<string, string | undefined> };

// ============================================================
// Server function: turns a natural-language prompt into an AnimationSpec by
// calling Claude. Runs only on the server (Cloudflare Worker), so the API key
// never reaches the browser. The model fills a fixed JSON schema — it never
// returns code — and the engine renders the result.
// ============================================================

const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `Ets un assistent que dissenya animacions per a un motor de Canvas 2D (1920×1080).
Reps una descripció en llenguatge natural i respons NOMÉS amb un objecte JSON vàlid (sense markdown, sense text abans ni després) que descriu l'animació.

Format del JSON:
{
  "title": string,                      // títol curt de l'animació
  "duration": number,                   // durada total en ms (entre 3000 i 12000)
  "background": string,                 // color de fons en hex, ex "#0a1c3f"
  "layers": SpecLayer[]                 // capes ordenades; es dibuixen totes cada frame
}

Cada capa és un d'aquests tipus (camp "kind"):

TEXT:   { "kind":"text", "text": string | string[], "x":0..1, "y":0..1, "size":0..1, "color":"#hex", "weight":400..800, "align":"left"|"center"|"right", "start":ms, "in":ms, "rise":0..0.1 }
CIRCLE: { "kind":"circle", "x":0..1, "y":0..1, "r":0..0.3, "fill":"#hex", "stroke":"#hex", "lineWidth":0..0.02, "start":ms, "in":ms }
BAR:    { "kind":"bar", "x":0..1, "y":0..1, "w":0..1, "h":0..0.2, "fill":"#hex", "radius":0..0.05, "start":ms, "in":ms }
LINE:   { "kind":"line", "x1":0..1, "y1":0..1, "x2":0..1, "y2":0..1, "stroke":"#hex", "lineWidth":0..0.02, "start":ms, "in":ms }

Convencions IMPORTANTS:
- Posicions x,y i x1/y1/x2/y2 són normalitzades 0..1 (0,0 = cantonada superior esquerra; 1,1 = inferior dreta).
- Mides (size, r, h, lineWidth, rise) són FRACCIÓ DE L'ALÇADA. "size":0.1 és un text gran; un títol sol anar entre 0.08 i 0.13. Un subtítol entre 0.03 i 0.045.
- "w" (amplada de bar) és fracció de l'AMPLADA.
- "start" és quan la capa comença a aparèixer (ms); "in" és la durada de l'entrada (fade + pujada). Escalona els "start" perquè els elements apareguin un darrere l'altre.
- Tots els elements es queden visibles després d'entrar (no desapareixen).
- Tria colors que contrastin bé amb el fons. Text clar sobre fons fosc i viceversa.
- Composició neta i centrada: títol cap al centre, subtítol a sota, formes decoratives ben col·locades.

Respon NOMÉS amb el JSON.`;

function extractJson(text: string): AnimationSpec {
  let t = text.trim();
  // Strip ```json fences if the model added them.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  return JSON.parse(t) as AnimationSpec;
}

export const generateAnimation = createServerFn({ method: "POST" })
  .inputValidator((prompt: unknown): string => {
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      throw new Error("Cal una descripció.");
    }
    return prompt.trim().slice(0, 2000);
  })
  .handler(async ({ data: prompt }): Promise<AnimationSpec> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Falta la clau d'API. Afegeix el secret ANTHROPIC_API_KEY a Cloudflare (Settings → Variables and Secrets).",
      );
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Error de l'API (${res.status}). ${detail.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const textBlock = data.content?.find((b) => b.type === "text")?.text ?? "";
    if (!textBlock) throw new Error("Resposta buida del model.");

    try {
      return extractJson(textBlock);
    } catch {
      throw new Error("El model no ha retornat un JSON vàlid. Torna-ho a provar.");
    }
  });
