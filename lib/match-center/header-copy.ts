import type { MatchCenterPhase } from "@/lib/match-center/types";

export type MatchCenterHeaderDescriptionKey =
  | "headerDescription"
  | "headerDescriptionLiveLitePreview"
  | "headerDescriptionLiveLiteLive"
  | "headerDescriptionLiveLitePost";

export type MatchCenterHeaderPhaseKey =
  | "headerPreview"
  | "headerLive"
  | "headerLiveLite"
  | "headerPost";

/**
 * Phase eyebrow. Live Lite must not inherit the rich "Live tracking" label.
 */
export function matchCenterHeaderPhaseKey(
  liveLite: boolean,
  phase: MatchCenterPhase,
): MatchCenterHeaderPhaseKey {
  if (phase === "preview") return "headerPreview";
  if (phase === "post") return "headerPost";
  return liveLite ? "headerLiveLite" : "headerLive";
}

/**
 * Subtitle key. Rich prematch keeps probability/EV/markets wording.
 * Live Lite omits those, so it uses dedicated honest keys.
 */
export function matchCenterHeaderDescriptionKey(
  liveLite: boolean,
  phase: MatchCenterPhase,
): MatchCenterHeaderDescriptionKey {
  if (!liveLite) return "headerDescription";
  if (phase === "preview") return "headerDescriptionLiveLitePreview";
  if (phase === "post") return "headerDescriptionLiveLitePost";
  return "headerDescriptionLiveLiteLive";
}
