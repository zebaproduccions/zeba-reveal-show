import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_ANIMATION } from "@/animations";
import { drawFrame } from "@/lib/engine/renderer";
import { recordAnimation } from "@/lib/engine/recorder";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState<null | "webm" | "mp4">(null);
  const [progress, setProgress] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  const anim = DEFAULT_ANIMATION;

  useEffect(() => {
    let cancelled = false;
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
    // Raw timeline length; startDelay is consumed inside drawFrame.
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

  return (
    <main
      className="relative min-h-screen w-full bg-[#f3ecdf] flex flex-col items-center justify-center px-6 py-10"
      style={{
        fontFamily: '"Gentona", "Mulish", "Inter", system-ui, sans-serif',
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap"
      />
      <div className="w-full max-w-[1280px] aspect-video rounded-lg overflow-hidden shadow-[0_30px_80px_-30px_rgba(10,35,66,0.25)] bg-[#f3ecdf]">
        <canvas
          key={replayKey}
          ref={canvasRef}
          width={anim.width}
          height={anim.height}
          className="w-full h-full block"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          disabled={recording !== null || !ready}
          className="text-sm px-4 py-2 rounded-full border border-[#0a2342]/20 text-[#0a2342] hover:bg-white/60 transition disabled:opacity-50"
        >
          Repetir
        </button>
        <button
          onClick={() => handleDownload("webm")}
          disabled={recording !== null || !ready}
          className="text-sm px-5 py-2 rounded-full border border-[#0a2342]/20 text-[#0a2342] hover:bg-white/60 transition disabled:opacity-60"
        >
          {recording === "webm" ? `Gravant… ${Math.round(progress * 100)}%` : "Descarregar .webm"}
        </button>
        <button
          onClick={() => handleDownload("mp4")}
          disabled={recording !== null || !ready}
          className="text-sm px-5 py-2 rounded-full text-white hover:opacity-90 transition disabled:opacity-60 bg-[#0a2342]"
        >
          {recording === "mp4" ? `Gravant… ${Math.round(progress * 100)}%` : "Descarregar .mp4"}
        </button>
      </div>
    </main>
  );
}
