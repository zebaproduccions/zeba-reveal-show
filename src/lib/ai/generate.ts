import { createServerFn } from "@tanstack/react-start";
import type { AnimationSpec } from "@/lib/engine/spec";

// Cloudflare Workers expose secrets/vars on process.env when nodejs_compat is
// enabled (see wrangler.jsonc). Declared locally to avoid pulling node types.
declare const process: { env: Record<string, string | undefined> };

// ============================================================
// Server function: turns a natural-language prompt (plus optional reference
// images and documents) into an AnimationSpec by calling Claude. Runs only on
// the server (Cloudflare Worker), so the API key never reaches the browser.
// The model fills a fixed JSON schema — it never returns code.
// ============================================================

const MODEL = "claude-opus-4-8";

type Attachment = { media_type: string; data: string }; // base64, no data: prefix

export type GenerateInput = {
  prompt: string;
  images?: Attachment[]; // reference images / images to insert (indexed 0..n-1)
  docs?: Attachment[]; // PDFs used as context
};

const SYSTEM_PROMPT = `Ets un assistent que dissenya animacions per a un motor de Canvas 2D (1920×1080).
Reps una descripció en llenguatge natural (i opcionalment imatges i documents adjunts) i respons NOMÉS amb un objecte JSON vàlid (sense markdown, sense text abans ni després) que descriu l'animació.

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
IMAGE:  { "kind":"image", "ref":number, "x":0..1, "y":0..1, "w":0..1, "h":0..1, "start":ms, "in":ms }

Convencions IMPORTANTS:
- Posicions x,y (i x1/y1/x2/y2) són normalitzades 0..1 (0,0 = dalt-esquerra; 1,1 = baix-dreta).
- Mides (size, r, h de bar, lineWidth, rise) són FRACCIÓ DE L'ALÇADA. Un títol sol anar entre 0.08 i 0.13; un subtítol entre 0.03 i 0.045.
- "w" (amplada de bar i d'image) és fracció de l'AMPLADA. Per a IMAGE, si no poses "h" es manté la proporció original de la imatge.
- "start" és quan la capa apareix (ms); "in" és la durada de l'entrada. Escalona els "start".
- Tots els elements es queden visibles després d'entrar.
- Tria colors que contrastin bé amb el fons.

IMATGES ADJUNTES:
- Si hi ha imatges adjuntes, estan indexades començant per 0 en l'ordre en què apareixen.
- Per INSERIR una imatge adjunta dins l'animació (logo, foto…), usa una capa IMAGE amb "ref" igual al seu índex.
- Si l'usuari demana que la imatge sigui només de REFERÈNCIA d'estil (colors, tipografia, to), NO l'insereixis: limita't a imitar-ne la paleta i l'estil en les altres capes.
- Segueix el que digui el text de l'usuari per decidir si una imatge és per inserir o per referència.

MOVIMENT (clau perquè quedi VIU):
Qualsevol capa pot portar un camp "motion" que la desplaça, gira o escala al llarg del temps:
"motion": {
  "loop": boolean,        // true per a moviments continus (flotar, girar, bategar)
  "duration": ms,         // durada d'un cicle; si l'omets, dura tota l'animació
  "x": Keyframe[],        // desplaçament horitzontal (fracció d'amplada; -0.5 = mitja pantalla cap a l'esquerra)
  "y": Keyframe[],        // desplaçament vertical (fracció d'alçada; valors negatius = amunt)
  "scale": Keyframe[],    // mida (1 = original, 1.2 = 20% més gran)
  "rotate": Keyframe[]    // graus
}
Keyframe = { "t":0..1, "v":number, "ease":"linear"|"inOut"|"out" }   // "t" és la fracció del cicle

Exemples (copia'ls i adapta'ls):
- Flotar suau:        "motion":{"loop":true,"duration":2500,"y":[{"t":0,"v":0},{"t":0.5,"v":-0.03,"ease":"inOut"},{"t":1,"v":0,"ease":"inOut"}]}
- Bategar:            "motion":{"loop":true,"duration":1500,"scale":[{"t":0,"v":1},{"t":0.5,"v":1.12,"ease":"inOut"},{"t":1,"v":1,"ease":"inOut"}]}
- Girar sense parar:  "motion":{"loop":true,"duration":6000,"rotate":[{"t":0,"v":0},{"t":1,"v":360}]}
- Entrar lliscant:    "motion":{"duration":700,"x":[{"t":0,"v":-0.5,"ease":"out"},{"t":1,"v":0}]}
- Travessar la pantalla: "motion":{"loop":true,"duration":5000,"x":[{"t":0,"v":-0.6},{"t":1,"v":0.6}]}

Fes servir el moviment GENEROSAMENT: títols que entren lliscant, elements decoratius que floten/bateguen/giren, accents que es desplacen. Combina l'entrada (start/in) amb "motion". Una bona animació gairebé sempre té diversos elements en moviment.

DOCUMENTS ADJUNTS (PDF/text): usa'ls com a contingut o context (textos, dades, guió) per omplir l'animació.

REGLES DE COMPORTAMENT (molt importants):
- Construeix SEMPRE el que demana l'usuari amb les primitives disponibles. Si alguna cosa no es pot fer literalment, APROXIMA-LA de manera creativa amb formes, text, colors i composició.
- NO generis MAI una animació que expliqui les teves limitacions, que parli del "motor" o de tu mateix, ni que digui què pots o no pots fer. L'usuari vol la SEVA animació, no un missatge sobre les teves capacitats.
- Sigues generós: omple l'escena amb diversos elements ben col·locats i escalonats perquè quedi viva i acabada.

Respon NOMÉS amb el JSON.`;

function extractJson(text: string): AnimationSpec {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1) t = t.slice(start, end + 1);
  return JSON.parse(t) as AnimationSpec;
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
  .handler(async ({ data }): Promise<AnimationSpec> => {
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
        max_tokens: 4000,
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

    try {
      return extractJson(textBlock);
    } catch {
      throw new Error("El model no ha retornat un JSON vàlid. Torna-ho a provar.");
    }
  });
