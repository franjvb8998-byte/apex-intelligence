/**
 * Live Lite Match Center shell.
 * Identity + Vision live state. No PE, odds, or enrichment fan-out.
 */

import { parseTrackedFixtureId } from "@/lib/apex-vision/live/parse-id";
import type { LiveFixtureState } from "@/lib/apex-vision/live/types";
import type { MatchCenterLiveView } from "@/lib/apex-vision/live/view";
import type { VisionLiveState, VisionMarkets } from "@/lib/apex-vision/types";
import { apexIdFor } from "@/lib/data-platform/providers/_shared/demo-fixture";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { MatchAnalysis } from "@/lib/match-analysis/analysis-types";
import type { MatchAnalysisData } from "@/lib/match-analysis/types";
import { placeholderPreviewDashboard } from "@/lib/match-center/dashboard";
import { matchCenterStatusFromApex } from "@/lib/match-center/from-data-platform";
import { unevaluatedMatchCenterPost } from "@/lib/match-center/post-evaluation";
import type {
  MatchCenterData,
  MatchCenterMeta,
  MatchCenterPostData,
  MatchCenterPreviewData,
  MatchCenterTeam,
} from "@/lib/match-center/types";

const OMITTED_MARKETS: VisionMarkets = {
  homeWin: 0,
  draw: 0,
  awayWin: 0,
  over25: 0,
  btts: 0,
};

function shortName(name: string, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim().slice(0, 3).toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]!.slice(0, 2)).toUpperCase();
}

function omittedOneXTwo() {
  return { home: 0, draw: 0, away: 0 };
}

function omittedConfidence() {
  return { value: 0, band: "low" as const };
}

function omittedDecision(): MatchAnalysisData["decision"] {
  return {
    engineId: "deterministic-v1",
    predicted: "draw",
    selectionLabel: "unavailable",
    score: { value: 0, label: "unavailable", coverage: 0, components: [] },
    confidence: { value: 0, band: "low", caption: "Live Lite — PE not run" },
    risk: { score: 0, band: "low", reasons: [] },
    value: {
      modelProbability: 0,
      marketProbability: null,
      valuePct: null,
      expectedValue: null,
      fairOdds: null,
      impliedOdds: null,
      marketEdge: null,
      positiveEdge: false,
      negativeEdge: false,
    },
    sizing: {
      kellyFraction: null,
      kellyPct: null,
      stakePct: 0,
      stakeLabel: "pass",
    },
    verdict: { kind: "pass", label: "unavailable", stars: 0 },
    reasonsFor: [],
    reasonsAgainst: [],
    explanation: "Live Lite omitted Probability Engine and Decision Engine.",
  };
}

function omittedRating(): MatchAnalysisData["rating"] {
  return {
    overall: 0,
    label: "unavailable",
    confidence: omittedConfidence(),
    confidencePct: 0,
    risk: "low",
    valueRating: null,
    kellyFraction: null,
    recommendedKelly: null,
    kellyLabel: "unavailable",
    fairOdds: null,
    expectedValue: null,
    recommendation: "watch",
    recommendationLabel: "unavailable",
    selectionLabel: "unavailable",
    predictedOutcome: "draw",
    metrics: [],
    coverage: 0,
  };
}

function omittedReport(): MatchAnalysisData["report"] {
  return {
    verdict: {
      kind: "avoid",
      label: "unavailable",
      stars: 0,
      selectionLabel: "unavailable",
      predictedOutcome: "draw",
    },
    confidence: {
      value: 0,
      base: 0,
      band: "low",
      caption: "Live Lite — PE not run",
    },
    reasons: [],
    risks: [],
    market: {
      bookmakerOdds: null,
      bookmaker: null,
      fairOdds: null,
      modelProbability: 0,
      expectedValue: null,
      kellyPct: null,
      impliedProbability: null,
      marketEdge: null,
      flags: {
        positiveEv: false,
        negativeEv: false,
        overpriced: false,
        underpriced: false,
      },
    },
    recommendation: {
      kind: "pass",
      label: "unavailable",
      exposurePct: 0,
      exposureLabel: "pass",
    },
    narrative: "Live Lite omitted prematch PE, odds, and enrichment.",
    breakdown: [],
    metricsUsed: [],
  };
}

function omittedExplainable(matchId: string, generatedAt: string) {
  return {
    matchId,
    predictedOutcome: "draw" as const,
    predictedLabel: "unavailable",
    summary: "Live Lite omitted Explainable AI / PE.",
    confidence: omittedConfidence(),
    positiveFactors: [],
    negativeFactors: [],
    evidence: [],
    qualityScore: {
      value: 0,
      band: "low" as const,
      label: "unavailable",
      components: [],
    },
    generatedAt,
    method: "rules" as const,
  };
}

function omittedPreview(
  match: MatchCenterMeta,
  generatedAt: string,
): MatchCenterPreviewData {
  const analysis: MatchAnalysisData = {
    matchId: match.matchId,
    leagueName: match.leagueName,
    kickoffAt: match.kickoffAt,
    status: "live",
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    oneXTwo: omittedOneXTwo(),
    predictedOutcome: "draw",
    confidence: omittedConfidence(),
    apexScore: {
      value: 0,
      label: "unavailable",
      components: [],
    },
    rating: omittedRating(),
    decision: omittedDecision(),
    report: omittedReport(),
    markets: [],
    keyFactors: [],
    risks: [],
    explanation: {
      summary: "Live Lite omitted Probability Engine outputs.",
      factors: [],
      caveats: ["PRE-MATCH markets were not loaded."],
      narrative: "",
    },
    explainable: omittedExplainable(match.matchId, generatedAt),
    modelVersion: "live-lite-omitted",
    source: "data-platform",
    leaguePosition: { home: null, away: null },
    recentMatches: { home: [], away: [] },
    h2h: [],
    venueSplit: {
      home: { home: null, away: null },
      away: { home: null, away: null },
    },
    matchMetrics: { home: null, away: null },
    expectedGoals: { home: 0, away: 0, total: 0 },
    context: {
      weather: match.weather,
      referee: match.referee,
    },
  };

  return {
    analysis,
    eloInput: {
      homeElo: 0,
      awayElo: 0,
      homeTeamId: match.homeTeam.id,
      awayTeamId: match.awayTeam.id,
      matchId: match.matchId,
    },
    hybrid: {
      modelVersion: "live-lite-omitted",
      expectedGoals: { home: 0, away: 0, total: 0 },
      overUnder25: { line: 2.5, over: 0, under: 0 },
      btts: { yes: 0, no: 0 },
    },
    dashboard: placeholderPreviewDashboard({ yes: 0, no: 0 }),
    source: "data-platform",
    probabilitiesAvailable: false,
  };
}

function omittedAnalysis(matchId: string, generatedAt: string): MatchAnalysis {
  return {
    matchId,
    generatedAt,
    prediction: {
      outcome: "draw",
      label: "unavailable",
      oneXTwo: omittedOneXTwo(),
      modelVersion: "live-lite-omitted",
    },
    confidence: omittedConfidence(),
    strengths: [],
    weaknesses: [],
    tacticalFactors: [],
    recentForm: { home: null, away: null, summary: "Live Lite omitted form." },
    keyPlayers: [],
    injuries: [],
    expectedGoals: { home: 0, away: 0, total: 0 },
    riskLevel: "low",
    recommendation: {
      id: "live-lite-omitted",
      title: "unavailable",
      action: "watch",
      priority: "low",
      rationale: "Live Lite omitted AI match analysis.",
      confidence: omittedConfidence(),
    },
    valueBet: null,
    explainability: {
      summary: "Live Lite omitted PE and rule analysis.",
      factors: [],
    },
    explainable: omittedExplainable(matchId, generatedAt),
    source: {
      dataPlatform: true,
      probabilityEngine: false,
      reasoning: "rules",
    },
  };
}

function omittedPost(
  match: MatchCenterMeta,
  score: { home: number; away: number },
): MatchCenterPostData {
  return unevaluatedMatchCenterPost({
    at: match.kickoffAt,
    score,
    summary:
      "Live Lite omitted post-match PE comparison. Evaluation waits for a finished match (FT, AET, or PEN).",
  });
}

function visionFromLiveLite(input: {
  matchId: string;
  leagueName: string;
  home: MatchCenterTeam;
  away: MatchCenterTeam;
  score: { home: number; away: number };
  minute: number;
}): VisionLiveState {
  return {
    matchId: input.matchId,
    leagueName: input.leagueName,
    homeTeam: {
      id: input.home.id,
      name: input.home.name,
      shortName: input.home.shortName,
    },
    awayTeam: {
      id: input.away.id,
      name: input.away.name,
      shortName: input.away.shortName,
    },
    score: input.score,
    minute: input.minute,
    players: [],
    ball: { x: 50, y: 50 },
    momentum: 0,
    pressure: 50,
    pressureSide: "home",
    possessionHome: 50,
    markets: OMITTED_MARKETS,
    confidence: 0,
    risk: "low",
    riskLabel: "Live Lite — APEX heuristic only. PE not run.",
    aiInsight:
      "Live Lite: score, minute, status, and timeline come from Vision. PRE-MATCH markets were not loaded.",
    events: [],
    source: "data-platform",
  };
}

function finishLiveLite(
  match: MatchCenterMeta,
  view: MatchCenterLiveView | null,
  score: { home: number; away: number },
  minute: number,
): MatchCenterData {
  const generatedAt = view?.fetchedAtUtc ?? match.kickoffAt;
  const preview = omittedPreview(match, generatedAt);
  return {
    match,
    defaultPhase: "live",
    preview,
    live: {
      vision: visionFromLiveLite({
        matchId: match.matchId,
        leagueName: match.leagueName,
        home: match.homeTeam,
        away: match.awayTeam,
        score,
        minute,
      }),
      lineups: { home: null, away: null },
      source: "data-platform",
      fixtureId:
        parseTrackedFixtureId(match.externalId) ??
        parseTrackedFixtureId(match.matchId),
      catalogueLive: true,
      providerLive: view,
      loadMode: "live-lite",
    },
    post: omittedPost(match, score),
    aiAnalysis: omittedAnalysis(match.matchId, generatedAt),
    fixtures: [],
    source: "platform",
    liveLite: true,
  };
}

export function buildMatchCenterLiveLiteFromBundle(
  bundle: ApexMatchBundle,
  view: MatchCenterLiveView | null,
): MatchCenterData {
  const status = matchCenterStatusFromApex(bundle.match.status);
  const home: MatchCenterTeam = {
    id: bundle.homeTeam.id,
    name: bundle.homeTeam.name,
    shortName: shortName(bundle.homeTeam.name, bundle.homeTeam.shortName),
    logoUrl: bundle.homeTeam.crestUrl,
  };
  const away: MatchCenterTeam = {
    id: bundle.awayTeam.id,
    name: bundle.awayTeam.name,
    shortName: shortName(bundle.awayTeam.name, bundle.awayTeam.shortName),
    logoUrl: bundle.awayTeam.crestUrl,
  };
  const match: MatchCenterMeta = {
    matchId: bundle.match.id,
    externalId: bundle.match.externalRefs[0]?.externalId ?? null,
    leagueName: bundle.league?.name ?? view?.homeTeamName ?? "Football",
    kickoffAt: bundle.match.kickoffAt,
    status: status === "live" ? "live" : status,
    homeTeam: home,
    awayTeam: away,
    venue: bundle.match.venue
      ? {
          name: bundle.match.venue.name,
          city: bundle.match.venue.city,
          country: bundle.match.venue.country,
        }
      : null,
    referee: bundle.match.referee ?? null,
    attendance: bundle.match.attendance ?? null,
    weather: bundle.match.weather ?? null,
    source: "data-platform",
    providerLabel:
      bundle.provenance.primaryProvider === "api-football"
        ? "API-Football"
        : bundle.provenance.primaryProvider,
  };
  const score = {
    home: view?.homeGoals ?? bundle.match.score.home ?? 0,
    away: view?.awayGoals ?? bundle.match.score.away ?? 0,
  };
  const minute = view?.elapsed ?? bundle.match.minute ?? 0;
  if (view?.homeTeamName) match.homeTeam.name = view.homeTeamName;
  if (view?.awayTeamName) match.awayTeam.name = view.awayTeamName;
  return finishLiveLite(match, view, score, minute);
}

export function buildMatchCenterLiveLiteFromVision(
  view: MatchCenterLiveView,
  state: LiveFixtureState | null,
): MatchCenterData {
  const fixtureId = view.fixtureId;
  const homeName = view.homeTeamName ?? "Home";
  const awayName = view.awayTeamName ?? "Away";
  const home: MatchCenterTeam = {
    id:
      view.homeTeamId != null
        ? apexIdFor("api-football", "team", String(view.homeTeamId))
        : `apex:api-football:team:slot:home:${fixtureId}`,
    name: homeName,
    shortName: shortName(homeName),
    logoUrl: null,
  };
  const away: MatchCenterTeam = {
    id:
      view.awayTeamId != null
        ? apexIdFor("api-football", "team", String(view.awayTeamId))
        : `apex:api-football:team:slot:away:${fixtureId}`,
    name: awayName,
    shortName: shortName(awayName),
    logoUrl: null,
  };
  const match: MatchCenterMeta = {
    matchId: apexIdFor("api-football", "match", String(fixtureId)),
    externalId: String(fixtureId),
    leagueName: state?.leagueName ?? "Football",
    kickoffAt: state?.kickoffUtc ?? view.fetchedAtUtc ?? new Date(0).toISOString(),
    status: "live",
    homeTeam: home,
    awayTeam: away,
    venue: null,
    referee: null,
    attendance: null,
    weather: null,
    source: "data-platform",
    providerLabel: "API-Football",
  };
  const score = {
    home: view.homeGoals ?? 0,
    away: view.awayGoals ?? 0,
  };
  const minute = view.elapsed ?? 0;
  return finishLiveLite(match, view, score, minute);
}
