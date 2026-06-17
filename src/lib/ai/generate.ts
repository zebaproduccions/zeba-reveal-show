import { createServerFn } from "@tanstack/react-start";
import type { CodeAnimationData } from "@/lib/engine/code-animation";

// Cloudflare Workers expose secrets/vars on process.env when nodejs_compat is
// enabled (see wrangler.jsonc). Declared locally to avoid pulling node types.
declare const process: { env: Record<string, string | undefined> };

// ============================================================
// Server function: turns a natural-language prompt (plus optional reference
// images and documents) into the BODY of a Canvas draw function written by
// Claude. Runs only on the server (Cloudflare Worker), so the API key never
// reaches the browser. The engine executes the returned code per frame.
// ============================================================

const MODEL = "claude-opus-4-8";

type Attachment = { media_type: string; data: string }; // base64, no data: prefix

export type GenerateInput = {
  prompt: string;
  images?: Attachment[];
  docs?: Attachment[];
};

const SYSTEM_PROMPT = `Ets un programador creatiu expert en animacions amb Canvas 2D. L'usuari et descriu una animació (i opcionalment adjunta imatges o documents) i tu generes el CODI JavaScript que la dibuixa.

El teu codi és el COS d'una funció que es crida UN cop per cada frame, amb aquesta signatura:
  (ctx, t, W, H, u) => { ...EL TEU CODI... }

Paràmetres:
- ctx: CanvasRenderingContext2D on dibuixes.
- t: temps transcorregut en mil·lisegons (de 0 fins a la durada).
- W, H: amplada i alçada del canvas EN PÍXELS. IMPORTANT: fes servir SEMPRE W i H per a totes les posicions i mides (mai números fixos com 1920), perquè el mateix codi s'usa a pantalla i en gravació a doble resolució.
- u: utilitats → u.images (array d'imatges adjuntes, HTMLImageElement, dibuixa-les amb ctx.drawImage(u.images[i], x, y, w, h)), u.lerp(a,b,p), u.clamp(n,min,max), u.ease.inOut(p), u.ease.out(p), u.ease.outExpo(p), u.TAU (=2π).

Regles del codi:
- Pinta el FONS cada frame primer de tot (ctx.fillStyle=...; ctx.fillRect(0,0,W,H)).
- Anima en funció de t: entrades amb fade/escala, moviments continus amb Math.sin/cos, bucles, partícules, traçats… el que calgui perquè sigui VIU i professional.
- Pots usar tot el que ofereix Canvas 2D: gradients, ombres, paths, clip, globalAlpha, transformacions, text, etc.
- Tipografia: fonts geomètriques sans com '"DM Sans","Manrope","Inter",sans-serif'. Mida en funció de H (ex: Math.round(H*0.1)).
- NO facis servir: fetch, document, window, setTimeout/setInterval, import/require, eval, ni cap accés a xarxa o emmagatzematge. NOMÉS dibuix amb ctx.
- Codi robust: no assumeixis que u.images té elements si no hi ha adjunts.

Imatges adjuntes: si n'hi ha, estan indexades 0,1,2… en l'ordre rebut. Si l'usuari vol inserir-les, dibuixa-les amb u.images[index]. Si són només de referència d'estil, imita'n colors/estil però no les dibuixis.
Documents (PDF/text): usa'ls com a contingut/context.

Mai expliquis les teves limitacions ni parlis de tu mateix: limita't a fer la millor animació possible del que es demana.

FORMAT DE RESPOSTA (exacte):
TITOL: <títol curt>
DURADA: <durada en ms, entre 3000 i 12000>
FONS: <color de fons en hex>
---
<aquí NOMÉS el codi JavaScript, sense \`\`\` ni explicacions>`;

function parseResponse(text: string): CodeAnimationData {
  const sep = text.indexOf("---");
  const header = sep >= 0 ? text.slice(0, sep) : "";
  let code = sep >= 0 ? text.slice(sep + 3) : text;
  // Strip any markdown fences the model may have added.
  code = code.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "").trim();
  const title = header.match(/TITOL:\s*(.+)/i)?.[1]?.trim() || "Animació generada";
  const duration = parseInt(header.match(/DURADA:\s*(\d+)/i)?.[1] || "6000", 10);
  const background = header.match(/FONS:\s*(#[0-9a-fA-F]{3,8})/)?.[1] || "#0a1c3f";
  return { title, duration, background, code };
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

export const generateAnimation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): GenerateInput => {
    const obj = (input ?? {}) as Partial<GenerateInput>;
    if (typeof obj.prompt !== "string" || obj.prompt.trim().length === 0) {
      throw new Error("Cal una descripció.");
    }
    const clean = (arr: unknown): Attachment[] =>
      Array.isArray(arr)
        ? arr
            .filter(
              (a): a is Attachment =>
                !!a &&
                typeof (a as Attachment).media_type === "string" &&
                typeof (a as Attachment).data === "string",
            )
            .slice(0, 6)
        : [];
    return {
      prompt: obj.prompt.trim().slice(0, 2000),
      images: clean(obj.images),
      docs: clean(obj.docs),
    };
  })
  .handler(async ({ data }): Promise<CodeAnimationData> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Falta la clau d'API. Afegeix el secret ANTHROPIC_API_KEY a Cloudflare (Settings → Variables and Secrets).",
      );
    }

    const content: ContentBlock[] = [{ type: "text", text: data.prompt }];
    (data.images ?? []).forEach((img, i) => {
      content.push({ type: "text", text: `Imatge adjunta índex ${i}:` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.data },
      });
    });
    (data.docs ?? []).forEach((doc) => {
      content.push({
        type: "document",
        source: { type: "base64", media_type: doc.media_type, data: doc.data },
      });
    });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Error de l'API (${res.status}). ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as { content?: { type: string; text?: string }[] };
    const textBlock = json.content?.find((b) => b.type === "text")?.text ?? "";
    if (!textBlock) throw new Error("Resposta buida del model.");
    return parseResponse(textBlock);
  });
