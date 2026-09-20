/**
 * ApexMatchBundle → MatchCenterData (UI view-model).
 * Consumes Data Platform + Probability Engine public APIs only.
 * Does not modify PE or Learning Engine.
 */

import {
  buildProbabilityImpact,
  buildTimelineIntelligence,
} from "@/lib/apex-vision";
import { parseTrackedFixtureId } from "@/lib/apex-vision/live/parse-id";
import type {
  PitchPoint,
  VisionEventType,
  VisionLiveEvent,
  VisionLiveState,
  VisionMarkets,
  VisionPlayer,
  VisionSide,
} from "@/lib/apex-vision/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApexMatchEvent } from "@/lib/data-platform/types/event";
import type { ApexMatchStatus } from "@/lib/data-platform/types/match";
import type { ApexPlayer } from "@/lib/data-platform/types/team";
import {
  buildProbabilityDiagnostic,
  isProbabilityDiagnosticEnabled,
  maybeEmitProbabilityDiagnostic,
  type EloDerivation,
  type ProbabilityDiagnosticContext,
  type ProbabilityDiagnosticEnv,
  type ProbabilityDiagnosticLog,
} from "@/lib/debug/probability-diagnostic";
import {
  measurePhaseSync,
  scannerProfileActive,
} from "@/lib/debug/scanner-profile";
import type { MatchOutcome } from "@/lib/intelligence/types";
import {
  createEloPoissonHybridEngine,
  estimateEloFromTeamId,
  type HybridProbabilityResult,
} from "@/lib/intelligence/modules/probability";
import type { MatchAnalysisTeamStatSnapshot } from "@/lib/match-analysis/analysis-types";
import { createMatchAnalysisService } from "@/lib/match-analysis/match-analysis-service";
import { buildPreviewDashboard } from "@/lib/match-center/dashboard";
import {
  absencesToAnalysisInjuries,
  type MatchCenterEnrichment,
} from "@/lib/match-center/enrich";
import { buildIntelligenceReport } from "@/lib/intelligence-report";
import { unevaluatedMatchCenterPost } from "@/lib/match-center/post-evaluation";
import { buildPreviewFromHybrid } from "@/lib/match-center/from-probability";
import { scoreMatchSelection, apexScoreFromScoring } from "@/lib/scoring-engine/from-match";
import { selectionTwinFromPreview } from "@/lib/team-intelligence/builders";
import { ratePreview } from "@/lib/match-rating";
import type {
  MatchCenterData,
  MatchCenterLiveData,
  MatchCenterMeta,
  MatchCenterPhase,
  MatchCenterPostData,
  MatchCenterTeam,
} from "@/lib/match-center/types";

function shortName(name: string, fallback: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim().slice(0, 3).toUpperCase();
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]!.slice(0, 2)).toUpperCase();
}

export function matchCenterStatusFromApex(
  status: ApexMatchStatus,
): MatchCenterMeta["status"] {
  if (status === "live") return "live";
  if (status === "finished") return "finished";
  if (status === "postponed") return "postponed";
  if (status === "cancelled") return "cancelled";
  if (status === "suspended") return "suspended";
  if (status === "unknown") return "unknown";
  return "scheduled";
}

function phaseFromStatus(status: MatchCenterMeta["status"]): MatchCenterPhase {
  if (status === "live") return "live";
  if (status === "finished") return "post";
  return "preview";
}

function outcomeFromScore(
  home: number,
  away: number,
): MatchOutcome {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

/**
 * Missing-stat Elo prior (Sprint 5B.1). Re-exported from the PE helper.
 * Team ids are not used as strength.
 */
export { estimateEloFromTeamId };

function hasPlayed(snapshot?: MatchAnalysisTeamStatSnapshot | null): boolean {
  return snapshot != null && snapshot.played != null && snapshot.played > 0;
}

/**
 * Production Elo for one side, plus provenance for Sprint 5A diagnostics.
 * Numeric result is identical to the previous eloFromCatalogue / explicit override.
 */
export function resolveEloWithProvenance(
  snapshot: MatchAnalysisTeamStatSnapshot | null | undefined,
  teamId: string,
  base: number,
  explicit?: number,
): EloDerivation {
  if (explicit != null) {
    return {
      elo: explicit,
      source: "explicit",
      base: null,
      played: null,
      wins: null,
      goalsFor: null,
      goalsAgainst: null,
      goalDifference: null,
      hashOffset: null,
    };
  }
  if (!hasPlayed(snapshot)) {
    const elo = estimateEloFromTeamId(teamId, base);
    return {
      elo,
      source: "base_prior",
      base,
      played: snapshot?.played ?? null,
      wins: snapshot?.wins ?? null,
      goalsFor: snapshot?.goalsFor ?? null,
      goalsAgainst: snapshot?.goalsAgainst ?? null,
      goalDifference: null,
      hashOffset: null,
    };
  }
  const played = snapshot!.played!;
  const winRate = (snapshot!.wins ?? 0) / played;
  const goalDiff =
    (snapshot!.goalsFor ?? 0) - (snapshot!.goalsAgainst ?? 0);
  const clampedDiff = Math.max(-30, Math.min(30, goalDiff));
  return {
    elo: Math.round(base - 80 + winRate * 220 + clampedDiff * 2.5),
    source: "catalogue",
    base,
    played,
    wins: snapshot!.wins ?? null,
    goalsFor: snapshot!.goalsFor ?? null,
    goalsAgainst: snapshot!.goalsAgainst ?? null,
    goalDifference: goalDiff,
    hashOffset: null,
  };
}

const HOME_SLOTS: PitchPoint[] = [
  { x: 8, y: 50 },
  { x: 22, y: 18 },
  { x: 20, y: 38 },
  { x: 20, y: 62 },
  { x: 22, y: 82 },
  { x: 35, y: 30 },
  { x: 34, y: 50 },
  { x: 35, y: 70 },
  { x: 48, y: 22 },
  { x: 52, y: 50 },
  { x: 48, y: 78 },
];

const AWAY_SLOTS: PitchPoint[] = [
  { x: 92, y: 50 },
  { x: 78, y: 18 },
  { x: 80, y: 38 },
  { x: 80, y: 62 },
  { x: 78, y: 82 },
  { x: 65, y: 30 },
  { x: 66, y: 50 },
  { x: 65, y: 70 },
  { x: 52, y: 22 },
  { x: 55, y: 48 },
  { x: 52, y: 78 },
];

function positionRank(position: ApexPlayer["position"]): number {
  if (position === "goalkeeper") return 0;
  if (position === "defender") return 1;
  if (position === "midfielder") return 2;
  if (position === "forward") return 3;
  return 4;
}

function visionPlayersFromBundle(bundle: ApexMatchBundle): VisionPlayer[] {
  const place = (
    side: VisionSide,
    teamId: string,
    slots: PitchPoint[],
  ): VisionPlayer[] => {
    const squad = bundle.players
      .filter((player) => player.teamId === teamId)
      .sort((a, b) => positionRank(a.position) - positionRank(b.position))
      .slice(0, 11);
    return squad.map((player, index) => ({
      id: player.id,
      side,
      number: player.shirtNumber ?? index + 1,
      name: player.name,
      position: slots[index] ?? { x: side === "home" ? 30 : 70, y: 50 },
    }));
  };

  return [
    ...place("home", bundle.homeTeam.id, HOME_SLOTS),
    ...place("away", bundle.awayTeam.id, AWAY_SLOTS),
  ];
}

export function mapApexEventTypeToVisionType(
  type: ApexMatchEvent["type"],
): VisionEventType {
  switch (type) {
    case "goal":
    case "own_goal":
    case "penalty_goal":
    case "penalty_miss":
      return "disparo";
    case "yellow_card":
    case "red_card":
      return "tarjeta";
    case "substitution":
      return "cambio";
    case "var":
      return "falta";
    default:
      return "other";
  }
}

function eventLabel(type: ApexMatchEvent["type"]): string {
  switch (type) {
    case "goal":
      return "Gol";
    case "own_goal":
      return "Gol en propia";
    case "penalty_goal":
      return "Penalti";
    case "penalty_miss":
      return "Penalti fallado";
    case "yellow_card":
      return "Amarilla";
    case "red_card":
      return "Roja";
    case "substitution":
      return "Cambio";
    case "var":
      return "VAR";
    case "other":
    default:
      return "OTRO";
  }
}

function marketsFromPreview(
  preview: MatchCenterData["preview"],
): VisionMarkets {
  return {
    homeWin: preview.analysis.oneXTwo.home,
    draw: preview.analysis.oneXTwo.draw,
    awayWin: preview.analysis.oneXTwo.away,
    over25: preview.hybrid.overUnder25.over,
    btts: preview.hybrid.btts.yes,
  };
}

function visionEventsFromBundle(
  bundle: ApexMatchBundle,
  markets: VisionMarkets,
): VisionLiveEvent[] {
  return bundle.events.slice(-12).map((event) => {
    const side: VisionSide =
      event.teamId === bundle.awayTeam.id ? "away" : "home";
    const type = mapApexEventTypeToVisionType(event.type);
    const momentumDelta =
      type === "disparo" ? 6 : type === "tarjeta" ? -3 : type === "cambio" ? 1 : 0;
    const signed = side === "home" ? momentumDelta : -momentumDelta;
    const intel = buildTimelineIntelligence({
      type,
      side,
      homeName: bundle.homeTeam.name,
      awayName: bundle.awayTeam.name,
      momentumDelta: signed,
      before: markets,
      after: markets,
    });
    const playerName =
      typeof event.payload.playerName === "string"
        ? event.payload.playerName
        : null;
    return {
      id: event.id,
      minute: event.minute ?? 0,
      type,
      side,
      label: eventLabel(event.type),
      detail: playerName ?? eventLabel(event.type),
      ballTo:
        side === "home" ? { x: 72, y: 42 } : { x: 28, y: 58 },
      aiExplanation: intel.aiExplanation,
      momentumDelta: signed,
      probabilityImpact: buildProbabilityImpact(markets, markets),
      marketsAfter: markets,
      whyChanged: intel.whyChanged,
    };
  });
}

function buildLiveFromBundle(
  bundle: ApexMatchBundle,
  preview: MatchCenterData["preview"],
): MatchCenterLiveData {
  const homeShort = shortName(
    bundle.homeTeam.name,
    bundle.homeTeam.shortName,
  );
  const awayShort = shortName(
    bundle.awayTeam.name,
    bundle.awayTeam.shortName,
  );
  const markets = marketsFromPreview(preview);
  const events = visionEventsFromBundle(bundle, markets);
  const homeGoals = bundle.match.score.home ?? 0;
  const awayGoals = bundle.match.score.away ?? 0;
  const lastEvent = events[events.length - 1];
  const vision: VisionLiveState = {
    matchId: bundle.match.id,
    leagueName: bundle.league?.name ?? "Football",
    homeTeam: {
      id: bundle.homeTeam.id,
      name: bundle.homeTeam.name,
      shortName: homeShort,
    },
    awayTeam: {
      id: bundle.awayTeam.id,
      name: bundle.awayTeam.name,
      shortName: awayShort,
    },
    score: { home: homeGoals, away: awayGoals },
    minute: bundle.match.minute ?? lastEvent?.minute ?? 0,
    players: visionPlayersFromBundle(bundle),
    ball: lastEvent?.ballTo ?? { x: 50, y: 50 },
    momentum: Math.max(-100, Math.min(100, (homeGoals - awayGoals) * 22)),
    pressure: Math.max(20, Math.min(80, 50 + (homeGoals - awayGoals) * 12)),
    pressureSide: homeGoals >= awayGoals ? "home" : "away",
    possessionHome: Math.max(35, Math.min(65, 50 + (homeGoals - awayGoals) * 5)),
    markets,
    confidence: preview.analysis.confidence.value,
    risk: preview.analysis.confidence.band === "low" ? "high" : preview.analysis.confidence.band,
    riskLabel: preview.analysis.predictedOutcome === "home"
      ? `Lectura PE: ${bundle.homeTeam.name}`
      : preview.analysis.predictedOutcome === "away"
        ? `Lectura PE: ${bundle.awayTeam.name}`
        : "Lectura PE: empate",
    aiInsight:
      bundle.events.length > 0
        ? `Timeline con ${bundle.events.length} eventos desde ${bundle.provenance.primaryProvider}.`
        : `Sin eventos de timeline en ${bundle.provenance.primaryProvider}. Probabilidades del Probability Engine.`,
    events,
    source: "data-platform",
  };

  return {
    vision,
    lineups: preview.dashboard.lineups,
    source: "data-platform",
    fixtureId:
      parseTrackedFixtureId(bundle.match.externalRefs[0]?.externalId) ??
      parseTrackedFixtureId(bundle.match.id),
    catalogueLive: bundle.match.status === "live",
    providerLive: null,
  };
}

function buildPostFromBundle(
  bundle: ApexMatchBundle,
  preview: MatchCenterData["preview"],
): MatchCenterPostData {
  const home = bundle.match.score.home ?? 0;
  const away = bundle.match.score.away ?? 0;
  if (bundle.match.status !== "finished") {
    return unevaluatedMatchCenterPost({
      at: bundle.match.updatedAt,
      score: { home, away },
      summary:
        "Post-match evaluation waits for a finished match (FT, AET, or PEN). Live and prematch scores are not a final result.",
    });
  }
  const actualOutcome = outcomeFromScore(home, away);
  const predictedOutcome = preview.analysis.predictedOutcome;
  const oneXTwo = preview.analysis.oneXTwo;
  const outcomeHit = predictedOutcome === actualOutcome;

  const observed = {
    home: actualOutcome === "home" ? 1 : 0,
    draw: actualOutcome === "draw" ? 1 : 0,
    away: actualOutcome === "away" ? 1 : 0,
  };
  const brierScore =
    (oneXTwo.home - observed.home) ** 2 +
    (oneXTwo.draw - observed.draw) ** 2 +
    (oneXTwo.away - observed.away) ** 2;

  const eventNotes = bundle.events.slice(-4).map((event, index) => ({
    id: `dp-evt-${index}`,
    severity: (event.type === "red_card" || event.type === "goal"
      ? "medium"
      : "low") as "low" | "medium" | "high",
    title: eventLabel(event.type),
    detail:
      typeof event.payload.playerName === "string"
        ? `${event.payload.playerName} · min ${event.minute ?? "—"}`
        : `Min ${event.minute ?? "—"} · ${bundle.provenance.primaryProvider}`,
  }));

  return {
    finishedAt: bundle.match.updatedAt,
    finalScore: { home, away },
    actualOutcome,
    preMatch: {
      predictedOutcome,
      oneXTwo,
      confidence: preview.analysis.confidence,
      modelVersion: preview.hybrid.modelVersion,
    },
    outcomeHit,
    markets: [
      {
        id: "mv-1x2",
        market: "1x2",
        label: "Resultado final",
        selection:
          predictedOutcome === "home"
            ? "Local"
            : predictedOutcome === "away"
              ? "Visitante"
              : "Empate",
        preMatchProbability: oneXTwo[predictedOutcome],
        hit: outcomeHit,
      },
      {
        id: "mv-ou25",
        market: "over_under",
        label: "Over / Under 2.5",
        selection: preview.hybrid.overUnder25.over >= 0.5 ? "Over 2.5" : "Under 2.5",
        preMatchProbability: Math.max(
          preview.hybrid.overUnder25.over,
          preview.hybrid.overUnder25.under,
        ),
        hit:
          preview.hybrid.overUnder25.over >= 0.5
            ? home + away > 2.5
            : home + away <= 2.5,
      },
    ],
    metrics: {
      brierScore: Number(brierScore.toFixed(3)),
      outcomeError: Number((1 - oneXTwo[actualOutcome]).toFixed(3)),
    },
    learningSummary: outcomeHit
      ? `Resultado real ${home}–${away} alineado con la lectura APEX (datos ${bundle.provenance.primaryProvider}).`
      : `Resultado real ${home}–${away}. Revisar calibración frente a la predicción pre-partido.`,
    notes: [
      {
        id: "dp-note-1",
        severity: "low",
        title: "Fuente de datos",
        detail: `Partido ingerido vía ${bundle.provenance.primaryProvider}. Trust: ${bundle.trustScore?.band ?? "n/a"}.`,
      },
      ...eventNotes,
    ],
    recommendations: [
      {
        id: "dp-rec-1",
        priority: outcomeHit ? "low" : "medium",
        title: outcomeHit ? "Señal PE confirmada" : "Desvío vs PE",
        detail: outcomeHit
          ? "El Probability Engine acertó el 1X2 con el catálogo API-Football."
          : "El resultado real no coincidió con el 1X2 del Probability Engine. Usar el error de Brier para el siguiente ciclo.",
      },
    ],
    source: "data-platform",
    evaluationAvailable: true,
  };
}

export type MatchCenterFromBundleOptions = {
  /** Override default Elo derivation. */
  homeElo?: number;
  awayElo?: number;
  /** Catalogue extras (form, H2H, injuries) from the data layer. */
  enrichment?: MatchCenterEnrichment;
  /** Sprint 5A — which loader called this. Does not affect predictions. */
  probabilityDiagnosticContext?: ProbabilityDiagnosticContext;
  /** Sprint 5A — test/override env for diagnostic gating. */
  probabilityDiagnosticEnv?: ProbabilityDiagnosticEnv;
  /** Sprint 5A — optional log sink (tests). Default console.info when enabled. */
  probabilityDiagnosticLog?: ProbabilityDiagnosticLog;
};

function probabilityDiagnosticContext(
  options: MatchCenterFromBundleOptions,
): ProbabilityDiagnosticContext {
  if (options.probabilityDiagnosticContext) {
    return options.probabilityDiagnosticContext;
  }
  return scannerProfileActive() ? "scanner" : "unknown";
}

function providerExternalId(
  refs: Array<{ externalId: string }> | undefined,
): string | null {
  return refs?.[0]?.externalId ?? null;
}

function emitMatchProbabilityDiagnostic(
  options: MatchCenterFromBundleOptions,
  input: {
    bundle: ApexMatchBundle;
    match: MatchCenterMeta;
    homeDerivation: EloDerivation;
    awayDerivation: EloDerivation;
    hybridResult: HybridProbabilityResult;
  },
): void {
  const env = options.probabilityDiagnosticEnv ?? process.env;
  if (!isProbabilityDiagnosticEnabled(env)) return;
  const { bundle, match, homeDerivation, awayDerivation, hybridResult } = input;
  maybeEmitProbabilityDiagnostic(
    buildProbabilityDiagnostic({
      context: probabilityDiagnosticContext(options),
      matchId: bundle.match.id,
      providerFixtureId:
        providerExternalId(bundle.match.externalRefs) ??
        match.externalId ??
        null,
      competition: bundle.league?.name ?? match.leagueName,
      season: bundle.league?.season ?? null,
      home: {
        ...homeDerivation,
        teamName: bundle.homeTeam.name,
        canonicalTeamId: bundle.homeTeam.id,
        providerTeamId: providerExternalId(bundle.homeTeam.externalRefs),
      },
      away: {
        ...awayDerivation,
        teamName: bundle.awayTeam.name,
        canonicalTeamId: bundle.awayTeam.id,
        providerTeamId: providerExternalId(bundle.awayTeam.externalRefs),
      },
      hybrid: hybridResult,
    }),
    {
      env,
      log: options.probabilityDiagnosticLog,
    },
  );
}

/**
 * Build Match Center view-model from a normalized ApexMatchBundle.
 */
export function createMatchCenterFromApexBundle(
  bundle: ApexMatchBundle,
  options: MatchCenterFromBundleOptions = {},
): MatchCenterData {
  const status = matchCenterStatusFromApex(bundle.match.status);
  const homeTeam: MatchCenterTeam = {
    id: bundle.homeTeam.id,
    name: bundle.homeTeam.name,
    shortName: shortName(bundle.homeTeam.name, bundle.homeTeam.shortName),
    logoUrl: bundle.homeTeam.crestUrl,
  };
  const awayTeam: MatchCenterTeam = {
    id: bundle.awayTeam.id,
    name: bundle.awayTeam.name,
    shortName: shortName(bundle.awayTeam.name, bundle.awayTeam.shortName),
    logoUrl: bundle.awayTeam.crestUrl,
  };

  const match: MatchCenterMeta = {
    matchId: bundle.match.id,
    externalId: bundle.match.externalRefs[0]?.externalId ?? null,
    leagueName: bundle.league?.name ?? "Football",
    kickoffAt: bundle.match.kickoffAt,
    status,
    homeTeam,
    awayTeam,
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
        : bundle.provenance.primaryProvider === "mock"
          ? "Catálogo"
          : bundle.provenance.primaryProvider,
  };

  const homeDerivation = resolveEloWithProvenance(
    options.enrichment?.teamStats?.home,
    bundle.homeTeam.id,
    1580,
    options.homeElo,
  );
  const awayDerivation = resolveEloWithProvenance(
    options.enrichment?.teamStats?.away,
    bundle.awayTeam.id,
    1520,
    options.awayElo,
  );
  const homeElo = homeDerivation.elo;
  const awayElo = awayDerivation.elo;
  const eloFromStats =
    hasPlayed(options.enrichment?.teamStats?.home) ||
    hasPlayed(options.enrichment?.teamStats?.away);

  const eloInput = {
    homeElo,
    awayElo,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    matchId: bundle.match.id,
  };

  const aiAnalysis = measurePhaseSync("decisionEngine", () =>
    createMatchAnalysisService().analyzeBundle(bundle, {
      homeElo,
      awayElo,
      teamStats: options.enrichment?.teamStats,
      injuries: absencesToAnalysisInjuries([
        ...(options.enrichment?.injuries ?? []),
        ...(options.enrichment?.suspensions ?? []),
      ]),
    }),
  );

  const preview = measurePhaseSync("decisionEngine", () => {
    const hybridResult = createEloPoissonHybridEngine().predict(eloInput);
    const built = buildPreviewFromHybrid(hybridResult, {
    matchId: bundle.match.id,
    leagueName: match.leagueName,
    kickoffAt: match.kickoffAt,
    status:
      status === "finished" ? "finished" : status === "live" ? "live" : "scheduled",
    homeTeam,
    awayTeam,
    eloInput,
    narrative: {
      apexScoreLabel: `Señal APEX · ${bundle.provenance.primaryProvider}`,
      keyFactors: aiAnalysis.explainability.factors.map((f) => ({
        key: f.key,
        label: f.label,
        direction: f.direction,
        weight: f.weight ?? 0.2,
        detail: f.detail ?? "",
      })),
      risks: [
        {
          id: "r-risk-level",
          severity: aiAnalysis.riskLevel,
          title: `Riesgo ${aiAnalysis.riskLevel}`,
          detail: aiAnalysis.recommendation.rationale,
        },
        ...(!eloFromStats
          ? [
              {
                id: "r-elo-est",
                severity: "medium" as const,
                title: "Elo estimado",
                detail:
                  "Ratings Elo se derivan del catálogo cuando hay estadísticas de equipo; si no, se usa el prior home/away (1580/1520).",
              },
            ]
          : []),
      ],
      explanation: {
        summary: aiAnalysis.explainability.summary,
        factors: aiAnalysis.explainability.factors.map((f) => ({
          key: f.key,
          label: f.label,
          direction: f.direction,
          weight: f.weight ?? 0.2,
          detail: f.detail ?? "",
        })),
        caveats: aiAnalysis.explainability.caveats ?? [],
        narrative: aiAnalysis.explainability.narrative ?? "",
      },
    },
    source: "intelligence-core",
    skipPlatformScore: true,
    });
    emitMatchProbabilityDiagnostic(options, {
      bundle,
      match,
      homeDerivation,
      awayDerivation,
      hybridResult,
    });
    return built;
  });

  preview.analysis.modelVersion = `${preview.hybrid.modelVersion}+data-platform`;
  preview.dashboard = measurePhaseSync("serialization", () =>
    buildPreviewDashboard({
    btts: preview.hybrid.btts,
    oneXTwo: preview.analysis.oneXTwo,
    overUnder25: preview.hybrid.overUnder25,
    odds: bundle.odds,
    analysis: aiAnalysis,
    teamStats: options.enrichment?.teamStats,
    h2h: options.enrichment?.h2h,
    injuries: options.enrichment?.injuries ?? aiAnalysis.injuries,
    suspensions: options.enrichment?.suspensions,
    recent: options.enrichment?.recent,
    lineups: options.enrichment?.lineups,
    standings: options.enrichment?.standings,
    trends: options.enrichment?.trends,
    homeTeam,
    awayTeam,
    }),
  );

  const rating = measurePhaseSync("serialization", () =>
    ratePreview(
      preview,
      aiAnalysis,
      `APEX Rating · ${bundle.provenance.primaryProvider}`,
    ),
  );
  preview.analysis.rating = rating;
  const extras = {
    injuries: preview.dashboard.injuries,
    homeForm: preview.dashboard.form.home,
    awayForm: preview.dashboard.form.away,
    weather: match.weather,
    odds: preview.dashboard.odds,
  };
  const team = selectionTwinFromPreview(
    match,
    preview.dashboard,
    preview.analysis.predictedOutcome,
  );
  const { decision, scoring } = scoreMatchSelection({
    analysis: preview.analysis,
    extras,
    team,
    season: bundle.league?.season ?? null,
  });
  preview.analysis.decision = decision;
  preview.analysis.scoring = scoring;
  preview.analysis.apexScore = apexScoreFromScoring(scoring);
  preview.analysis.report = measurePhaseSync("serialization", () =>
    buildIntelligenceReport({
      data: preview.analysis,
      ...extras,
    }),
  );

  const live = measurePhaseSync("serialization", () =>
    buildLiveFromBundle(bundle, preview),
  );
  const post = measurePhaseSync("serialization", () =>
    buildPostFromBundle(bundle, preview),
  );

  return {
    match,
    defaultPhase: phaseFromStatus(status),
    preview,
    live,
    post,
    aiAnalysis,
    fixtures: [],
    source: "platform",
  };
}
