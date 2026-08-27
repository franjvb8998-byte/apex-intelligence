/**
 * ApexMatchBundle → MatchCenterData (UI view-model).
 * Consumes Data Platform + Probability Engine public APIs only.
 * Does not modify PE or Learning Engine.
 */

import { createInitialVisionState } from "@/lib/apex-vision";
import type { VisionLiveState } from "@/lib/apex-vision/types";
import type { ApexMatchBundle } from "@/lib/data-platform/types/bundle";
import type { ApexMatchStatus } from "@/lib/data-platform/types/match";
import type { MatchOutcome } from "@/lib/intelligence/types";
import { createMatchAnalysisService } from "@/lib/match-analysis/match-analysis-service";
import { buildPreviewDashboard } from "@/lib/match-center/dashboard";
import { buildPreviewFromEngine } from "@/lib/match-center/from-probability";
import type { MatchCenterEnrichment } from "@/lib/match-center/enrich";
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

function toCenterStatus(
  status: ApexMatchStatus,
): MatchCenterMeta["status"] {
  if (status === "live") return "live";
  if (status === "finished") return "finished";
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
 * Stable pseudo-Elo from team id so PE gets deterministic inputs without DB ratings.
 * TODO(elo-provider): replace with EloRatingProvider / catalogue ratings.
 */
export function estimateEloFromTeamId(teamId: string, base = 1500): number {
  let hash = 0;
  for (let i = 0; i < teamId.length; i++) {
    hash = (hash * 31 + teamId.charCodeAt(i)) >>> 0;
  }
  return base + (hash % 251) - 125;
}

function buildLiveFromBundle(bundle: ApexMatchBundle): MatchCenterLiveData {
  const seed = createInitialVisionState();
  const homeShort = shortName(
    bundle.homeTeam.name,
    bundle.homeTeam.shortName,
  );
  const awayShort = shortName(
    bundle.awayTeam.name,
    bundle.awayTeam.shortName,
  );

  const vision: VisionLiveState = {
    ...seed,
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
    score: {
      home: bundle.match.score.home ?? 0,
      away: bundle.match.score.away ?? 0,
    },
    minute: bundle.match.minute ?? seed.minute,
    events:
      bundle.events.length > 0
        ? bundle.events.slice(-8).map((event, index) => ({
            id: event.id,
            minute: event.minute ?? 0,
            type: "pase" as const,
            side:
              event.teamId === bundle.homeTeam.id
                ? ("home" as const)
                : ("away" as const),
            label: event.type.replaceAll("_", " "),
            detail:
              typeof event.payload.playerName === "string"
                ? String(event.payload.playerName)
                : event.type,
            ballTo: seed.ball,
            aiExplanation: `Evento ${event.type} (Data Platform).`,
            momentumDelta: 0,
            probabilityImpact: {
              homeWin: 0,
              draw: 0,
              awayWin: 0,
              over25: 0,
              btts: 0,
            },
            marketsAfter: seed.markets,
            whyChanged: [
              {
                id: `dp-${index}`,
                label: "Fuente",
                direction: "neutral" as const,
                detail: `Provider ${event.sourceProvider}`,
              },
            ],
          }))
        : seed.events,
    aiInsight:
      bundle.events.length > 0
        ? `Timeline con ${bundle.events.length} eventos desde ${bundle.provenance.primaryProvider}.`
        : seed.aiInsight,
    source: "mock",
  };

  return { vision, source: "mock" };
}

function buildPostFromBundle(
  bundle: ApexMatchBundle,
  preview: MatchCenterData["preview"],
): MatchCenterPostData {
  const home = bundle.match.score.home ?? 0;
  const away = bundle.match.score.away ?? 0;
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
    ],
    recommendations: [
      {
        id: "dp-rec-1",
        priority: "medium",
        title: "Conectar Learning Engine",
        detail:
          "Cuando el Learning Engine esté cableado, este cierre alimentará biases y calibración automáticamente.",
      },
    ],
    source: "mock",
  };
}

export type MatchCenterFromBundleOptions = {
  /** Override default Elo derivation. */
  homeElo?: number;
  awayElo?: number;
  /** Catalogue extras (form, H2H, injuries) from the data layer. */
  enrichment?: MatchCenterEnrichment;
};

/**
 * Build Match Center view-model from a normalized ApexMatchBundle.
 */
export function createMatchCenterFromApexBundle(
  bundle: ApexMatchBundle,
  options: MatchCenterFromBundleOptions = {},
): MatchCenterData {
  const status = toCenterStatus(bundle.match.status);
  const homeTeam: MatchCenterTeam = {
    id: bundle.homeTeam.id,
    name: bundle.homeTeam.name,
    shortName: shortName(bundle.homeTeam.name, bundle.homeTeam.shortName),
  };
  const awayTeam: MatchCenterTeam = {
    id: bundle.awayTeam.id,
    name: bundle.awayTeam.name,
    shortName: shortName(bundle.awayTeam.name, bundle.awayTeam.shortName),
  };

  const match: MatchCenterMeta = {
    matchId: bundle.match.id,
    leagueName: bundle.league?.name ?? "Football",
    kickoffAt: bundle.match.kickoffAt,
    status,
    homeTeam,
    awayTeam,
    source: "data-platform",
    providerLabel:
      bundle.provenance.primaryProvider === "api-football"
        ? "API-Football"
        : bundle.provenance.primaryProvider === "mock"
          ? "Mock"
          : bundle.provenance.primaryProvider,
  };

  const homeElo =
    options.homeElo ?? estimateEloFromTeamId(bundle.homeTeam.id, 1580);
  const awayElo =
    options.awayElo ?? estimateEloFromTeamId(bundle.awayTeam.id, 1520);

  const aiAnalysis = createMatchAnalysisService().analyzeBundle(bundle, {
    homeElo,
    awayElo,
    teamStats: options.enrichment?.teamStats,
    injuries: options.enrichment?.injuries,
  });

  const preview = buildPreviewFromEngine({
    matchId: bundle.match.id,
    leagueName: match.leagueName,
    kickoffAt: match.kickoffAt,
    status,
    homeTeam,
    awayTeam,
    eloInput: {
      homeElo,
      awayElo,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      matchId: bundle.match.id,
    },
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
        {
          id: "r-elo-est",
          severity: "medium" as const,
          title: "Elo estimado",
          detail:
            "Ratings Elo aún no vienen del catálogo; se estiman del team id hasta cablear EloRatingProvider.",
        },
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
    source: "mock",
  });

  // Mark analysis source as intelligence-core-shaped but data from platform;
  // keep preview.source as mock for Elo until ratings provider exists.
  preview.analysis.source = "mock";
  preview.analysis.modelVersion = `${preview.hybrid.modelVersion}+data-platform`;
  preview.dashboard = buildPreviewDashboard({
    btts: preview.hybrid.btts,
    oneXTwo: preview.analysis.oneXTwo,
    overUnder25: preview.hybrid.overUnder25,
    odds: bundle.odds,
    analysis: aiAnalysis,
    teamStats: options.enrichment?.teamStats,
    h2h: options.enrichment?.h2h,
    injuries: options.enrichment?.injuries ?? aiAnalysis.injuries,
    homeTeam,
    awayTeam,
  });

  const live = buildLiveFromBundle(bundle);
  const post = buildPostFromBundle(bundle, preview);

  return {
    match,
    defaultPhase: phaseFromStatus(status),
    preview,
    live,
    post,
    aiAnalysis,
    source: "platform",
  };
}
