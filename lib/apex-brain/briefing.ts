/**
 * Deterministic APEX Brain copy from ApexDecision.
 * Templates interpolate published numbers. No LLM. No invented rotation/derby.
 */

import { BRAIN_FROM_TIER, BRAIN_RECOMMENDATION } from "@/lib/apex-brain/recommendation";
import { joinList, pct, sentences, signedPct } from "@/lib/apex-brain/format";
import type { ApexBrainBriefing, BrainPoint } from "@/lib/apex-brain/types";
import type { ApexDecision, ApexScoreComponent } from "@/lib/decision-engine/types";
import type { ApexScoring } from "@/lib/scoring-engine/types";

const POSITIVE_COMPONENT_MIN = 58;

function publishedScore(decision: ApexDecision, scoring?: ApexScoring): number {
  return Math.round(scoring?.overall ?? decision.score.value);
}

function recMeta(decision: ApexDecision, scoring?: ApexScoring) {
  return scoring
    ? BRAIN_FROM_TIER[scoring.recommendation.tier]
    : BRAIN_RECOMMENDATION[decision.verdict.kind];
}

function component(decision: ApexDecision, key: string): ApexScoreComponent | undefined {
  return decision.score.components.find((row) => row.key === key);
}

function marketLine(decision: ApexDecision): string {
  const model = pct(decision.value.modelProbability);
  const implied =
    decision.value.marketProbability == null
      ? null
      : pct(decision.value.marketProbability);
  const edge = signedPct(decision.value.marketEdge);
  if (implied == null) {
    return `The model assigns ${model} to ${decision.selectionLabel}, but no bookmaker implied probability is published`;
  }
  if (decision.value.positiveEdge) {
    return `The model assigns ${model} versus ${implied} implied by the book (edge ${edge}), so the market is underpricing this selection`;
  }
  if (decision.value.negativeEdge) {
    return `The model assigns ${model} versus ${implied} implied by the book (edge ${edge}), so the market is overpricing this selection`;
  }
  return `The model assigns ${model} versus ${implied} implied by the book (edge ${edge}), so the price is close to fair`;
}

function pricingWord(decision: ApexDecision): string {
  if (decision.value.impliedOdds == null) return "unpriced by the book";
  if (decision.value.positiveEdge) return "undervalued by the market";
  if (decision.value.negativeEdge) return "overvalued by the market";
  return "close to a fair price";
}

function unpublishedKeys(decision: ApexDecision): string[] {
  return decision.score.components
    .filter(
      (row) =>
        !row.available &&
        row.key !== "riskAdjustment" &&
        row.key !== "injuries",
    )
    .map((row) => row.label.toLowerCase());
}

function takeUnique(points: BrainPoint[], limit: number): BrainPoint[] {
  const seen = new Set<string>();
  const out: BrainPoint[] = [];
  for (const point of points) {
    if (seen.has(point.id)) continue;
    seen.add(point.id);
    out.push(point);
    if (out.length >= limit) break;
  }
  return out;
}

function buildStrengths(decision: ApexDecision): BrainPoint[] {
  const points: BrainPoint[] = decision.reasonsFor.map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.detail,
  }));

  const extras: BrainPoint[] = [];
  const attack = component(decision, "attack");
  if (attack?.available && (attack.score ?? 0) >= POSITIVE_COMPONENT_MIN) {
    extras.push({
      id: "attack",
      title: "Offensive advantage",
      detail: `${attack.note} Attack pillar ${Math.round(attack.score ?? 0)}/100.`,
    });
  }
  const defense = component(decision, "defense");
  if (defense?.available && (defense.score ?? 0) >= 55) {
    extras.push({
      id: "defense",
      title: "Defensive consistency",
      detail: `${defense.note} Defense pillar ${Math.round(defense.score ?? 0)}/100.`,
    });
  }
  const form = component(decision, "form");
  if (form?.available && (form.score ?? 0) >= POSITIVE_COMPONENT_MIN) {
    extras.push({
      id: "form",
      title: "Superior recent form",
      detail: form.note,
    });
  }
  const hfa = component(decision, "homeAdvantage");
  if (hfa?.available && (hfa.score ?? 0) >= 55 && decision.predicted === "home") {
    extras.push({
      id: "hfa",
      title: "Strong home edge",
      detail: `${hfa.note} Home-advantage pillar ${Math.round(hfa.score ?? 0)}/100.`,
    });
  }
  if (decision.value.positiveEdge) {
    extras.push({
      id: "value",
      title: "Positive expected value",
      detail: `Published EV is ${signedPct(decision.value.expectedValue)} on ${decision.selectionLabel}.`,
    });
  }
  if (
    decision.value.positiveEdge &&
    decision.value.marketEdge != null &&
    decision.value.marketEdge >= 0.02 &&
    !points.some((row) => row.id === "value")
  ) {
    extras.push({
      id: "inefficiency",
      title: "Market inefficiency detected",
      detail: `Model probability exceeds implied probability by ${signedPct(decision.value.marketEdge)}.`,
    });
  }
  extras.push({
    id: "model_pref",
    title: "Model preference",
    detail: `Probability Engine mass on ${decision.selectionLabel} is ${pct(decision.value.modelProbability)}.`,
  });

  return takeUnique([...points, ...extras], 6);
}

function buildRisks(decision: ApexDecision): BrainPoint[] {
  const points: BrainPoint[] = decision.reasonsAgainst.map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.detail,
  }));

  const extras: BrainPoint[] = [];
  if (decision.confidence.band === "low") {
    extras.push({
      id: "low_confidence",
      title: "Low confidence",
      detail: `Reliability is ${decision.confidence.value}/100 (${decision.confidence.band}) — this is not the 1X2 probability.`,
    });
  }
  const ev = decision.value.expectedValue;
  if (ev != null && ev > 0 && ev < 0.02) {
    extras.push({
      id: "small_edge",
      title: "Small value edge",
      detail: `Expected value is only ${signedPct(ev)}, inside a thin margin after costs and variance.`,
    });
  }
  if (
    decision.value.marketEdge != null &&
    Math.abs(decision.value.marketEdge) < 0.01 &&
    decision.value.impliedOdds != null
  ) {
    extras.push({
      id: "efficient_market",
      title: "Efficient market",
      detail: `Model and implied probabilities agree within 1pp (edge ${signedPct(decision.value.marketEdge)}).`,
    });
  }
  if (decision.score.coverage < 0.45) {
    extras.push({
      id: "sample",
      title: "Limited statistical sample",
      detail: `Only ${Math.round(decision.score.coverage * 100)}% of APEX Score pillars are published.`,
    });
  }
  const injuries = component(decision, "injuries");
  if (injuries?.available && (injuries.score ?? 0) > 0) {
    extras.push({
      id: "injuries",
      title: "Injury uncertainty",
      detail: injuries.note,
    });
  }
  extras.push({
    id: "residual",
    title: "Residual match noise",
    detail: `Risk Engine score is ${decision.risk.score}/100 (${decision.risk.band}).`,
  });

  return takeUnique([...points, ...extras], 5);
}

function buildAdvantages(
  decision: ApexDecision,
  used: Set<string>,
): BrainPoint[] {
  const points: BrainPoint[] = [];
  for (const row of decision.score.components) {
    if (used.has(row.key)) continue;
    if (row.key === "riskAdjustment" || row.key === "injuries") continue;
    if (!row.available || row.score == null || row.score < POSITIVE_COMPONENT_MIN) {
      continue;
    }
    points.push({
      id: `adv-${row.key}`,
      title: row.label,
      detail: `${Math.round(row.score)}/100. ${row.note}`,
    });
    used.add(row.key);
  }
  if (!used.has("value") && decision.value.positiveEdge) {
    points.push({
      id: "adv-ev",
      title: "Value on the board",
      detail: `EV ${signedPct(decision.value.expectedValue)} at fair odds ${
        decision.value.fairOdds?.toFixed(2) ?? "n/d"
      }.`,
    });
    used.add("value");
  }
  if (!used.has("coverage") && decision.score.coverage >= 0.6) {
    points.push({
      id: "adv-coverage",
      title: "Usable catalogue coverage",
      detail: `${Math.round(decision.score.coverage * 100)}% of positive pillars are published.`,
    });
    used.add("coverage");
  }
  return takeUnique(points, 6);
}

function buildDisadvantages(
  decision: ApexDecision,
  used: Set<string>,
): BrainPoint[] {
  const points: BrainPoint[] = [];
  for (const row of decision.score.components) {
    const id = `dis-${row.key}`;
    if (used.has(row.key)) continue;
    if (row.key === "riskAdjustment") continue;
    if (!row.available) {
      points.push({
        id,
        title: `${row.label} unpublished`,
        detail: row.note,
      });
      used.add(row.key);
      continue;
    }
    if (row.score != null && row.score < 45 && row.key !== "injuries") {
      points.push({
        id,
        title: `Soft ${row.label.toLowerCase()}`,
        detail: `${Math.round(row.score)}/100. ${row.note}`,
      });
      used.add(row.key);
    }
  }
  if (!used.has("low_confidence") && decision.confidence.band !== "high") {
    points.push({
      id: "dis-confidence",
      title: "Confidence is not high",
      detail: `${decision.confidence.value}/100 · ${decision.confidence.caption}.`,
    });
    used.add("low_confidence");
  }
  if (!used.has("stake") && decision.sizing.stakePct === 0) {
    points.push({
      id: "dis-stake",
      title: "No recommended exposure",
      detail: `Stake is snapped to ${decision.sizing.stakeLabel} after verdict and EV rules.`,
    });
    used.add("stake");
  }
  return takeUnique(points, 6);
}

function confidenceExplanation(decision: ApexDecision): string {
  const missing = unpublishedKeys(decision);
  const coverage = Math.round(decision.score.coverage * 100);
  const band = decision.confidence.band;
  const agree =
    decision.value.positiveEdge
      ? "the model probability sits above the implied board"
      : decision.value.negativeEdge
        ? "the model probability sits below the implied board"
        : decision.value.marketProbability == null
          ? "no bookmaker implied probability is available to cross-check"
          : "the model and the book are close";

  const missingClause =
    missing.length > 0
      ? ` Unpublished pillars (${joinList(missing)}) cap reliability`
      : " Published pillars are mostly filled";

  const riskClause =
    decision.risk.band === "high"
      ? "and the Risk Engine is high, which also pulls confidence down"
      : decision.risk.band === "medium"
        ? "and medium risk trims the reading"
        : "and contained risk does not dominate the reading";

  return sentences([
    `Confidence is ${band} at ${decision.confidence.value}/100 — that measures how reliable the reading is, not the 1X2 probability of ${pct(decision.value.modelProbability)}`,
    `${Math.round(coverage)}% of APEX Score weight is published, and ${agree}`,
    `${missingClause} ${riskClause}`,
  ]);
}

function why(
  decision: ApexDecision,
  recLabel: string,
  scoring?: ApexScoring,
): string {
  const metrics = decision.reasonsFor.slice(0, 3).map((row) => row.title.toLowerCase());
  const metricClause =
    metrics.length > 0
      ? `The reading is carried by ${joinList(metrics)}`
      : "The reading is carried by the Probability Engine 1X2 mass without a cluster of extra published edges";

  const kelly =
    decision.sizing.kellyPct == null
      ? "Quarter-Kelly is n/d without a usable price"
      : decision.sizing.stakePct === 0
        ? `Quarter-Kelly prints ${decision.sizing.kellyPct.toFixed(1)}% but the engine snaps stake to ${decision.sizing.stakeLabel} because the Decision Engine verdict is ${decision.verdict.label}`
        : `Quarter-Kelly is ${decision.sizing.kellyPct.toFixed(1)}% and snaps to a ${decision.sizing.stakeLabel} stake`;

  const riskWhy =
    decision.risk.reasons[0] != null
      ? `Risk is ${decision.risk.band} (${decision.risk.score}/100) because ${decision.risk.reasons[0].title.toLowerCase()}: ${decision.risk.reasons[0].detail}`
      : `Risk is ${decision.risk.band} (${decision.risk.score}/100) on the published board`;

  const source = scoring
    ? `Scoring Engine v2 prints ${scoring.recommendation.tier} (score ${publishedScore(decision, scoring)}/100)`
    : `the Decision Engine verdict is ${decision.verdict.label} (score ${publishedScore(decision, scoring)}/100)`;

  return sentences([
    `APEX recommends ${recLabel} on ${decision.selectionLabel} because ${source}`,
    metricClause,
    `Confidence sits at ${decision.confidence.value}/100 (${decision.confidence.band}) with ${Math.round((scoring?.coverage ?? decision.score.coverage) * 100)}% pillar coverage`,
    kelly,
    riskWhy,
  ]);
}

function recommendationExplanation(
  decision: ApexDecision,
  label: string,
  scoring?: ApexScoring,
): string {
  const ev = signedPct(decision.value.expectedValue);
  const score = publishedScore(decision, scoring);
  const kind = recMeta(decision, scoring).kind;
  if (kind === "skip") {
    return `${label}: ${decision.selectionLabel} is a skip. EV ${ev}, confidence ${decision.confidence.value}/100 and risk ${decision.risk.band} do not support a stake (${decision.sizing.stakeLabel}).`;
  }
  if (kind === "watch") {
    return `${label}: keep the fixture on radar. Score ${score}/100 is not enough to size after ${decision.risk.band} risk, so stake stays ${decision.sizing.stakeLabel}.`;
  }
  if (kind === "lean_bet") {
    return `${label}: a small position only. Score ${score}/100 with EV ${ev} and ${decision.confidence.band} confidence caps the snap at ${decision.sizing.stakeLabel}.`;
  }
  if (kind === "bet") {
    return `${label}: the board clears a full bet threshold. Score ${score}/100, EV ${ev}, stake ${decision.sizing.stakeLabel}.`;
  }
  return `${label}: elite conditions on the published board. Score ${score}/100, confidence ${decision.confidence.value}/100, stake ${decision.sizing.stakeLabel}.`;
}

function executiveSummary(decision: ApexDecision, scoring?: ApexScoring): string {
  const score = publishedScore(decision, scoring);
  const kelly =
    decision.sizing.kellyPct == null
      ? "n/d"
      : `${decision.sizing.kellyPct.toFixed(1)}%`;
  const printed = scoring
    ? `The Scoring Engine therefore prints ${scoring.recommendation.tier}`
    : `The Decision Engine therefore prints ${decision.verdict.label}`;

  return sentences([
    `${decision.selectionLabel} appears ${pricingWord(decision)}`,
    marketLine(decision),
    `APEX Score is ${score}/100 with ${decision.confidence.band} confidence (${decision.confidence.value}/100)`,
    `Expected value is ${signedPct(decision.value.expectedValue)} and quarter-Kelly is ${kelly}, snapping to a ${decision.sizing.stakeLabel} stake`,
    `Risk is ${decision.risk.band} (${decision.risk.score}/100)${
      decision.risk.reasons[0]
        ? ` after ${decision.risk.reasons[0].title.toLowerCase()}`
        : ""
    }`,
    printed,
  ]);
}

function closingVerdict(
  decision: ApexDecision,
  recLabel: string,
  risks: BrainPoint[],
  scoring?: ApexScoring,
): string {
  const score = publishedScore(decision, scoring);
  const kind = recMeta(decision, scoring).kind;
  const lead =
    kind === "skip" || kind === "watch"
      ? `Do not force a bet (${recLabel}): score ${score}/100, confidence ${decision.confidence.value}/100 and ${decision.risk.band} risk fail the stake gates`
      : `A bet is only justified at the engine size (${recLabel}), because EV ${signedPct(decision.value.expectedValue)} still clears after ${decision.confidence.band} confidence`;
  const bankroll =
    decision.sizing.stakePct === 0
      ? `Bankroll management should be idle (${decision.sizing.stakeLabel})`
      : `Keep bankroll management conservative at ${decision.sizing.stakeLabel} of bankroll (quarter-Kelly ${
          decision.sizing.kellyPct == null
            ? "n/d"
            : `${decision.sizing.kellyPct.toFixed(1)}%`
        } before the snap)`;
  const uncertainty = risks[0]
    ? `The main uncertainty is ${risks[0].title.toLowerCase()}: ${risks[0].detail}`
    : `The main uncertainty is residual three-way variance on a ${pct(decision.value.modelProbability)} favourite`;

  return sentences([lead, bankroll, uncertainty]);
}

function aliasesFor(id: string): string[] {
  const map: Record<string, string[]> = {
    hfa: ["homeAdvantage"],
    opp_inj: ["injuries"],
    value: ["value"],
    form: ["form"],
    attack: ["attack"],
    defense: ["defense"],
    xg: ["xg"],
    rest: ["rest"],
    sample: ["coverage"],
    missing_data: ["coverage"],
    low_confidence: ["low_confidence"],
    injuries: ["injuries"],
  };
  return map[id] ?? [];
}

export function buildApexBrainBriefing(
  decision: ApexDecision,
  scoring?: ApexScoring,
): ApexBrainBriefing {
  const rec = recMeta(decision, scoring);
  const strengths = buildStrengths(decision);
  const risks = buildRisks(decision).slice(0, 5);
  const used = new Set<string>([
    ...strengths.map((row) => row.id),
    ...risks.map((row) => row.id),
    ...strengths.flatMap((row) => aliasesFor(row.id)),
    ...risks.flatMap((row) => aliasesFor(row.id)),
  ]);
  const advantages = buildAdvantages(decision, used);
  const disadvantages = buildDisadvantages(decision, used);

  return {
    executiveSummary: executiveSummary(decision, scoring),
    strengths: strengths.slice(0, 6),
    risks,
    why: why(decision, rec.label, scoring),
    recommendation: {
      kind: rec.kind,
      label: rec.label,
      explanation: recommendationExplanation(decision, rec.label, scoring),
    },
    confidenceExplanation: confidenceExplanation(decision),
    advantages,
    disadvantages,
    verdict: closingVerdict(decision, rec.label, risks, scoring),
  };
}
