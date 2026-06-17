import type { Animation } from "@/lib/engine/types";
import { costaBrava } from "./costa-brava";
import { introTitol } from "./intro-titol";

// Registry of available animations. Add a new topic by creating a file in this
// folder that exports an Animation and listing it here — the engine and the UI
// pick it up automatically.
export const ANIMATIONS: Animation[] = [costaBrava, introTitol];

export const DEFAULT_ANIMATION = ANIMATIONS[0];

export function getAnimation(id: string): Animation | undefined {
  return ANIMATIONS.find((a) => a.id === id);
}
