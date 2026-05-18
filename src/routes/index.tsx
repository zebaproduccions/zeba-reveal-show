import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import familyImg from "@/assets/family-illustration.png";
import { recordAnimation } from "@/lib/record-animation";

export const Route = createFileRoute("/")({
  component: Index,
});

const NAVY = "#0a2342";
const TEAL = "#5cb8b2";

const stats = [
  { value: "19", unit: "setmanes", label: "per progenitor" },
  { value: "32", unit: "setmanes", label: "en famílies monoparentals" },
  { value: "100%", unit: "", label: "de la base reguladora" },
];

function AnimatedNumber({ target, delay }: { target: string; delay: number }) {
  const numeric = parseInt(target.replace(/\D/g, ""), 10);
  const suffix = target.replace(/[0-9]/g, "");
  const [val, setVal] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay * 1000;
    const dur = 900;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / dur));
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(numeric * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numeric, delay]);

  return (
    <span>
      {val}
      {suffix}
    </span>
  );
}

function Index() {
  const [recording, setRecording] = useState<null | "webm" | "mp4">(null);
  const [progress, setProgress] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  const handleDownload = async (format: "webm" | "mp4") => {
    if (recording) return;
    setRecording(format);
    setProgress(0);
    try {
      await recordAnimation((p) => setProgress(p), format);
    } catch (err) {
      console.error(err);
    } finally {
      setRecording(null);
      setProgress(0);
    }
  };

  return (
    <main
      className="relative min-h-screen w-full bg-white overflow-hidden"
      style={{ fontFamily: '"Gentona", "Mulish", "Inter", system-ui, sans-serif' }}
    >
      <div
        key={replayKey}
        className="mx-auto max-w-[1400px] px-10 lg:px-16 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center min-h-screen"
      >
        {/* LEFT: title + stats */}
        <div className="flex flex-col">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mb-3"
          >
            <span
              className="inline-block text-sm md:text-base tracking-[0.18em] uppercase font-semibold"
              style={{ color: TEAL }}
            >
              Novetats laborals · Espanya
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.15, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl md:text-6xl lg:text-[68px] font-bold leading-[1.02] tracking-tight"
            style={{ color: NAVY }}
          >
            Permís per naixement
            <br />
            i cura del menor
          </motion.h1>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.9, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 h-[3px] w-40 origin-left rounded-full"
            style={{ backgroundColor: TEAL }}
          />

          <div className="mt-12 flex flex-col gap-5">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, x: -24 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 2.4 + i * 0.35,
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex items-baseline gap-4"
              >
                <span
                  className="text-5xl md:text-6xl font-bold tabular-nums leading-none"
                  style={{ color: NAVY }}
                >
                  <AnimatedNumber target={s.value} delay={2.4 + i * 0.35} />
                </span>
                {s.unit && (
                  <span
                    className="text-2xl md:text-3xl font-semibold"
                    style={{ color: NAVY }}
                  >
                    {s.unit}
                  </span>
                )}
                <span className="text-lg md:text-xl text-neutral-500">
                  {s.label}
                </span>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 4.2, duration: 0.8 }}
            className="mt-12 text-sm tracking-wide text-neutral-500"
          >
            RDL 9/2025 · vigent des del 31/07/2025
          </motion.p>
        </div>

        {/* RIGHT: family illustration */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-center justify-center"
        >
          {/* soft teal blob */}
          <div
            className="absolute inset-0 -z-10 mx-auto my-auto rounded-full blur-2xl"
            style={{
              backgroundColor: TEAL,
              opacity: 0.18,
              width: "78%",
              height: "78%",
              left: "11%",
              top: "11%",
            }}
          />
          <img
            src={familyImg}
            alt="Família amb un nadó"
            width={1024}
            height={1024}
            className="w-full max-w-[560px] h-auto select-none"
            draggable={false}
          />
        </motion.div>
      </div>

      {/* Controls */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3">
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          disabled={recording !== null}
          className="text-sm px-4 py-2 rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
        >
          Repetir
        </button>
        <button
          onClick={() => handleDownload("webm")}
          disabled={recording !== null}
          className="text-sm px-5 py-2 rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-60"
        >
          {recording === "webm"
            ? `Gravant… ${Math.round(progress * 100)}%`
            : "Descarregar .webm"}
        </button>
        <button
          onClick={() => handleDownload("mp4")}
          disabled={recording !== null}
          className="text-sm px-5 py-2 rounded-full text-white hover:opacity-90 transition disabled:opacity-60"
          style={{ backgroundColor: NAVY }}
        >
          {recording === "mp4"
            ? `Gravant… ${Math.round(progress * 100)}%`
            : "Descarregar .mp4"}
        </button>
      </div>
    </main>
  );
}
