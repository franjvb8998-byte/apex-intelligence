/**
 * Risk Engine — separate 0–100 score and Low/Medium/High band.
 * Derby, rotation, travel distance and new-coach flags stay off unless published.
 */

import { clamp, roundScore, threeWayEntropy } from "@/lib/decision-engine/math";
import type {
  ApexDecisionInput,
  ApexDecisionReason,
  ApexRiskBlock,
} from "@/lib/decision-engine/types";

const RAIN = /\b(rain|lluvia|storm|tormenta|downpour|showers?|nieve|snow)\b/i;

function pick(input: ApexDecisionInput) {
  return input.predicted === "away" ? input.away : input.home;
}

function other(input: ApexDecisionInput) {
  return input.predicted === "away" ? input.home : input.away;
}

function concededPerMatch(side: ApexDecisionInput["home"]): number | null {
  if (side.goalsAgainst == null || side.played == null || side.played <= 0) {
    return null;
  }
  return side.goalsAgainst / side.played;
}

function missingCoverage(input: ApexDecisionInput): number {
  let present = 0;
  let total = 6;
  if (pick(input).formLetters.length > 0) present += 1;
  if (pick(input).played != null) present += 1;
  if (pick(input).restDays != null) present += 1;
  if (input.h2h != null) present += 1;
  if (input.decimalOdds != null) present += 1;
  if (pick(input).rank != null && other(input).rank != null) present += 1;
  return 1 - present / total;
}

export function evaluateRisk(input: ApexDecisionInput): ApexRiskBlock {
  const reasons: ApexDecisionReason[] = [];
  let score = 0;
  const entropy = threeWayEntropy(input.oneXTwo);
  const vol = roundScore(entropy * 100);
  score += entropy * 38;
  if (entropy >= 0.72 || input.oneXTwo.draw >= 0.28) {
    reasons.push({
      id: "volatility",
      title: "High volatility",
      detail: `1X2 entropy is ${(entropy * 100).toFixed(0)}% of the three-way maximum; the favourite is not decisive.`,
    });
  } else if (entropy >= 0.55) {
    reasons.push({
      id: "volatility",
      title: "Fixture volatility",
      detail: `Draw mass ${(input.oneXTwo.draw * 100).toFixed(0)}% keeps the board noisy.`,
    });
  }

  const otherXg =
    input.predicted === "away" ? input.expectedGoals.home : input.expectedGoals.away;
  const ga = concededPerMatch(pick(input));
  if (otherXg >= 1.35 || (ga != null && ga >= 1.4)) {
    score += 16;
    reasons.push({
      id: "defense",
      title: "Defensive instability",
      detail:
        ga != null
          ? `The recommended side concedes ${ga.toFixed(2)} goals per published match; opponent xG is ${otherXg.toFixed(2)}.`
          : `Opponent projects ${otherXg.toFixed(2)} xG against the recommended side.`,
    });
  }

  const injuries = pick(input).injuryCount;
  if (injuries >= 1) {
    score += clamp(injuries * 12, 0, 24);
    reasons.push({
      id: "injuries",
      title: "Injuries",
      detail: `${pick(input).name} has ${injuries} published absence${injuries === 1 ? "" : "s"}.`,
    });
  }

  if (pick(input).matchesLast7 >= 2) {
    score += 14;
    reasons.push({
      id: "congestion",
      title: "Schedule congestion",
      detail: `${pick(input).name} has ${pick(input).matchesLast7} published matches in the seven days before kick-off.`,
    });
  }

  if (
    input.predicted === "away" &&
    input.away.consecutiveAway >= 2
  ) {
    score += 8;
    reasons.push({
      id: "travel",
      title: "Travel",
      detail: `${input.away.name} is coming off ${input.away.consecutiveAway} consecutive published away matches.`,
    });
  }

  if (input.weather && RAIN.test(input.weather)) {
    score += 10;
    reasons.push({
      id: "weather",
      title: "Weather",
      detail: `Published conditions: ${input.weather}.`,
    });
  }

  const missing = missingCoverage(input);
  if (missing >= 0.4) {
    score += missing * 22;
    reasons.push({
      id: "missing_data",
      title: "Small statistical sample",
      detail: "Form, rest, H2H or market depth is unpublished — coverage is too thin to size up.",
    });
  }

  if (
    input.predicted === "away" &&
    input.away.awayWinPct != null &&
    input.away.awayWinPct < 0.33
  ) {
    score += 10;
    reasons.push({
      id: "away_form",
      title: "Poor away form",
      detail: `${input.away.name} wins ${(input.away.awayWinPct * 100).toFixed(0)}% of published away matches.`,
    });
  }

  const value = input.decimalOdds;
  const implied = value != null && value > 1 ? 1 / value : null;
  const model = input.oneXTwo[input.predicted];
  if (implied != null && Math.abs(model - implied) < 0.01 && input.bookmakerCount >= 1) {
    reasons.push({
      id: "market_corrected",
      title: "Market already corrected",
      detail: "Model probability sits inside 1pp of the implied board — the inefficiency has been priced in.",
    });
    score += 6;
  }

  const clamped = roundScore(score);
  const band: ApexRiskBlock["band"] =
    clamped >= 55 ? "high" : clamped >= 32 ? "medium" : "low";

  if (reasons.length === 0) {
    reasons.push({
      id: "baseline",
      title: "Baseline match risk",
      detail: `Residual three-way noise ${(vol).toFixed(0)} / 100. No extra published risk flags.`,
    });
  }

  return { score: clamped, band, reasons };
}
