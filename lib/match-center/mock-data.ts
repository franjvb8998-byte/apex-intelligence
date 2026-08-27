/**
 * Simulated Match Center™ payload.
 * Preview probabilities come from the Probability Engine (public API).
 * Live / Post remain mock until Vision feed + Learning Engine are wired.
 *
 * TODO(core-wire): replace getMockMatchCenter() with platform adapters.
 */

import { createInitialVisionState } from "@/lib/apex-vision";
import type { VisionLiveState } from "@/lib/apex-vision/types";
import {
  createEloPoissonHybridEngine,
  type TeamEloInput,
} from "@/lib/intelligence/modules/probability";
import {
  buildPreviewFromEngine,
  type PreviewBuildContext,
} from "@/lib/match-center/from-probability";
import type { MatchOutcome } from "@/lib/intelligence/types";
import {
  analyzeMatchWithRules,
  confidenceFromProbability,
} from "@/lib/match-analysis/rules/analyze-with-rules";
import { buildPreviewDashboard } from "@/lib/match-center/dashboard";
import type {
  MatchCenterData,
  MatchCenterLiveData,
  MatchCenterMeta,
  MatchCenterPhase,
  MatchCenterPostData,
} from "@/lib/match-center/types";

const MATCH_ID = "apex:mock:match:center-1001";

const HOME = {
  id: "apex:mock:team:home",
  name: "Northbridge FC",
  shortName: "NOR",
} as const;

const AWAY = {
  id: "apex:mock:team:away",
  name: "Southport United",
  shortName: "SOU",
} as const;

/** Simulated Elo pair — replace with EloRatingProvider later. */
export const MOCK_MATCH_CENTER_ELO: TeamEloInput = {
  homeElo: 1620,
  awayElo: 1510,
  homeTeamId: HOME.id,
  awayTeamId: AWAY.id,
  matchId: MATCH_ID,
};

const NARRATIVE: PreviewBuildContext["narrative"] = {
  apexScoreLabel: "Señal moderada a favor del local",
  keyFactors: [
    {
      key: "home-form",
      label: "Forma local",
      direction: "supports",
      weight: 0.28,
      detail: "Northbridge suma 10 de 12 puntos posibles en casa.",
    },
    {
      key: "xg-edge",
      label: "Ventaja de xG",
      direction: "supports",
      weight: 0.22,
      detail: "Promedio de 1.7 xG a favor vs 1.1 en contra en los últimos 5.",
    },
    {
      key: "away-travel",
      label: "Desgaste visitante",
      direction: "supports",
      weight: 0.14,
      detail: "Southport encadena el tercer partido fuera en 8 días.",
    },
    {
      key: "injuries",
      label: "Bajas en mediocampo",
      direction: "against",
      weight: 0.18,
      detail: "Northbridge duda de su pivote titular; reduce control esperado.",
    },
  ],
  risks: [
    {
      id: "r1",
      severity: "medium",
      title: "Confianza media",
      detail:
        "El margen local–empate es moderado; tamaño de stake disciplinado.",
    },
    {
      id: "r2",
      severity: "high",
      title: "Incertidumbre por alineación",
      detail:
        "Si cae el pivote local, la probabilidad de empate sube de forma material.",
    },
  ],
  explanation: {
    summary:
      "APEX favorece la victoria local con convicción media, impulsada por forma en casa y ventaja de xG, atenuada por bajas en el mediocampo.",
    factors: [],
    caveats: [
      "Probabilidades generadas por el Probability Engine con Elo simulado.",
      "Narrativa y riesgos son simulados — no conectados al Explainability module.",
      "No constituye consejo financiero ni garantía de resultado.",
    ],
    narrative:
      "El motor híbrido Elo × Poisson proyecta λ a partir del diferencial de rating. " +
      "La masa 1X2 favorece a Northbridge, con empate reteniendo masa por paridad histórica. " +
      "Over 2.5 refleja el volumen ofensivo esperado, no una debilidad extrema del visitante. " +
      "Lectura de Match Center: señal a favor del local con disciplina mientras la confianza no suba de banda media.",
  },
};

function phaseFromStatus(
  status: MatchCenterMeta["status"],
): MatchCenterPhase {
  if (status === "live") return "live";
  if (status === "finished") return "post";
  return "preview";
}

function multinomialBrier(
  predicted: MatchCenterData["preview"]["analysis"]["oneXTwo"],
  actual: MatchOutcome,
): number {
  const observed = {
    home: actual === "home" ? 1 : 0,
    draw: actual === "draw" ? 1 : 0,
    away: actual === "away" ? 1 : 0,
  };
  return (
    (predicted.home - observed.home) ** 2 +
    (predicted.draw - observed.draw) ** 2 +
    (predicted.away - observed.away) ** 2
  );
}

function buildLive(): MatchCenterLiveData {
  const vision: VisionLiveState = {
    ...createInitialVisionState(),
    matchId: MATCH_ID,
    leagueName: "Premier League",
    homeTeam: { ...HOME },
    awayTeam: { ...AWAY },
  };
  return { vision, source: "mock" };
}

function buildPost(
  previewOneXTwo: MatchCenterData["preview"]["analysis"]["oneXTwo"],
  predictedOutcome: MatchCenterData["preview"]["analysis"]["predictedOutcome"],
  confidence: MatchCenterData["preview"]["analysis"]["confidence"],
  modelVersion: string,
): MatchCenterPostData {
  const finalScore = { home: 2, away: 1 };
  const actualOutcome: MatchOutcome = "home";
  const outcomeHit = predictedOutcome === actualOutcome;

  return {
    finishedAt: "2026-08-15T19:52:00.000Z",
    finalScore,
    actualOutcome,
    preMatch: {
      predictedOutcome,
      oneXTwo: previewOneXTwo,
      confidence,
      modelVersion,
    },
    outcomeHit,
    markets: [
      {
        id: "mv-1x2",
        market: "1x2",
        label: "Resultado final",
        selection: "Local",
        preMatchProbability: previewOneXTwo.home,
        hit: actualOutcome === "home",
      },
      {
        id: "mv-ou",
        market: "over_under_25",
        label: "Over 2.5",
        selection: "Over",
        preMatchProbability: 0.54,
        hit: finalScore.home + finalScore.away > 2.5,
      },
      {
        id: "mv-btts",
        market: "btts",
        label: "Ambos marcan",
        selection: "Sí",
        preMatchProbability: 0.57,
        hit: finalScore.home > 0 && finalScore.away > 0,
      },
    ],
    metrics: {
      brierScore: Number(multinomialBrier(previewOneXTwo, actualOutcome).toFixed(3)),
      outcomeError: Number(
        (1 - previewOneXTwo[actualOutcome]).toFixed(3),
      ),
    },
    learningSummary: outcomeHit
      ? "La lectura pre-partido se alineó con el resultado. El valor está en revisar si el tamaño de stake respetó la confianza media."
      : "El resultado no coincidió con la lectura principal. Revisa factores en contra y calibración de confianza.",
    notes: [
      {
        id: "n1",
        severity: "medium",
        title: "Confianza vs convicción",
        detail:
          "Banda media: el acierto de outcome no justifica overbetting en réplicas similares.",
      },
      {
        id: "n2",
        severity: "low",
        title: "Mercados secundarios",
        detail:
          "Over 2.5 y BTTS cerraron a favor; útiles como chequeo de perfil ofensivo, no como señal primaria.",
      },
    ],
    recommendations: [
      {
        id: "rec1",
        priority: "high",
        title: "Registrar stake y nota",
        detail:
          "Cierra el ciclo: asocia tu predicción y tamaño al partido para medir edge real.",
      },
      {
        id: "rec2",
        priority: "medium",
        title: "Revisar riesgo de alineación",
        detail:
          "Si el pivote titular confirma baja, rebaja confianza antes del próximo partido similar.",
      },
    ],
    source: "mock",
  };
}

/**
 * Full Match Center mock for the hub screen.
 * Status defaults to `live` so the hub opens on Live; all phases remain browsable.
 */
export function getMockMatchCenter(
  options?: { status?: MatchCenterMeta["status"] },
): MatchCenterData {
  const status = options?.status ?? "live";

  const match: MatchCenterMeta = {
    matchId: MATCH_ID,
    leagueName: "Premier League",
    kickoffAt: "2026-08-15T18:00:00.000Z",
    status,
    homeTeam: { ...HOME },
    awayTeam: { ...AWAY },
    source: "mock",
  };

  const preview = buildPreviewFromEngine({
    matchId: MATCH_ID,
    leagueName: match.leagueName,
    kickoffAt: match.kickoffAt,
    status: status === "finished" ? "finished" : status === "live" ? "live" : "scheduled",
    homeTeam: { ...HOME },
    awayTeam: { ...AWAY },
    eloInput: MOCK_MATCH_CENTER_ELO,
    narrative: NARRATIVE,
    source: "mock",
  });

  const live = buildLive();
  const post = buildPost(
    preview.analysis.oneXTwo,
    preview.analysis.predictedOutcome,
    preview.analysis.confidence,
    preview.hybrid.modelVersion,
  );

  const probability = createEloPoissonHybridEngine().predict(MOCK_MATCH_CENTER_ELO);
  const now = new Date().toISOString();
  const aiAnalysis = analyzeMatchWithRules({
    match: {
      id: MATCH_ID,
      leagueId: "apex:mock:league:39",
      homeTeamId: HOME.id,
      awayTeamId: AWAY.id,
      kickoffAt: match.kickoffAt,
      status,
      score: { home: null, away: null },
      venue: null,
      minute: null,
      externalRefs: [],
      ingestedAt: now,
      updatedAt: now,
    },
    homeTeam: {
      id: HOME.id,
      leagueId: "apex:mock:league:39",
      name: HOME.name,
      shortName: HOME.shortName,
      crestUrl: null,
      externalRefs: [],
    },
    awayTeam: {
      id: AWAY.id,
      leagueId: "apex:mock:league:39",
      name: AWAY.name,
      shortName: AWAY.shortName,
      crestUrl: null,
      externalRefs: [],
    },
    league: {
      id: "apex:mock:league:39",
      name: match.leagueName,
      country: "England",
      sport: "football",
      season: "2025/2026",
      externalRefs: [],
    },
    probability,
    confidence: confidenceFromProbability(probability),
    timeline: [],
    players: [],
    teamStats: {
      home: { form: "WWDLW", wins: 12, goalsAgainst: 18 },
      away: { form: "LDLWW", wins: 9, goalsAgainst: 24 },
    },
  });

  preview.dashboard = buildPreviewDashboard({
    btts: preview.hybrid.btts,
    oneXTwo: preview.analysis.oneXTwo,
    overUnder25: preview.hybrid.overUnder25,
    odds: [],
    analysis: aiAnalysis,
    teamStats: {
      home: { form: "WWDLW", wins: 12, goalsAgainst: 18, teamName: HOME.name },
      away: { form: "LDLWW", wins: 9, goalsAgainst: 24, teamName: AWAY.name },
    },
    homeTeam: { ...HOME },
    awayTeam: { ...AWAY },
  });

  return {
    match,
    defaultPhase: phaseFromStatus(status),
    preview,
    live,
    post,
    aiAnalysis,
    source: "mock",
  };
}
