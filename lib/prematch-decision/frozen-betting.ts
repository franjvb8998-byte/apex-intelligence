/**
 * Current-betting read model from an immutable PrematchDecisionTicket.
 *
 * Missing frozen evidence stays missing. Never invents Watch/Pass/0/low/high.
 * Does not import or recompute PE. Does not mutate the ticket.
 *
 * REQUIRED_FOR_PUBLICATION:
 *   selectionLabel (non-empty) AND a derivable 1X2 side (home|draw|away)
 *
 * OPTIONAL_AND_SUPPRESSIBLE:
 *   apexScore, confidence, confidenceBand, riskScore, riskBand,
 *   expectedValue, fairOdds, offeredOdds, impliedProbability,
 *   kellyPct, kellyFraction, stakePct, stakeLabel, bookmaker,
 *   recommendationTier, recommendationKind
 *
 * DERIVABLE_FROM_FROZEN_FIELDS:
 *   predicted ← selectionId / selectionLabel vs team names
 *   stars ← recommendationTier via SCORING_TIER_STARS (only if tier present)
 *   valuePct / positiveEdge ← expectedValue (only if EV present)
 */

import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type {
  ApexConfidenceBand,
  ApexDecisionVerdictKind,
  ApexRiskBand,
} from "@/lib/decision-engine/types";
import type { Recommendation, ValueOpportunity } from "@/lib/intelligence/reasoning/contracts/types";
import type { MatchOutcome } from "@/lib/intelligence/types";
import type { ApexMatchRating } from "@/lib/match-rating/types";
import type { PrematchDecisionTicket } from "@/lib/prematch-decision/ticket";
import type { ScoringTier } from "@/lib/scoring-engine/types";
import { SCORING_TIER_STARS } from "@/lib/scoring-engine/weights";

export type FrozenFeaturedDecision = {
  selectionLabel: string;
  predicted: MatchOutcome;
  verdict: {
    kind: ApexDecisionVerdictKind | null;
    label: string | null;
    stars: number | null;
  };
  score: {
    value: number | null;
    label: string | null;
    coverage: null;
    components: [];
  };
  confidence: {
    value: number | null;
    band: ApexConfidenceBand | null;
    caption: "";
  };
  risk: {
    score: number | null;
    band: ApexRiskBand | null;
    reasons: [];
  };
  value: {
    modelProbability: number | null;
    fairOdds: number | null;
    impliedOdds: number | null;
    expectedValue: number | null;
    marketProbability: number | null;
    valuePct: number | null;
    marketEdge: null;
    positiveEdge: boolean | null;
    negativeEdge: boolean | null;
  };
  sizing: {
    kellyFraction: number | null;
    kellyPct: number | null;
    stakePct: number | null;
    stakeLabel: string | null;
  };
  reasonsFor: [];
  reasonsAgainst: [];
  explanation: "";
};

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function frozenSelectionOutcome(
  ticket: PrematchDecisionTicket,
): MatchOutcome | null {
  const raw = ticket.scoring?.selectionId?.trim().toLowerCase();
  if (raw === "home" || raw === "draw" || raw === "away") return raw;
  const selected = ticket.selections.find(
    (row) => row.selectionId === ticket.scoring?.selectionId,
  );
  const selectedId = selected?.selectionId?.trim().toLowerCase();
  if (selectedId === "home" || selectedId === "draw" || selectedId === "away") {
    return selectedId;
  }
  const label = ticket.scoring?.selectionLabel?.trim().toLowerCase() ?? "";
  const home = ticket.homeTeamName.trim().toLowerCase();
  const away = ticket.awayTeamName.trim().toLowerCase();
  if (label && home && label.includes(home)) return "home";
  if (label && away && label.includes(away)) return "away";
  if (label === "draw" || label.includes("draw")) return "draw";
  return null;
}

export function frozenModelProbability(
  ticket: PrematchDecisionTicket,
): number | null {
  const id = ticket.scoring?.selectionId;
  const selected = ticket.selections.find((row) => row.selectionId === id);
  return finiteOrNull(selected?.modelProbability);
}

export function frozenStars(tier: ScoringTier | null | undefined): number | null {
  if (!tier) return null;
  const stars = SCORING_TIER_STARS[tier];
  return typeof stars === "number" && Number.isFinite(stars) ? stars : null;
}

export function canPublishFrozenCurrentBet(
  ticket: PrematchDecisionTicket,
): boolean {
  return (
    nonEmpty(ticket.scoring?.selectionLabel) != null &&
    frozenSelectionOutcome(ticket) != null
  );
}

function verdictLabel(
  kind: ApexDecisionVerdictKind | null | undefined,
  tier: ScoringTier | null | undefined,
): string | null {
  if (tier) return tier;
  if (kind === "elite_pick") return "Elite Pick";
  if (kind === "strong_bet") return "Strong Bet";
  if (kind === "lean_bet") return "Lean Bet";
  if (kind === "pass") return "Pass";
  if (kind === "avoid") return "Avoid";
  return null;
}

function recommendationAction(
  tier: ScoringTier | null | undefined,
): Recommendation["action"] | undefined {
  if (tier === "Elite" || tier === "Strong Bet" || tier === "Value Bet") {
    return "bet";
  }
  if (tier === "Watch") return "watch";
  if (tier === "Avoid") return "pass";
  return undefined;
}

export function applyFrozenTicketToOpportunity(
  row: ApexOpportunity,
  ticket: PrematchDecisionTicket,
): ApexOpportunity {
  const scoring = ticket.scoring;
  const predicted = frozenSelectionOutcome(ticket);
  const ev = finiteOrNull(scoring?.expectedValue);
  const tier = scoring?.recommendationTier ?? null;
  const kind = scoring?.recommendationKind ?? null;
  return {
    ...row,
    predicted,
    selectionLabel: nonEmpty(scoring?.selectionLabel) ?? "",
    score: finiteOrNull(scoring?.apexScore),
    stars: frozenStars(tier),
    confidence: finiteOrNull(scoring?.confidence),
    confidenceBand: scoring?.confidenceBand ?? null,
    riskBand: scoring?.riskBand ?? null,
    riskScore: finiteOrNull(scoring?.riskScore),
    fairOdds: finiteOrNull(scoring?.fairOdds),
    bookmakerOdds: finiteOrNull(scoring?.offeredOdds),
    valuePct: ev,
    expectedValue: ev,
    marketEdge: null,
    kellyPct: finiteOrNull(scoring?.kellyPct),
    stakePct: finiteOrNull(scoring?.stakePct),
    stakeLabel: nonEmpty(scoring?.stakeLabel),
    recommendation: tier,
    verdict: kind,
    verdictLabel: verdictLabel(kind, tier),
    explanation: "",
    reasonsFor: [],
    reasonsAgainst: [],
    positiveEdge: ev == null ? null : ev > 0,
    durableTicketConfirmed: canPublishFrozenCurrentBet(ticket),
    frozenTicketId: ticket.ticketId,
  };
}

export function frozenRecommendation(
  ticket: PrematchDecisionTicket,
): Recommendation | null {
  if (!canPublishFrozenCurrentBet(ticket)) return null;
  const scoring = ticket.scoring;
  const predicted = frozenSelectionOutcome(ticket);
  const band = scoring?.confidenceBand ?? undefined;
  const confidence = finiteOrNull(scoring?.confidence);
  const action = recommendationAction(scoring?.recommendationTier);
  return {
    id: `frozen-ticket:${ticket.ticketId}`,
    title: nonEmpty(scoring?.selectionLabel) ?? "",
    action,
    market: "1x2",
    selection: predicted ?? undefined,
    priority: band,
    rationale: "",
    confidence:
      confidence == null || band == null
        ? undefined
        : {
            value: Math.min(1, Math.max(0, confidence / 100)),
            band,
          },
  };
}

export function frozenValueBet(
  ticket: PrematchDecisionTicket,
): ValueOpportunity | null {
  if (!canPublishFrozenCurrentBet(ticket)) return null;
  const scoring = ticket.scoring;
  const predicted = frozenSelectionOutcome(ticket);
  if (!predicted) return null;
  return {
    id: `frozen-ticket-value:${ticket.ticketId}`,
    market: "1x2",
    selection: predicted,
    modelProbability: frozenModelProbability(ticket),
    impliedProbability: finiteOrNull(scoring?.impliedProbability),
    decimalOdds: finiteOrNull(scoring?.offeredOdds),
    edge: finiteOrNull(scoring?.expectedValue),
    kellyFraction: finiteOrNull(scoring?.kellyFraction),
    explanation: undefined,
  };
}

export function frozenApexDecision(
  ticket: PrematchDecisionTicket,
): FrozenFeaturedDecision | null {
  if (!canPublishFrozenCurrentBet(ticket)) return null;
  const scoring = ticket.scoring;
  const predicted = frozenSelectionOutcome(ticket);
  const selectionLabel = nonEmpty(scoring?.selectionLabel);
  if (!predicted || !selectionLabel) return null;
  const ev = finiteOrNull(scoring?.expectedValue);
  const modelProbability = frozenModelProbability(ticket);
  const tier = scoring?.recommendationTier ?? null;
  const kind = scoring?.recommendationKind ?? null;
  return {
    selectionLabel,
    predicted,
    verdict: {
      kind,
      label: verdictLabel(kind, tier),
      stars: frozenStars(tier),
    },
    score: {
      value: finiteOrNull(scoring?.apexScore),
      label: verdictLabel(kind, tier),
      coverage: null,
      components: [],
    },
    confidence: {
      value: finiteOrNull(scoring?.confidence),
      band: scoring?.confidenceBand ?? null,
      caption: "",
    },
    risk: {
      score: finiteOrNull(scoring?.riskScore),
      band: scoring?.riskBand ?? null,
      reasons: [],
    },
    value: {
      modelProbability,
      fairOdds: finiteOrNull(scoring?.fairOdds),
      impliedOdds: finiteOrNull(scoring?.offeredOdds),
      expectedValue: ev,
      marketProbability: finiteOrNull(scoring?.impliedProbability),
      valuePct: ev,
      marketEdge: null,
      positiveEdge: ev == null ? null : ev > 0,
      negativeEdge: ev == null ? null : ev < 0,
    },
    sizing: {
      kellyFraction: finiteOrNull(scoring?.kellyFraction),
      kellyPct: finiteOrNull(scoring?.kellyPct),
      stakePct: finiteOrNull(scoring?.stakePct),
      stakeLabel: nonEmpty(scoring?.stakeLabel),
    },
    reasonsFor: [],
    reasonsAgainst: [],
    explanation: "",
  };
}

export function frozenApexRating(
  _ticket: PrematchDecisionTicket,
): ApexMatchRating | null {
  // Ticket payload has no frozen rating metrics / coverage. Do not invent them.
  return null;
}
