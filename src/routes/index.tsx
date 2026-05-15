import { createFileRoute } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useState } from "react";
import logoZeba from "@/assets/logo-zeba.png";
import logoZebby from "@/assets/logo-zebby.png";
import logoZuite from "@/assets/logo-zuite.png";
import logoMcp from "@/assets/logo-mcp.png";
import { recordAnimation } from "@/lib/record-animation";

export const Route = createFileRoute("/")({
  component: Index,
});

const subtitle = "Les nostres aplicacions";

const apps = [
  { src: logoZebby, alt: "zebby" },
  { src: logoZuite, alt: "zuite" },
  { src: logoMcp, alt: "mcp" },
];

function Index() {
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  const handleDownload = async () => {
    if (recording) return;
    setRecording(true);
    setProgress(0);
    try {
      await recordAnimation((p) => setProgress(p));
    } catch (err) {
      console.error(err);
    } finally {
      setRecording(false);
      setProgress(0);
    }
  };

  return (
    <main className="relative min-h-screen w-full bg-white flex items-center justify-center px-6 py-16">
      <div
        key={replayKey}
        className="flex flex-col items-center gap-14 md:gap-20 max-w-5xl w-full"
      >
        <motion.img
          src={logoZeba}
          alt="zeba"
          initial={{ opacity: 0, scale: 0.93, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="w-[260px] md:w-[420px] h-auto select-none"
          draggable={false}
        />

        <h1
          aria-label={subtitle}
          className="text-2xl md:text-4xl font-light tracking-tight text-neutral-900 text-center overflow-hidden"
        >
          <span className="inline-flex flex-wrap justify-center">
            {subtitle.split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 1 + i * 0.04,
                  duration: 0.35,
                  ease: "easeOut",
                }}
                className="inline-block whitespace-pre"
              >
                {char}
              </motion.span>
            ))}
          </span>
        </h1>

        <div className="flex items-center justify-center gap-10 md:gap-20 flex-wrap">
          {apps.map((app, i) => (
            <motion.img
              key={app.alt}
              src={app.src}
              alt={app.alt}
              initial={{ opacity: 0, y: 16, scale: 0.95, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{
                delay: 2 + i * 0.3,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="w-24 md:w-36 h-auto object-contain select-none drop-shadow-[0_8px_20px_rgba(0,0,0,0.08)]"
              draggable={false}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="fixed bottom-6 right-6 flex items-center gap-3">
        <button
          onClick={() => setReplayKey((k) => k + 1)}
          disabled={recording}
          className="text-sm px-4 py-2 rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition disabled:opacity-50"
        >
          Repetir
        </button>
        <button
          onClick={handleDownload}
          disabled={recording}
          className="text-sm px-5 py-2 rounded-full bg-neutral-900 text-white hover:bg-neutral-800 transition disabled:opacity-60"
        >
          {recording
            ? `Gravant… ${Math.round(progress * 100)}%`
            : "Descarregar animació (.webm)"}
        </button>
      </div>
    </main>
  );
}
