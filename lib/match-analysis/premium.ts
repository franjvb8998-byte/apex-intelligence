/**
 * Match Analysis Premium v3 — presentation map over published engines.
 * Does not re-score, re-size, or invent catalogue facts.
 */

import { buildApexBrainBriefing } from "@/lib/apex-brain";
import { pct, signedPct } from "@/lib/apex-brain/format";
import type { ApexRiskBand } from "@/lib/decision-engine/types";
import type { ScoringTier } from "@/lib/scoring-engine/types";
import type { PublishedScore } from "@/lib/team-intelligence/types";
import type { TeamIntelligence } from "@/lib/team-intelligence/models";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";

export type PremiumRecKind =
  | "highestConfidence"
  | "bestValue"
  | "safest"
  | "aggressive"
  | "longshot"
  | "avoid";

export type PremiumRecommendation = {
  kind: PremiumRecKind;
  market: string;
  selection: string;
  confidence: number | null;
  riskBand: ApexRiskBand | null;
  expectedValue: number | null;
  odds: number | null;
  explanation: string;
  primary: boolean;
};

export type PremiumContribution = {
  key: string;
  polarity: "plus" | "minus";
  title: string;
  score: number | null;
  detail: string;
};

export type PremiumCompareKey =
  | "attack"
  | "defense"
  | "pressing"
  | "transitions"
  | "setPieces"
  | "momentum"
  | "morale"
  | "fatigue"
  | "squadDepth"
  | "coachStability";

export type PremiumCompareRow = {
  key: PremiumCompareKey;
  home: number | null;
  away: number | null;
};

export type PremiumContextTitleKey =
  | "rest"
  | "weather"
  | "referee"
  | "injuries"
  | "suspensions"
  | "congestion"
  | "travel"
  | "motivation"
  | "transfers"
  | "engineRisk";

export type PremiumContextFactor = {
  id: string;
  polarity: "plus" | "minus" | "info";
  titleKey: PremiumContextTitleKey;
  detail: string;
};

export type PremiumMarketMove = "underpriced" | "overpriced" | "fair" | "unpriced";

export type PremiumEvidenceId =
  | "statistics"
  | "tactical"
  | "market"
  | "teamIntelligence"
  | "context"
  | "news";

export type PremiumEvidenceSignal = {
  id: PremiumEvidenceId;
  aligned: boolean;
};

export type PremiumAnalysis = {
  selectionLabel: string;
  tier: ScoringTier;
  score: number;
  confidence: number;
  confidenceBand: "low" | "medium" | "high";
  confidenceCaption: string;
  riskBand: ApexRiskBand;
  riskScore: number;
  expectedValue: number | null;
  fairOdds: number | null;
  bookmakerOdds: number | null;
  bookmaker: string | null;
  recommendations: PremiumRecommendation[];
  contributions: PremiumContribution[];
  comparison: PremiumCompareRow[];
  context: PremiumContextFactor[];
  market: {
    /** Catalogue never publishes an opening line. Always null. */
    openingOdds: null;
    currentOdds: number | null;
    fairOdds: number | null;
    expectedValue: number | null;
    modelProbability: number;
    impliedProbability: number | null;
    move: PremiumMarketMove;
  };
  summary: string;
  evidence: {
    signals: PremiumEvidenceSignal[];
    aligned: number;
    total: number;
  };
};

type PricedSelection = {
  market: string;
  selection: string;
  probability: number;
  odds: number | null;
  expectedValue: number | null;
  primary: boolean;
};

function ev(probability: number, odds: number | null): number | null {
  if (odds == null || !Number.isFinite(odds) || odds <= 1) return null;
  if (!Number.isFinite(probability) || probability <= 0) return null;
  return probability * odds - 1;
}

function priceRisk(probability: number, odds: number | null): ApexRiskBand {
  if ((odds != null && odds >= 3.5) || probability < 0.25) return "high";
  if ((odds != null && odds >= 2.2) || probability < 0.4) return "medium";
  return "low";
}

function oneXTwoLabel(
  key: string,
  data: MatchAnalysisData,
): string {
  if (key === "home") return data.homeTeam.name;
  if (key === "away") return data.awayTeam.name;
  return "Draw";
}

function collectPriced(data: MatchAnalysisData): PricedSelection[] {
  const primaryKey =
    data.predictedOutcome === "home"
      ? "home"
      : data.predictedOutcome === "away"
        ? "away"
        : "draw";
  const rows: PricedSelection[] = [];

  const oneXTwo = data.markets.find((market) => market.type === "1x2");
  const outcomes: Array<{ key: "home" | "draw" | "away"; probability: number }> = [
    { key: "home", probability: data.oneXTwo.home },
    { key: "draw", probability: data.oneXTwo.draw },
    { key: "away", probability: data.oneXTwo.away },
  ];
  for (const outcome of outcomes) {
    const quoted = oneXTwo?.selections.find((row) => row.key === outcome.key);
    const odds =
      quoted?.decimalOdds ??
      (outcome.key === primaryKey ? data.decision.value.impliedOdds : null);
    rows.push({
      market: "1x2",
      selection: oneXTwoLabel(outcome.key, data),
      probability: outcome.probability,
      odds,
      expectedValue: ev(outcome.probability, odds),
      primary: outcome.key === primaryKey,
    });
  }

  for (const market of data.markets) {
    if (market.type === "1x2") continue;
    for (const selection of market.selections) {
      rows.push({
        market: market.type,
        selection: `${market.label} · ${selection.label}`,
        probability: selection.probability,
        odds: selection.decimalOdds ?? null,
        expectedValue: ev(selection.probability, selection.decimalOdds ?? null),
        primary: false,
      });
    }
  }

  return rows;
}

function pickBest(
  rows: PricedSelection[],
  score: (row: PricedSelection) => number | null,
): PricedSelection | null {
  let best: PricedSelection | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const value = score(row);
    if (value == null || !Number.isFinite(value)) continue;
    if (value > bestScore) {
      best = row;
      bestScore = value;
    }
  }
  return best;
}

function recExplanation(
  kind: PremiumRecKind,
  row: PricedSelection,
  data: MatchAnalysisData,
): string {
  const pick = row.selection;
  const modelP = pct(row.probability);
  const evLine =
    row.expectedValue == null
      ? "expected value is unpublished"
      : `expected value ${signedPct(row.expectedValue)}`;
  const oddsLine =
    row.odds == null
      ? "no bookmaker price is published"
      : `priced at ${row.odds.toFixed(2)}`;

  switch (kind) {
    case "highestConfidence":
      return `${data.decision.confidence.caption} on ${pick}. Model probability ${modelP}, ${oddsLine}, ${evLine}.`;
    case "bestValue":
      return `${pick} carries the strongest published edge (${evLine}), ${oddsLine}.`;
    case "safest":
      return `${pick} is the shortest published price among non-negative EV selections, ${oddsLine}.`;
    case "aggressive":
      return `${pick} is a longer-priced selection with positive published edge, ${oddsLine}, ${evLine}.`;
    case "longshot":
      return `${pick} is the longest published price still assigned a material model probability (${modelP}), ${oddsLine}.`;
    case "avoid":
      return `Stand aside on ${pick}: ${evLine}, model probability ${modelP}, ${oddsLine}.`;
  }
}

function toRec(
  kind: PremiumRecKind,
  row: PricedSelection,
  data: MatchAnalysisData,
): PremiumRecommendation {
  const primary = row.primary;
  const expectedValue = primary
    ? data.decision.value.expectedValue
    : row.expectedValue;
  const odds = primary ? data.decision.value.impliedOdds : row.odds;
  const explained: PricedSelection = { ...row, expectedValue, odds };
  return {
    kind,
    market: row.market,
    selection: row.selection,
    confidence: primary
      ? data.decision.confidence.value
      : Math.round(row.probability * 100),
    riskBand: primary ? data.decision.risk.band : priceRisk(row.probability, row.odds),
    expectedValue,
    odds,
    explanation: recExplanation(kind, explained, data),
    primary,
  };
}

function buildRecommendations(data: MatchAnalysisData): PremiumRecommendation[] {
  const priced = collectPriced(data);
  const primary =
    priced.find((row) => row.primary) ??
    ({
      market: "1x2",
      selection: data.decision.selectionLabel,
      probability: data.decision.value.modelProbability,
      odds: data.decision.value.impliedOdds,
      expectedValue: data.decision.value.expectedValue,
      primary: true,
    } satisfies PricedSelection);

  const out: PremiumRecommendation[] = [
    toRec("highestConfidence", primary, data),
  ];

  const bestValue = pickBest(priced, (row) => row.expectedValue);
  if (bestValue && (bestValue.expectedValue ?? 0) > 0) {
    out.push(toRec("bestValue", bestValue, data));
  }

  const safest = pickBest(
    priced.filter((row) => (row.expectedValue ?? 0) >= 0 && row.odds != null),
    (row) => (row.odds == null ? null : 1 / row.odds + row.probability),
  );
  if (safest) out.push(toRec("safest", safest, data));

  const aggressive = pickBest(
    priced.filter((row) => (row.expectedValue ?? 0) > 0 && (row.odds ?? 0) >= 2.2),
    (row) => row.expectedValue,
  );
  if (aggressive) out.push(toRec("aggressive", aggressive, data));

  const longshot = pickBest(
    priced.filter((row) => (row.odds ?? 0) >= 3 && row.probability >= 0.08),
    (row) => row.odds,
  );
  if (longshot) out.push(toRec("longshot", longshot, data));

  const avoid = priced
    .filter((row) => {
      if (row.primary) return (row.expectedValue ?? 0) < 0;
      if ((row.expectedValue ?? 0) < 0) return true;
      if (row.market === "1x2") return row.expectedValue == null || row.expectedValue <= 0;
      return row.probability < 0.28;
    })
    .sort((a, b) => {
      const group = Number(a.market !== "1x2") - Number(b.market !== "1x2");
      if (group !== 0) return group;
      return (a.expectedValue ?? 0) - (b.expectedValue ?? 0) || a.probability - b.probability;
    })
    .slice(0, 3);
  for (const row of avoid) {
    out.push(toRec("avoid", row, data));
  }

  if (
    data.scoring?.recommendation.tier === "Avoid" &&
    !out.some((row) => row.kind === "avoid" && row.primary)
  ) {
    out.push(toRec("avoid", primary, data));
  }

  return out;
}

function buildContributions(data: MatchAnalysisData): PremiumContribution[] {
  const rows: PremiumContribution[] = [];
  for (const component of data.decision.score.components) {
    if (!component.available || component.score == null) continue;
    const downward = component.key === "injuries" || component.key === "riskAdjustment";
    const plus = !downward && component.score >= 55;
    const minus = downward || component.score < 45;
    if (!plus && !minus) continue;
    rows.push({
      key: component.key,
      polarity: plus ? "plus" : "minus",
      title: component.label,
      score: component.score,
      detail: component.note,
    });
  }
  return rows;
}

function published(score: PublishedScore | undefined): number | null {
  if (!score?.available || score.value == null || !Number.isFinite(score.value)) {
    return null;
  }
  return Math.round(score.value);
}

function compareRow(
  key: PremiumCompareKey,
  home: number | null,
  away: number | null,
): PremiumCompareRow | null {
  if (home == null && away == null) return null;
  return { key, home, away };
}

function buildComparison(data: MatchAnalysisData): PremiumCompareRow[] {
  const home = data.twins?.home;
  const away = data.twins?.away;
  const rows: Array<PremiumCompareRow | null> = [
    compareRow(
      "attack",
      published(home?.tactical.attackingStrength) ?? published(home?.scores.attack),
      published(away?.tactical.attackingStrength) ?? published(away?.scores.attack),
    ),
    compareRow(
      "defense",
      published(home?.tactical.defensiveStrength) ?? published(home?.scores.defense),
      published(away?.tactical.defensiveStrength) ?? published(away?.scores.defense),
    ),
    compareRow(
      "pressing",
      published(home?.tactical.pressingIntensity),
      published(away?.tactical.pressingIntensity),
    ),
    compareRow(
      "transitions",
      published(home?.tactical.counterAttackRating),
      published(away?.tactical.counterAttackRating),
    ),
    compareRow(
      "setPieces",
      published(home?.tactical.setPieceRating),
      published(away?.tactical.setPieceRating),
    ),
    compareRow(
      "momentum",
      published(home?.momentum.current) ?? published(home?.scores.momentum),
      published(away?.momentum.current) ?? published(away?.scores.momentum),
    ),
    compareRow(
      "morale",
      published(home?.form.last5Quality) ?? published(home?.scores.motivation),
      published(away?.form.last5Quality) ?? published(away?.scores.motivation),
    ),
    compareRow(
      "fatigue",
      published(home?.health.fatigue),
      published(away?.health.fatigue),
    ),
    compareRow(
      "squadDepth",
      published(home?.health.squadDepth),
      published(away?.health.squadDepth),
    ),
    compareRow(
      "coachStability",
      coachStability(home),
      coachStability(away),
    ),
  ];

  const publishedRows = rows.filter((row): row is PremiumCompareRow => row != null);
  if (publishedRows.length > 0) return publishedRows;

  const homeXg = data.expectedGoals.home;
  const awayXg = data.expectedGoals.away;
  const maxXg = Math.max(homeXg, awayXg, 0.01);
  return [
    {
      key: "attack",
      home: Math.round((homeXg / maxXg) * 100),
      away: Math.round((awayXg / maxXg) * 100),
    },
  ];
}

function coachStability(twin: TeamIntelligence | undefined): number | null {
  const changes = twin?.transfers.managerChanges;
  if (!changes?.available || changes.value == null) return null;
  return changes.value ? 35 : 82;
}

function buildContext(data: MatchAnalysisData): PremiumContextFactor[] {
  const factors: PremiumContextFactor[] = [];
  const home = data.twins?.home;
  const away = data.twins?.away;

  const restHome = home?.schedule.restDays;
  const restAway = away?.schedule.restDays;
  if (restHome?.available && restHome.value != null) {
    const other = restAway?.available ? restAway.value : null;
    const plus = other == null || restHome.value >= other;
    factors.push({
      id: "rest",
      polarity: plus ? "plus" : "minus",
      titleKey: "rest",
      detail: restHome.note,
    });
  }

  const weather = data.context?.weather ?? home?.environment.weather.value ?? null;
  if (weather) {
    factors.push({
      id: "weather",
      polarity: /rain|storm|wind|snow/i.test(weather) ? "minus" : "info",
      titleKey: "weather",
      detail: weather,
    });
  }

  const referee = data.context?.referee ?? home?.environment.refereeName.value ?? null;
  if (referee) {
    factors.push({
      id: "referee",
      polarity: "info",
      titleKey: "referee",
      detail: referee,
    });
  }

  const injuries = (home?.health.injuries.value ?? 0) + (away?.health.injuries.value ?? 0);
  if (
    (home?.health.injuries.available || away?.health.injuries.available) &&
    injuries > 0
  ) {
    factors.push({
      id: "injuries",
      polarity: "minus",
      titleKey: "injuries",
      detail: home?.health.injuries.note ?? `${injuries} published absences.`,
    });
  }

  const bans = (home?.health.suspensions.value ?? 0) + (away?.health.suspensions.value ?? 0);
  if (
    (home?.health.suspensions.available || away?.health.suspensions.available) &&
    bans > 0
  ) {
    factors.push({
      id: "suspensions",
      polarity: "minus",
      titleKey: "suspensions",
      detail: home?.health.suspensions.note ?? `${bans} published bans.`,
    });
  }

  const congestion =
    home?.schedule.fixtureCongestion.value === true ||
    away?.schedule.fixtureCongestion.value === true;
  if (
    home?.schedule.fixtureCongestion.available ||
    away?.schedule.fixtureCongestion.available
  ) {
    if (congestion) {
      factors.push({
        id: "congestion",
        polarity: "minus",
        titleKey: "congestion",
        detail:
          home?.schedule.fixtureCongestion.note ??
          "Published fixture congestion on this desk.",
      });
    }
  }

  const travel = away?.schedule.travelDistance;
  if (travel?.available && travel.value != null && travel.value > 0) {
    factors.push({
      id: "travel",
      polarity: "info",
      titleKey: "travel",
      detail: travel.note,
    });
  }

  const motivation = home?.motivation.tournamentPriority;
  if (motivation?.available && motivation.value) {
    factors.push({
      id: "motivation",
      polarity: "plus",
      titleKey: "motivation",
      detail: motivation.note,
    });
  }

  const transfers =
    (home?.transfers.incomingTransfers.value ?? 0) +
    (home?.transfers.outgoingTransfers.value ?? 0) +
    (away?.transfers.incomingTransfers.value ?? 0) +
    (away?.transfers.outgoingTransfers.value ?? 0);
  if (
    (home?.transfers.incomingTransfers.available ||
      away?.transfers.incomingTransfers.available) &&
    transfers > 0
  ) {
    factors.push({
      id: "transfers",
      polarity: "info",
      titleKey: "transfers",
      detail: home?.transfers.incomingTransfers.note ?? `${transfers} published moves.`,
    });
  }

  for (const risk of data.decision.risk.reasons) {
    if (factors.some((row) => row.id === risk.id)) continue;
    factors.push({
      id: risk.id,
      polarity: "minus",
      titleKey: "engineRisk",
      detail: `${risk.title}. ${risk.detail}`,
    });
  }

  return factors.slice(0, 8);
}

function marketMove(data: MatchAnalysisData): PremiumMarketMove {
  if (data.decision.value.impliedOdds == null) return "unpriced";
  if (data.decision.value.positiveEdge) return "underpriced";
  if (data.decision.value.negativeEdge) return "overpriced";
  return "fair";
}

function buildEvidence(data: MatchAnalysisData): PremiumAnalysis["evidence"] {
  const stats =
    data.recentMatches.home.length > 0 ||
    data.leaguePosition.home != null ||
    data.matchMetrics.home != null;
  const tactical = data.decision.score.components.some(
    (row) =>
      (row.key === "attack" || row.key === "defense" || row.key === "xg") &&
      row.available,
  );
  const market = data.decision.value.impliedOdds != null;
  const teamIntelligence = (data.twins?.home.scores.coverage ?? 0) > 0.15;
  const context =
    Boolean(data.context?.weather) ||
    Boolean(data.context?.referee) ||
    data.decision.score.components.some(
      (row) => (row.key === "rest" || row.key === "injuries") && row.available,
    );
  const news =
    (data.twins?.home.health.injuries.available ?? false) ||
    (data.twins?.home.health.suspensions.available ?? false) ||
    data.risks.some((row) => /injur|suspen|absent/i.test(`${row.title} ${row.detail}`));

  const signals: PremiumEvidenceSignal[] = [
    { id: "statistics", aligned: stats },
    { id: "tactical", aligned: tactical },
    { id: "market", aligned: market },
    { id: "teamIntelligence", aligned: teamIntelligence },
    { id: "context", aligned: context },
    { id: "news", aligned: news },
  ];
  const aligned = signals.filter((row) => row.aligned).length;
  return { signals, aligned, total: signals.length };
}

export function buildPremiumAnalysis(data: MatchAnalysisData): PremiumAnalysis {
  const scoring =
    data.scoring ??
    ({
      engineId: "scoring-v2" as const,
      selectionId: data.matchId,
      selectionLabel: data.decision.selectionLabel,
      overall: data.decision.score.value,
      coverage: data.decision.score.coverage,
      components: [],
      recommendation: {
        tier: "Watch" as ScoringTier,
        stars: data.decision.verdict.stars,
        note: data.decision.verdict.label,
      },
      explanation: {
        summary: data.decision.explanation,
        overall: data.decision.score.value,
        coverage: data.decision.score.coverage,
        recommendation: "Watch" as ScoringTier,
        supporting: [],
        against: [],
      },
    });
  const briefing = buildApexBrainBriefing(data.decision, scoring);

  return {
    selectionLabel: scoring.selectionLabel,
    tier: scoring.recommendation.tier,
    score: Math.round(scoring.overall),
    confidence: data.decision.confidence.value,
    confidenceBand: data.decision.confidence.band,
    confidenceCaption: data.decision.confidence.caption,
    riskBand: data.decision.risk.band,
    riskScore: data.decision.risk.score,
    expectedValue: data.decision.value.expectedValue,
    fairOdds: data.decision.value.fairOdds,
    bookmakerOdds: data.decision.value.impliedOdds,
    bookmaker: data.report.market.bookmaker,
    recommendations: buildRecommendations(data),
    contributions: buildContributions(data),
    comparison: buildComparison(data),
    context: buildContext(data),
    market: {
      openingOdds: null,
      currentOdds: data.decision.value.impliedOdds,
      fairOdds: data.decision.value.fairOdds,
      expectedValue: data.decision.value.expectedValue,
      modelProbability: data.decision.value.modelProbability,
      impliedProbability: data.decision.value.marketProbability,
      move: marketMove(data),
    },
    summary: briefing.executiveSummary,
    evidence: buildEvidence(data),
  };
}

