import { easeOut, easeOutExpo } from "@/lib/engine/easing";
import { bar, circle, line } from "@/lib/engine/layers/shape";
import { text } from "@/lib/engine/layers/text";
import type { Animation } from "@/lib/engine/types";

// ============================================================
// Intro / targeta de títol — una animació SENSE MAPA, feta només amb les
// capes genèriques (text, bar, line, circle). Demostra que el motor serveix
// per a qualsevol tema, no només per a mapes.
// ============================================================

const CREAM = "#f3ecdf";
const KICKER = "#7ea6e6";
const SUBTITLE = "#c4d4ef";
const ORANGE = "#e8853b";
const BLUE = "#1f64c0";
const FUCHSIA = "#d83b7a";

export const introTitol: Animation = {
  id: "intro-titol",
  title: "Intro — Targeta de títol",
  width: 1920,
  height: 1080,
  duration: 6000,
  startDelay: 300,
  background: (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h * 0.42, h * 0.1, w / 2, h * 0.5, w * 0.72);
    g.addColorStop(0, "#143369");
    g.addColorStop(1, "#0a1c3f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },
  layers: [
    text({
      name: "kicker",
      text: "ZEBA · MOTOR D'ANIMACIONS",
      x: 0.5,
      y: 0.3,
      size: 0.022,
      weight: 600,
      color: KICKER,
      align: "center",
      baseline: "middle",
      start: 200,
      in: 600,
      rise: 0.02,
    }),
    line({
      name: "divider",
      x1: 0.36,
      y1: 0.355,
      x2: 0.64,
      y2: 0.355,
      stroke: "rgba(126,166,230,0.5)",
      lineWidth: 0.0022,
      start: 600,
      in: 700,
    }),
    text({
      name: "title",
      text: "Qualsevol tema.",
      x: 0.5,
      y: 0.5,
      size: 0.11,
      weight: 700,
      color: CREAM,
      align: "center",
      baseline: "middle",
      start: 500,
      in: 700,
      rise: 0.04,
      easing: easeOutExpo,
    }),
    bar({
      name: "accent",
      x: 0.5,
      y: 0.58,
      w: 0.12,
      h: 0.01,
      radius: 0.005,
      fill: ORANGE,
      start: 1100,
      in: 500,
    }),
    text({
      name: "subtitle",
      text: "Un sol motor. Infinites animacions.",
      x: 0.5,
      y: 0.66,
      size: 0.034,
      weight: 500,
      color: SUBTITLE,
      align: "center",
      baseline: "middle",
      start: 1400,
      in: 700,
      rise: 0.02,
    }),
    circle({
      name: "dot-1",
      x: 0.46,
      y: 0.76,
      r: 0.011,
      fill: ORANGE,
      start: 1800,
      in: 450,
      easing: easeOut,
    }),
    circle({
      name: "dot-2",
      x: 0.5,
      y: 0.76,
      r: 0.011,
      fill: BLUE,
      start: 1950,
      in: 450,
      easing: easeOut,
    }),
    circle({
      name: "dot-3",
      x: 0.54,
      y: 0.76,
      r: 0.011,
      fill: FUCHSIA,
      start: 2100,
      in: 450,
      easing: easeOut,
    }),
  ],
};
