/**
 * Copilot Intelligence v1 — analyst presentation over published APEX outputs.
 * Does not re-score, re-price, or invent catalogue facts.
 */

import type { ScoringTier } from "@/lib/scoring-engine/types";
import type {
  CopilotCall,
  CopilotEvTone,
  CopilotIntelligence,
  CopilotIntelligencePoint,
  CopilotLiveOpportunity,
  CopilotMarketLine,
  CopilotMarketVerdict,
  CopilotMatchSnapshot,
} from "@/lib/copilot/types";

const EV_EPS = 0.005;

function bestPriced(snapshot: CopilotMatchSnapshot): CopilotMarketLine | null {
  const priced = snapshot.markets.filter(
    (row) => row.expectedValue != null && Number.isFinite(row.expectedValue),
  );
  if (priced.length === 0) return null;
  return priced.reduce((best, row) =>
    (row.expectedValue ?? Number.NEGATIVE_INFINITY) >
    (best.expectedValue ?? Number.NEGATIVE_INFINITY)
      ? row
      : best,
  );
}

function publishedEv(snapshot: CopilotMatchSnapshot): number | null {
  const fromDecision = snapshot.decision?.value.expectedValue;
  if (fromDecision != null && Number.isFinite(fromDecision)) return fromDecision;
  return bestPriced(snapshot)?.expectedValue ?? null;
}

function evTone(ev: number | null): CopilotEvTone {
  if (ev == null || !Number.isFinite(ev)) return "neutral";
  if (ev > EV_EPS) return "positive";
  if (ev < -EV_EPS) return "negative";
  return "neutral";
}

function preferredName(snapshot: CopilotMatchSnapshot): string {
  if (snapshot.predictedOutcome === "away") return snapshot.away.name;
  if (snapshot.predictedOutcome === "draw") return "the draw";
  return snapshot.home.name;
}

function callFromSnapshot(
  snapshot: CopilotMatchSnapshot,
  tone: CopilotEvTone,
): CopilotCall {
  const tier = snapshot.scoring?.recommendation.tier;
  const action = snapshot.recommendation.action;
  const finished = snapshot.status === "finished";

  if (tier === "Avoid") return "avoid";
  if (action === "pass" && tone !== "positive") {
    return finished ? "avoid" : "watch_live";
  }
  if ((action === "watch" || tier === "Watch") && tone !== "positive") {
    return finished ? "avoid" : "watch_live";
  }
  if (tone === "negative" && action !== "bet" && action !== "reduce_stake") {
    return finished ? "avoid" : "watch_live";
  }
  return callForSide(snapshot.predictedOutcome);
}

function callForSide(outcome: CopilotMatchSnapshot["predictedOutcome"]): CopilotCall {
  if (outcome === "away") return "back_away";
  if (outcome === "draw") return "back_draw";
  return "back_home";
}

function riskBand(snapshot: CopilotMatchSnapshot): CopilotIntelligence["riskBand"] {
  if (snapshot.decision?.risk.band) return snapshot.decision.risk.band;
  if (
    snapshot.confidence.band === "low" ||
    snapshot.oneXTwo.draw >= 0.32 ||
    snapshot.injuries.length >= 3
  ) {
    return "high";
  }
  if (snapshot.confidence.band === "medium" || snapshot.injuries.length > 0) {
    return "medium";
  }
  return "low";
}

function confidenceBand(
  snapshot: CopilotMatchSnapshot,
): CopilotIntelligence["confidenceBand"] {
  return snapshot.decision?.confidence.band ?? snapshot.confidence.band;
}

function verdictFrom(
  snapshot: CopilotMatchSnapshot,
  tone: CopilotEvTone,
  risk: CopilotIntelligence["riskBand"],
  call: CopilotCall,
): CopilotMarketVerdict {
  const tier: ScoringTier | undefined = snapshot.scoring?.recommendation.tier;
  if (tier === "Avoid" || call === "avoid") return "avoid";
  if (tier === "Elite") return "elite";
  if (tier === "Strong Bet" || tier === "Value Bet") return "value";
  if (risk === "high" && tone !== "positive") return "high_risk";
  if (tone === "positive") return "value";
  if (tone === "negative") return "avoid";
  if (snapshot.decision?.value.impliedOdds != null || bestPriced(snapshot)) {
    return "fair";
  }
  if (call === "watch_live") return "no_bet";
  return "no_bet";
}

function takeUnique(points: CopilotIntelligencePoint[], limit: number): CopilotIntelligencePoint[] {
  const seen = new Set<string>();
  const out: CopilotIntelligencePoint[] = [];
  for (const point of points) {
    if (seen.has(point.id) || seen.has(point.title)) continue;
    seen.add(point.id);
    seen.add(point.title);
    out.push(point);
    if (out.length >= limit) break;
  }
  return out;
}

function buildReasons(snapshot: CopilotMatchSnapshot): CopilotIntelligencePoint[] {
  const points: CopilotIntelligencePoint[] = [];
  const homeXg = snapshot.expectedGoals.home;
  const awayXg = snapshot.expectedGoals.away;
  const pick = preferredName(snapshot);

  if (snapshot.predictedOutcome === "home" && homeXg > awayXg + 0.1) {
    points.push({
      id: "attack",
      title: "Better attack",
      detail: `${snapshot.home.name} projects the clearer chance profile.`,
    });
  }
  if (snapshot.predictedOutcome === "away" && awayXg > homeXg + 0.1) {
    points.push({
      id: "attack",
      title: "Better attack",
      detail: `${snapshot.away.name} projects the clearer chance profile.`,
    });
  }
  if (snapshot.predictedOutcome === "home" && awayXg + 0.1 < homeXg) {
    points.push({
      id: "defense",
      title: "Better defensive projection",
      detail: `${snapshot.away.name} is not expected to create at the same rate.`,
    });
  }
  if (snapshot.predictedOutcome === "away" && homeXg + 0.1 < awayXg) {
    points.push({
      id: "defense",
      title: "Better defensive projection",
      detail: `${snapshot.home.name} is not expected to create at the same rate.`,
    });
  }
  if (
    snapshot.predictedOutcome === "home" &&
    snapshot.oneXTwo.home > snapshot.oneXTwo.away
  ) {
    points.push({
      id: "home",
      title: "Home advantage",
      detail: `APEX prefers ${snapshot.home.name} on their own ground.`,
    });
  }

  for (const row of snapshot.decision?.reasonsFor ?? []) {
    points.push({
      id: row.id,
      title: humanTitle(row.title),
      detail: stripSoftware(row.detail),
    });
  }
  for (const row of snapshot.strengths) {
    points.push({
      id: `str-${row.label}`,
      title: humanTitle(row.label),
      detail: stripSoftware(row.detail),
    });
  }
  if (snapshot.tactical.length > 0) {
    const first = snapshot.tactical[0]!;
    points.push({
      id: "tactical",
      title: "Tactical superiority",
      detail: stripSoftware(first.detail || first.label),
    });
  }

  if (points.length === 0) {
    points.push({
      id: "model",
      title: "Model preference",
      detail: `APEX reads ${pick} as the stronger side on the published board.`,
    });
  }

  return takeUnique(points, 4);
}

function buildConcerns(
  snapshot: CopilotMatchSnapshot,
  tone: CopilotEvTone,
  risk: CopilotIntelligence["riskBand"],
): CopilotIntelligencePoint[] {
  const points: CopilotIntelligencePoint[] = [];

  if (tone !== "positive") {
    points.push({
      id: "ev",
      title: "Low expected value",
      detail:
        tone === "negative"
          ? "The published price looks worse than the model, not better."
          : "The market has already caught up with the side APEX prefers.",
    });
  }
  if (risk === "high" || snapshot.oneXTwo.draw >= 0.3) {
    points.push({
      id: "variance",
      title: "High variance",
      detail: "This is still a live three-way match, not a settled favourite.",
    });
  }
  if (snapshot.lineupsPublished === false) {
    points.push({
      id: "lineup",
      title: "Missing lineup",
      detail: "Confirmed starting XIs are not in the catalogue yet.",
    });
  }
  const sample =
    Math.min(snapshot.home.played ?? 0, snapshot.away.played ?? 0) ||
    (snapshot.home.played ?? snapshot.away.played ?? 0);
  if (snapshot.confidence.band === "low" || (sample > 0 && sample < 6)) {
    points.push({
      id: "sample",
      title: "Small sample",
      detail: "Too little published form to treat this as a high-conviction match.",
    });
  }
  for (const row of snapshot.decision?.reasonsAgainst ?? []) {
    points.push({
      id: row.id,
      title: humanTitle(row.title),
      detail: stripSoftware(row.detail),
    });
  }
  for (const row of snapshot.weaknesses) {
    points.push({
      id: `wk-${row.label}`,
      title: humanTitle(row.label),
      detail: stripSoftware(row.detail),
    });
  }
  if (snapshot.injuries.length > 0) {
    points.push({
      id: "injuries",
      title: "Absences",
      detail: `${snapshot.injuries.length} published absence${snapshot.injuries.length === 1 ? "" : "s"} on the desk.`,
    });
  }

  return takeUnique(points, 4);
}

function buildLive(
  snapshot: CopilotMatchSnapshot,
  tone: CopilotEvTone,
  call: CopilotCall,
): CopilotLiveOpportunity | null {
  if (snapshot.status === "finished") return null;
  if (tone === "positive" && call.startsWith("back_")) return null;

  const cues: string[] = [];
  const priced = bestPriced(snapshot);
  const fair = snapshot.decision?.value.fairOdds ?? priced?.fairOdds ?? null;
  const current = snapshot.decision?.value.impliedOdds ?? priced?.decimalOdds ?? null;

  if (fair != null && Number.isFinite(fair)) {
    cues.push(`Wait for a price longer than ${fair.toFixed(2)}.`);
  } else if (current != null && Number.isFinite(current)) {
    cues.push("Wait for the book to lengthen from the current price.");
  }

  if (snapshot.status === "live" && snapshot.liveState) {
    const { home, away } = snapshot.liveState;
    if (home === 0 && away === 0) {
      cues.push("Monitor if the score remains 0-0.");
    }
  } else if (snapshot.status === "scheduled") {
    cues.push("Monitor whether the favourite controls chances the way APEX expects.");
  }

  if (cues.length === 0) return null;
  return { cues: cues.slice(0, 3) };
}

function paragraph(
  snapshot: CopilotMatchSnapshot,
  call: CopilotCall,
  tone: CopilotEvTone,
): string {
  const pick = preferredName(snapshot);
  const other =
    snapshot.predictedOutcome === "away" ? snapshot.home.name : snapshot.away.name;

  if (call === "avoid") {
    return `${snapshot.home.name} against ${snapshot.away.name} does not offer a position APEX wants to take. The reading is too thin, too noisy, or already on the wrong side of the price. Stand aside.`;
  }

  if (call === "watch_live" || tone !== "positive") {
    return `${pick} is the stronger side according to APEX, but the market has already priced this advantage. There is no edge before kickoff. This is a match to monitor live rather than bet immediately.`;
  }

  if (tone === "positive") {
    return `${pick} is the side APEX wants, and the published price still leaves something on the table versus ${other}. That is the pre-match opportunity — size it only as far as confidence and risk allow.`;
  }

  return `${pick} is the side APEX prefers. Treat it as a reading, not a forced bet.`;
}

function confidenceWhy(
  snapshot: CopilotMatchSnapshot,
  band: CopilotIntelligence["confidenceBand"],
  risk: CopilotIntelligence["riskBand"],
): string {
  const missingLineups = snapshot.lineupsPublished === false;
  const thinForm =
    (snapshot.home.played != null && snapshot.home.played < 6) ||
    (snapshot.away.played != null && snapshot.away.played < 6);
  const openGame = snapshot.oneXTwo.draw >= 0.28;

  if (band === "high") {
    return "Confidence is high because enough of the match picture is published, and the sides are not a coin flip.";
  }
  if (band === "medium") {
    const extra = openGame
      ? "the draw is still very much alive"
      : risk === "medium"
        ? "risk is only contained, not quiet"
        : "parts of the squad picture are still thin";
    return `Confidence is medium. The lean is real, but ${extra}.`;
  }

  const drivers = [
    thinForm ? "the recent-form sample is small" : null,
    missingLineups ? "starting XIs are unpublished" : null,
    openGame ? "the three-way race is still wide" : null,
    risk === "high" ? "the risk reading is elevated" : null,
  ].filter(Boolean);
  const because =
    drivers.length > 0
      ? drivers.join(", ")
      : "too much of the match picture is still unpublished";
  return `Confidence is low because ${because}. This is not a match to treat as settled.`;
}

function humanTitle(raw: string): string {
  const text = raw.trim();
  if (/attack|xg|ofensiv|ataque/i.test(text)) return "Better attack";
  if (/defen|defens/i.test(text)) return "Better defensive projection";
  if (/home|local\b/i.test(text) && !/xg/i.test(text)) return "Home advantage";
  if (/form/i.test(text)) return "Better form";
  if (/tactic|tempo|press|táctic/i.test(text)) return "Tactical superiority";
  if (/rest|descanso/i.test(text)) return "Rest advantage";
  if (/value|edge|\bev\b/i.test(text)) return "Price still offers something";
  if (/injur|absent|baja/i.test(text)) return "Absences";
  if (/sample|coverage|unpublished|muestra/i.test(text)) return "Small sample";
  if (/volat|entropy|entrop|incertidumbre|draw|empate/i.test(text)) return "High variance";
  if (/market|mercado/i.test(text)) return "Market already tight";
  return text.replace(/[:.].*$/, "").trim() || text;
}

function stripSoftware(raw: string): string {
  return raw
    .replace(/\bP_modelo\b/gi, "the model")
    .replace(/\bEV\b/g, "value")
    .replace(/\b1X2\b/g, "match odds")
    .replace(/\([^)]*%[^)]*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildCopilotIntelligence(
  snapshot: CopilotMatchSnapshot,
): CopilotIntelligence {
  const tone = evTone(publishedEv(snapshot));
  const call = callFromSnapshot(snapshot, tone);
  const risk = riskBand(snapshot);
  const confidence = confidenceBand(snapshot);
  return {
    call,
    confidenceBand: confidence,
    riskBand: risk,
    evTone: tone,
    paragraph: paragraph(snapshot, call, tone),
    reasons: buildReasons(snapshot),
    concerns: buildConcerns(snapshot, tone, risk),
    live: buildLive(snapshot, tone, call),
    verdict: verdictFrom(snapshot, tone, risk, call),
    confidenceWhy: confidenceWhy(snapshot, confidence, risk),
  };
}
