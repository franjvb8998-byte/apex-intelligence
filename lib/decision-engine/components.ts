/**
 * 0–100 pillars for the APEX Score. Null when the catalogue does not publish the signal.
 */

import { clamp, roundScore } from "@/lib/decision-engine/math";
import type {
  ApexDecisionInput,
  ApexScoreComponent,
  ApexValueBlock,
} from "@/lib/decision-engine/types";
import { DECISION_COMPONENT_LABELS, DECISION_POSITIVE_WEIGHTS } from "@/lib/decision-engine/weights";

function pick(input: ApexDecisionInput) {
  return input.predicted === "away" ? input.away : input.home;
}

function other(input: ApexDecisionInput) {
  return input.predicted === "away" ? input.home : input.away;
}

function pickXg(input: ApexDecisionInput): number {
  return input.predicted === "away" ? input.expectedGoals.away : input.expectedGoals.home;
}

function otherXg(input: ApexDecisionInput): number {
  return input.predicted === "away" ? input.expectedGoals.home : input.expectedGoals.away;
}

function component(
  key: ApexScoreComponent["key"],
  score: number | null,
  note: string,
  weight: number,
): ApexScoreComponent {
  return {
    key,
    label: DECISION_COMPONENT_LABELS[key],
    weight,
    score: score == null ? null : roundScore(score),
    available: score != null,
    note,
  };
}

export function scoreAttack(input: ApexDecisionInput): ApexScoreComponent {
  const xg = pickXg(input);
  if (!Number.isFinite(xg)) {
    return component("attack", null, "No xG from the Probability Engine.", DECISION_POSITIVE_WEIGHTS.attack);
  }
  return component(
    "attack",
    clamp((xg / 2.3) * 100, 0, 100),
    `Recommended side projects ${xg.toFixed(2)} xG.`,
    DECISION_POSITIVE_WEIGHTS.attack,
  );
}

export function scoreDefense(input: ApexDecisionInput): ApexScoreComponent {
  const conceded = otherXg(input);
  if (!Number.isFinite(conceded)) {
    return component("defense", null, "No opponent xG from the Probability Engine.", DECISION_POSITIVE_WEIGHTS.defense);
  }
  const ga = pick(input).goalsAgainst;
  const played = pick(input).played;
  const record =
    ga != null && played != null && played > 0 ? clamp(1 - ga / played / 2.0, 0, 1) : null;
  const fromXg = clamp(1 - conceded / 2.2, 0, 1);
  const blended = record == null ? fromXg : fromXg * 0.65 + record * 0.35;
  return component(
    "defense",
    blended * 100,
    `Opponent xG ${conceded.toFixed(2)} against the recommended side.`,
    DECISION_POSITIVE_WEIGHTS.defense,
  );
}

export function scoreForm(input: ApexDecisionInput): ApexScoreComponent {
  const a = pick(input).formQuality;
  const b = other(input).formQuality;
  if (a == null && b == null) {
    return component("form", null, "No published form series.", DECISION_POSITIVE_WEIGHTS.form);
  }
  const pickQ = a ?? 0.45;
  const otherQ = b ?? 0.45;
  const gap = pickQ - otherQ;
  return component(
    "form",
    clamp(pickQ * 70 + (0.5 + gap * 0.5) * 30, 0, 100),
    `Form quality ${(pickQ * 100).toFixed(0)} vs ${(otherQ * 100).toFixed(0)}.`,
    DECISION_POSITIVE_WEIGHTS.form,
  );
}

export function scoreXgQuality(input: ApexDecisionInput): ApexScoreComponent {
  const home = input.expectedGoals.home;
  const away = input.expectedGoals.away;
  if (!Number.isFinite(home) || !Number.isFinite(away)) {
    return component("xg", null, "No xG pair from the Probability Engine.", DECISION_POSITIVE_WEIGHTS.xg);
  }
  const gap = Math.abs(home - away);
  const total = input.expectedGoals.total;
  const separation = clamp(gap / 1.6, 0, 1);
  const volume = clamp(total / 3.2, 0, 1);
  return component(
    "xg",
    separation * 65 + volume * 35,
    `xG ${home.toFixed(2)}–${away.toFixed(2)} (Δ ${gap.toFixed(2)}).`,
    DECISION_POSITIVE_WEIGHTS.xg,
  );
}

export function scoreHomeAdvantage(input: ApexDecisionInput): ApexScoreComponent {
  const edge = input.oneXTwo.home - input.oneXTwo.away;
  if (input.predicted === "draw") {
    return component(
      "homeAdvantage",
      clamp(50 - Math.abs(edge) * 80, 0, 100),
      "Draw pick: home edge is treated as a balance check, not a boost.",
      DECISION_POSITIVE_WEIGHTS.homeAdvantage,
    );
  }
  if (input.predicted === "home") {
    return component(
      "homeAdvantage",
      clamp(48 + edge * 90, 0, 100),
      `Model home edge ${(edge * 100).toFixed(0)} points on the 1X2 board.`,
      DECISION_POSITIVE_WEIGHTS.homeAdvantage,
    );
  }
  return component(
    "homeAdvantage",
    clamp(48 - edge * 90, 0, 100),
    "Away pick: home advantage works against the selection.",
    DECISION_POSITIVE_WEIGHTS.homeAdvantage,
  );
}

export function scoreRest(input: ApexDecisionInput): ApexScoreComponent {
  const a = pick(input).restDays;
  const b = other(input).restDays;
  if (a == null && b == null) {
    return component("rest", null, "No dated recent matches to compute rest.", DECISION_POSITIVE_WEIGHTS.rest);
  }
  if (a != null && b != null) {
    return component(
      "rest",
      clamp(50 + (a - b) * 7, 0, 100),
      `Rest ${a.toFixed(1)} vs ${b.toFixed(1)} days since the last listed match.`,
      DECISION_POSITIVE_WEIGHTS.rest,
    );
  }
  const only = a ?? b ?? 0;
  return component(
    "rest",
    clamp((only / 7) * 70, 0, 100),
    `Only one side has a dated previous match (${only.toFixed(1)} days).`,
    DECISION_POSITIVE_WEIGHTS.rest,
  );
}

export function scoreMotivation(input: ApexDecisionInput): ApexScoreComponent {
  const pickRank = pick(input).rank;
  const otherRank = other(input).rank;
  if (pickRank == null || otherRank == null) {
    return component(
      "motivation",
      null,
      "No published table positions. Motivation is not inferred from rumours or cups.",
      DECISION_POSITIVE_WEIGHTS.motivation,
    );
  }
  const gap = otherRank - pickRank;
  return component(
    "motivation",
    clamp(50 + gap * 3.2, 8, 100),
    `Table ranks ${pickRank} vs ${otherRank}.`,
    DECISION_POSITIVE_WEIGHTS.motivation,
  );
}

export function scoreMarket(input: ApexDecisionInput, value: ApexValueBlock): ApexScoreComponent {
  if (value.marketEdge == null) {
    return component("market", null, "No published bookmaker price.", DECISION_POSITIVE_WEIGHTS.market);
  }
  const depth = clamp(input.bookmakerCount / 4, 0, 1);
  const edge = clamp(50 + value.marketEdge * 220, 0, 100);
  return component(
    "market",
    edge * 0.8 + depth * 20,
    `Market edge ${((value.marketEdge ?? 0) * 100).toFixed(1)} pp · ${input.bookmakerCount} book(s).`,
    DECISION_POSITIVE_WEIGHTS.market,
  );
}

export function scoreValue(value: ApexValueBlock): ApexScoreComponent {
  if (value.expectedValue == null) {
    return component("value", null, "No EV without a published price.", DECISION_POSITIVE_WEIGHTS.value);
  }
  return component(
    "value",
    clamp(((value.expectedValue + 0.15) / 0.35) * 100, 0, 100),
    `EV ${value.expectedValue >= 0 ? "+" : ""}${(value.expectedValue * 100).toFixed(1)}%.`,
    DECISION_POSITIVE_WEIGHTS.value,
  );
}

export function scoreInjuries(input: ApexDecisionInput): ApexScoreComponent {
  const n = pick(input).injuryCount;
  const badness = clamp(n * 28, 0, 100);
  return component(
    "injuries",
    badness,
    n === 0
      ? "No published absences. This is not a complete XI."
      : `${n} published absence(s) on the recommended side.`,
    -0.08,
  );
}

export function buildPositiveComponents(
  input: ApexDecisionInput,
  value: ApexValueBlock,
): ApexScoreComponent[] {
  return [
    scoreAttack(input),
    scoreDefense(input),
    scoreForm(input),
    scoreXgQuality(input),
    scoreHomeAdvantage(input),
    scoreRest(input),
    scoreMotivation(input),
    scoreMarket(input, value),
    scoreValue(value),
  ];
}
