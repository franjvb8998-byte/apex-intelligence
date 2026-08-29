/**
 * Published pillar weights for the Team Intelligence Score.
 * Missing pillars are dropped and the remainder is renormalized.
 */

import type { TeamIntelligencePillarKey } from "@/lib/team-intelligence/models";

export const TEAM_INTELLIGENCE_WEIGHTS: Record<TeamIntelligencePillarKey, number> = {
  attack: 0.16,
  defense: 0.16,
  momentum: 0.12,
  health: 0.1,
  tacticalIdentity: 0.1,
  motivation: 0.08,
  transferStability: 0.06,
  home: 0.11,
  away: 0.11,
};

export const TEAM_INTELLIGENCE_PILLAR_LABELS: Record<
  TeamIntelligencePillarKey,
  string
> = {
  attack: "Attack",
  defense: "Defense",
  momentum: "Momentum",
  health: "Health",
  tacticalIdentity: "Tactical Identity",
  motivation: "Motivation",
  transferStability: "Transfer Stability",
  home: "Home",
  away: "Away",
};
