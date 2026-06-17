import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ANIMATIONS, DEFAULT_ANIMATION } from "@/animations";
import { generateAnimation } from "@/lib/ai/generate";
import { fromSpec } from "@/lib/engine/spec";
import { drawFrame } from "@/lib/engine/renderer";
import { recordAnimation } from "@/lib/engine/recorder";
import type { Animation } from "@/lib/engine/types";

export const Route = createFileRoute("/")({
  component: Index,
});

type Attachment = {
  id: string;
  type: "image" | "pdf";
  name: string;
  send: { media_type: string; data: string };
  img?: HTMLImageElement; // original, for rendering into the video
};

const readDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Downscale to ~1024px JPEG to keep the payload (and token cost) small when
// sending to the model. The full-res original is kept separately for rendering.
async function processImage(file: File): Promise<Attachment> {
  const dataUrl = await readDataUrl(file);
  const img = await loadImage(dataUrl);
  const maxDim = 1024;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const cw = Math.max(1, Math.round(img.naturalWidth * scale));
  const ch = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  c.getContext("2d")!.drawImage(img, 0, 0, cw, ch);
  const data = c.toDataURL("image/jpeg", 0.85).split(",")[1];
  return {
    id: crypto.randomUUID(),
    type: "image",
    name: file.name,
    send: { media_type: "image/jpeg", data },
    img,
  };
}

async function processPdf(file: File): Promise<Attachment> {
  const dataUrl = await readDataUrl(file);
  return {
    id: crypto.randomUUID(),
    type: "pdf",
    name: file.name,
    send: { media_type: "application/pdf", data: dataUrl.split(",")[1] },
  };
}

function Index() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [generated, setGenerated] = useState<Animation | null>(null);
  const [selectedId, setSelectedId] = useState(DEFAULT_ANIMATION.id);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState<null | "webm" | "mp4">(null);
  const [progress, setProgress] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list: Animation[] = generated ? [...ANIMATIONS, generated] : ANIMATIONS;
  const anim = list.find((a) => a.id === selectedId) ?? DEFAULT_ANIMATION;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    Promise.resolve(anim.setup?.()).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [anim]);

  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;
    const total = anim.duration + 500;
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const t = now - start;
      drawFrame(ctx, anim, t, W, H);
      if (t < total) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [replayKey, ready, anim]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const next: Attachment[] = [];
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith("image/")) next.push(await processImage(file));
        else if (file.type === "application/pdf") next.push(await processPdf(file));
      } catch {
        setError(`No s'ha pogut llegir ${file.name}.`);
      }
    }
    setAttachments((prev) => [...prev, ...next].slice(0, 6));
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  const handleSelect = (id: string) => {
    if (recording || id === selectedId) return;
    setSelectedId(id);
    setReplayKey((k) => k + 1);
  };

  const handleGenerate = async () => {
    if (generating || recording || prompt.trim().length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const imageAtts = attachments.filter((a) => a.type === "image");
      const docAtts = attachments.filter((a) => a.type === "pdf");
      const spec = await generateAnimation({
        data: {
          prompt,
          images: imageAtts.map((a) => a.send),
          docs: docAtts.map((a) => a.send),
        },
      });
      const imgEls = imageAtts.map((a) => a.img!).filter(Boolean);
      const a = fromSpec(spec, imgEls);
      setGenerated(a);
      setSelectedId(a.id);
      setReplayKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No s'ha pogut generar l'animació.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format: "webm" | "mp4") => {
    if (recording) return;
    setRecording(format);
    setProgress(0);
    try {
      await recordAnimation(anim, (p) => setProgress(p), format);
    } catch (err) {
      console.error(err);
    } finally {
      setRecording(null);
      setProgress(0);
    }
  };

  const busy = recording !== null;

  return (
    <main
      className="relative min-h-screen w-full bg-[#f3ecdf] flex flex-col items-center justify-center px-6 py-10"
      style={{ fontFamily: '"Gentona", "Mulish", "Inter", system-ui, sans-serif' }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap"
      />

      {/* Prompt box — generate a new animation by describing it (+ attachments) */}
      <div className="w-full max-w-[1280px] mb-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGenerate();
            }}
            disabled={generating || busy}
            placeholder="Descriu una animació nova… ex: una intro amb el títol 'Estiu 2026' i el logo adjunt a baix a la dreta"
            className="flex-1 text-sm px-4 py-3 rounded-xl border border-[#0a2342]/20 bg-white/70 text-[#0a2342] placeholder:text-[#0a2342]/40 outline-none focus:border-[#0a2342]/50 transition disabled:opacity-60"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={generating || busy}
            className="text-sm px-4 py-3 rounded-xl border border-[#0a2342]/20 text-[#0a2342] hover:bg-white/60 transition disabled:opacity-50 whitespace-nowrap"
          >
            + Adjuntar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || busy || prompt.trim().length === 0}
            className="text-sm px-5 py-3 rounded-xl text-white hover:opacity-90 transition disabled:opacity-50 bg-[#0a2342] whitespace-nowrap"
          >
            {generating ? "Generant…" : "Generar amb IA"}
          </button>
        </div>

        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-white/70 border border-[#0a2342]/15 text-[#0a2342]"
              >
                {a.type === "image" ? "🖼" : "📄"} {a.name}
                {a.type === "image" && (
                  <span className="text-[#0a2342]/50">#{i}</span>
                )}
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="text-[#0a2342]/50 hover:text-[#a3331f]"
                  aria-label="Treure"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-[#a3331f]">{error}</p>}
      </div>

      {list.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
          {list.map((a) => {
            const active = a.id === selectedId;
            return (
              <button
                key={a.id}
                onClick={() => handleSelect(a.id)}
                disabled={busy || generating}
                aria-pressed={active}
                className={
                  "text-sm px-4 py-2 rounded-full border transition disabled:opacity-50 " +
                  (active
                    ? "bg-[#0a2342] text-white border-[#0a2342]"
                    : "border-[#0a2342]/20 text-[#0a2342] hover:bg-white/60")
                }
              >
                {a.title}
              </button>
            );
          })}
        </div>
      )}

      <div className="w-full max-w-[1280px] aspect-video rounded-lg overflow-hidden shadow-[0_30px_80px_-30px_rgba(10,35,66,0.25)] bg-[#f3ecdf]">
        <canvas
          key={`${selectedId}-${replayKey}`}
          ref={canvasRef}
          width={anim.width}
          height={anim.height}
          className="w-full h-full block"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          disabled={busy || !ready}
          className="text-sm px-4 py-2 rounded-full border border-[#0a2342]/20 text-[#0a2342] hover:bg-white/60 transition disabled:opacity-50"
        >
          Repetir
        </button>
        <button
          onClick={() => handleDownload("webm")}
          disabled={busy || !ready}
          className="text-sm px-5 py-2 rounded-full border border-[#0a2342]/20 text-[#0a2342] hover:bg-white/60 transition disabled:opacity-60"
        >
          {recording === "webm" ? `Gravant… ${Math.round(progress * 100)}%` : "Descarregar .webm"}
        </button>
        <button
          onClick={() => handleDownload("mp4")}
          disabled={busy || !ready}
          className="text-sm px-5 py-2 rounded-full text-white hover:opacity-90 transition disabled:opacity-60 bg-[#0a2342]"
        >
          {recording === "mp4" ? `Gravant… ${Math.round(progress * 100)}%` : "Descarregar .mp4"}
        </button>
      </div>
    </main>
  );
}
