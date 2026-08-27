/**
 * Rule-based reasoning for Match Analysis (no OpenAI).
 * Uses Reasoning Layer contracts as the output shape.
 */

import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability";
import {
  mostLikelyOutcome,
  normalizedEntropy,
} from "@/lib/intelligence/modules/probability";
import type {
  ConfidenceScore,
  MatchOutcome,
} from "@/lib/intelligence/types";
import type {
  Explanation,
  Recommendation,
  ValueOpportunity,
} from "@/lib/intelligence/reasoning/contracts/types";
import { explainPrediction } from "@/lib/explainable-ai/engine";
import type {
  MatchAnalysis,
  MatchAnalysisExpectedGoals,
  MatchAnalysisFactor,
  MatchAnalysisInput,
  MatchAnalysisInjury,
  MatchAnalysisKeyPlayer,
} from "@/lib/match-analysis/analysis-types";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function confidenceFromProbability(
  probability: HybridProbabilityResult,
): ConfidenceScore {
  const value = clamp01(1 - normalizedEntropy(probability.oneXTwo));
  const band: ConfidenceScore["band"] =
    value >= 0.75 ? "high" : value >= 0.45 ? "medium" : "low";
  return {
    value,
    band,
  };
}

function outcomeLabel(
  outcome: MatchOutcome,
  homeName: string,
  awayName: string,
): string {
  if (outcome === "home") return `Victoria ${homeName}`;
  if (outcome === "away") return `Victoria ${awayName}`;
  return "Empate";
}

function formSummary(home: string | null, away: string | null): string {
  if (!home && !away) {
    return "Sin serie de forma disponible en el catálogo; se usa señal del Probability Engine.";
  }
  const parts: string[] = [];
  if (home) parts.push(`Local: ${home}`);
  if (away) parts.push(`Visitante: ${away}`);
  return parts.join(" · ");
}

function deriveStrengths(
  input: MatchAnalysisInput,
  predicted: MatchOutcome,
  xg: MatchAnalysisExpectedGoals,
): MatchAnalysisFactor[] {
  const factors: MatchAnalysisFactor[] = [];
  const { homeTeam, awayTeam, probability, teamStats } = input;

  if (predicted === "home" || xg.home >= xg.away + 0.25) {
    factors.push({
      id: "str-home-xg",
      label: "Superioridad ofensiva local",
      detail: `xG local ${xg.home.toFixed(2)} vs visitante ${xg.away.toFixed(2)}.`,
      side: "home",
    });
  }
  if (predicted === "away" || xg.away >= xg.home + 0.25) {
    factors.push({
      id: "str-away-xg",
      label: "Amenaza visitante",
      detail: `xG visitante ${xg.away.toFixed(2)} supera o iguala al local.`,
      side: "away",
    });
  }

  const homeWins = teamStats?.home?.wins;
  const awayWins = teamStats?.away?.wins;
  if (homeWins != null && awayWins != null && homeWins > awayWins) {
    factors.push({
      id: "str-home-wins",
      label: "Mejor balance de victorias (local)",
      detail: `${homeTeam.name}: ${homeWins}W · ${awayTeam.name}: ${awayWins}W.`,
      side: "home",
    });
  }
  if (awayWins != null && homeWins != null && awayWins > homeWins) {
    factors.push({
      id: "str-away-wins",
      label: "Mejor balance de victorias (visitante)",
      detail: `${awayTeam.name}: ${awayWins}W · ${homeTeam.name}: ${homeWins}W.`,
      side: "away",
    });
  }

  if (probability.elo.winExpectancyHome >= 0.58) {
    factors.push({
      id: "str-elo-home",
      label: "Elo favorece al local",
      detail: `Expectativa Elo local ${(probability.elo.winExpectancyHome * 100).toFixed(0)}%.`,
      side: "home",
    });
  } else if (probability.elo.winExpectancyHome <= 0.42) {
    factors.push({
      id: "str-elo-away",
      label: "Elo favorece al visitante",
      detail: `Expectativa Elo local solo ${(probability.elo.winExpectancyHome * 100).toFixed(0)}%.`,
      side: "away",
    });
  }

  if (factors.length === 0) {
    factors.push({
      id: "str-balanced",
      label: "Partido equilibrado",
      detail: "No hay un desequilibrio claro de xG/Elo; el empate gana peso relativo.",
      side: "match",
    });
  }

  return factors.slice(0, 4);
}

function deriveWeaknesses(
  input: MatchAnalysisInput,
  confidence: ConfidenceScore,
  xg: MatchAnalysisExpectedGoals,
): MatchAnalysisFactor[] {
  const factors: MatchAnalysisFactor[] = [];
  const draw = input.probability.oneXTwo.draw;

  if (confidence.band === "low") {
    factors.push({
      id: "weak-uncertainty",
      label: "Alta incertidumbre del modelo",
      detail: "La entropía 1X2 es elevada; la señal debe tomarse con cautela.",
      side: "match",
    });
  }
  if (draw >= 0.3) {
    factors.push({
      id: "weak-draw",
      label: "Masa relevante de empate",
      detail: `P(empate)=${(draw * 100).toFixed(0)}% — reduce claridad de apuesta direccional.`,
      side: "match",
    });
  }
  if (Math.abs(xg.home - xg.away) < 0.2) {
    factors.push({
      id: "weak-xg-close",
      label: "xG muy cercanos",
      detail: "Diferencia de goles esperados inferior a 0.20.",
      side: "match",
    });
  }

  const homeGa = input.teamStats?.home?.goalsAgainst;
  const awayGa = input.teamStats?.away?.goalsAgainst;
  if (homeGa != null && homeGa > 40) {
    factors.push({
      id: "weak-home-def",
      label: "Defensa local permeable",
      detail: `${input.homeTeam.name} concede ${homeGa} goles en la muestra.`,
      side: "home",
    });
  }
  if (awayGa != null && awayGa > 40) {
    factors.push({
      id: "weak-away-def",
      label: "Defensa visitante permeable",
      detail: `${input.awayTeam.name} concede ${awayGa} goles en la muestra.`,
      side: "away",
    });
  }

  if (factors.length === 0) {
    factors.push({
      id: "weak-none",
      label: "Sin debilidades críticas",
      detail: "Las señales disponibles no marcan un riesgo estructural dominante.",
      side: "match",
    });
  }

  return factors.slice(0, 4);
}

function deriveTacticalFactors(
  probability: HybridProbabilityResult,
  xg: MatchAnalysisExpectedGoals,
): MatchAnalysisFactor[] {
  const factors: MatchAnalysisFactor[] = [
    {
      id: "tac-tempo",
      label:
        xg.total >= 2.7
          ? "Partido de ritmo alto"
          : xg.total <= 2.2
            ? "Partido de ritmo bajo"
            : "Tempo medio",
      detail: `xG total ${xg.total.toFixed(2)} · Over 2.5 ${(probability.overUnder25.over * 100).toFixed(0)}%.`,
      side: "match",
    },
    {
      id: "tac-blend",
      label: "Fusión Elo × Poisson",
      detail: `Peso Poisson ${Math.round(probability.meta.poissonBlendWeight * 100)}% · modelo ${probability.meta.modelVersion}.`,
      side: "match",
    },
  ];

  const delta = xg.home - xg.away;
  if (Math.abs(delta) >= 0.35) {
    factors.push({
      id: "tac-asymmetry",
      label: delta > 0 ? "Dominio territorial esperado (local)" : "Contraataque visitante",
      detail: `ΔxG = ${delta >= 0 ? "+" : ""}${delta.toFixed(2)}.`,
      side: delta > 0 ? "home" : "away",
    });
  }

  return factors;
}

function deriveKeyPlayers(input: MatchAnalysisInput): MatchAnalysisKeyPlayer[] {
  const players = input.players ?? [];
  return players.slice(0, 6).map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    position: p.position,
    shirtNumber: p.shirtNumber,
  }));
}

function deriveInjuries(input: MatchAnalysisInput): MatchAnalysisInjury[] {
  // Rule path: no injury feed yet — keep empty unless context marks injured players.
  const flagged = (input.players ?? []).filter((p) =>
    Boolean((p as { injured?: boolean }).injured),
  );
  return flagged.map((p) => ({
    id: `inj-${p.id}`,
    playerName: p.name,
    teamId: p.teamId,
    detail: "Marcado como baja / duda en el catálogo.",
  }));
}

function riskLevelFrom(
  confidence: ConfidenceScore,
  probability: HybridProbabilityResult,
): MatchAnalysis["riskLevel"] {
  if (confidence.band === "low" || probability.oneXTwo.draw >= 0.32) return "high";
  if (confidence.band === "medium") return "medium";
  return "low";
}

function buildRecommendation(
  input: MatchAnalysisInput,
  predicted: MatchOutcome,
  confidence: ConfidenceScore,
  risk: MatchAnalysis["riskLevel"],
): Recommendation {
  const selection =
    predicted === "home" ? "home" : predicted === "away" ? "away" : "draw";
  const label = outcomeLabel(
    predicted,
    input.homeTeam.name,
    input.awayTeam.name,
  );

  if (risk === "high" || confidence.band === "low") {
    return {
      id: "rec-pass",
      title: "Pasar / observar",
      action: "pass",
      market: "1x2",
      selection,
      priority: "low",
      rationale: `Señal poco clara para ${label}. Mejor esperar más información o reducir exposición.`,
      confidence,
    };
  }

  if (confidence.band === "high" && risk === "low") {
    return {
      id: "rec-bet",
      title: `Inclinar a ${label}`,
      action: "bet",
      market: "1x2",
      selection,
      priority: "high",
      rationale: `Convicción alta del Probability Engine (${(confidence.value * 100).toFixed(0)}%).`,
      confidence,
    };
  }

  return {
    id: "rec-watch",
    title: `Vigilar ${label}`,
    action: "watch",
    market: "1x2",
    selection,
    priority: "medium",
    rationale: "Señal moderada: útil como hipótesis, no como stake completo.",
    confidence,
  };
}

function impliedFromDecimal(odds: number | null | undefined): number | null {
  if (odds == null || !Number.isFinite(odds) || odds <= 1) return null;
  return 1 / odds;
}

function buildValueBet(
  input: MatchAnalysisInput,
  predicted: MatchOutcome,
  probability: HybridProbabilityResult,
): ValueOpportunity | null {
  const modelProbability = probability.oneXTwo[predicted];
  const odds =
    predicted === "home"
      ? input.marketOdds?.home
      : predicted === "away"
        ? input.marketOdds?.away
        : input.marketOdds?.draw;
  const implied = impliedFromDecimal(odds ?? null);

  // Without market odds, still surface a model-edge placeholder vs fair 1/p.
  const fairOdds = modelProbability > 0 ? 1 / modelProbability : null;
  const edge = implied != null ? modelProbability - implied : 0;

  if (implied == null) {
    if (modelProbability < 0.42) return null;
    return {
      id: "val-model",
      market: "1x2",
      selection: predicted,
      modelProbability,
      impliedProbability: null,
      decimalOdds: fairOdds,
      edge: 0,
      kellyFraction: null,
      explanation:
        "Sin cuotas de mercado en el input; se muestra la probabilidad modelo y la cuota justa teórica.",
    };
  }

  if (edge < 0.03) return null;

  const kelly =
    implied > 0 && odds
      ? clamp01((modelProbability * odds - 1) / (odds - 1)) * 0.25
      : null;

  return {
    id: "val-1x2",
    market: "1x2",
    selection: predicted,
    modelProbability,
    impliedProbability: implied,
    decimalOdds: odds ?? null,
    edge,
    kellyFraction: kelly,
    explanation: `Edge modelo ${(edge * 100).toFixed(1)} pp frente a la cuota implícita.`,
  };
}

function buildExplainability(
  input: MatchAnalysisInput,
  predicted: MatchOutcome,
  confidence: ConfidenceScore,
  strengths: MatchAnalysisFactor[],
  tactical: MatchAnalysisFactor[],
  risk: MatchAnalysis["riskLevel"],
): Explanation {
  const label = outcomeLabel(
    predicted,
    input.homeTeam.name,
    input.awayTeam.name,
  );
  const timelineNote =
    input.timeline && input.timeline.length > 0
      ? `Timeline con ${input.timeline.length} eventos del Data Platform.`
      : "Sin eventos de timeline; análisis pre-partido.";

  const factors = [
    ...strengths.slice(0, 2).map((s) => ({
      key: s.id,
      label: s.label,
      direction: "supports" as const,
      weight: 0.25,
      detail: s.detail,
    })),
    ...tactical.slice(0, 2).map((t) => ({
      key: t.id,
      label: t.label,
      direction: "neutral" as const,
      weight: 0.2,
      detail: t.detail,
    })),
  ];

  return {
    summary: `Lectura APEX: ${label} con confianza ${confidence.band} (${(confidence.value * 100).toFixed(0)}%). Riesgo ${risk}.`,
    narrative: [
      `${input.homeTeam.name} vs ${input.awayTeam.name}${input.league ? ` · ${input.league.name}` : ""}.`,
      `Probability Engine (${input.probability.meta.modelVersion}) → 1X2 ${Math.round(input.probability.oneXTwo.home * 100)}/${Math.round(input.probability.oneXTwo.draw * 100)}/${Math.round(input.probability.oneXTwo.away * 100)}.`,
      `xG ${input.probability.expectedGoals.home.toFixed(2)}–${input.probability.expectedGoals.away.toFixed(2)}.`,
      timelineNote,
      "Explicación generada por reglas del Reasoning Layer (sin OpenAI).",
    ].join(" "),
    factors,
    caveats: [
      "Elo puede ser estimado si no hay rating provider.",
      "Value bet requiere cuotas de mercado para edge real.",
      "No se ha llamado a ningún LLM.",
    ],
  };
}

/**
 * Pure rule engine: MatchAnalysisInput → MatchAnalysis.
 */
export function analyzeMatchWithRules(input: MatchAnalysisInput): MatchAnalysis {
  const confidence =
    input.confidence ?? confidenceFromProbability(input.probability);
  const predicted = mostLikelyOutcome(input.probability.oneXTwo);
  const expectedGoals = { ...input.probability.expectedGoals };
  const strengths = deriveStrengths(input, predicted, expectedGoals);
  const weaknesses = deriveWeaknesses(input, confidence, expectedGoals);
  const tacticalFactors = deriveTacticalFactors(input.probability, expectedGoals);
  const homeForm = input.teamStats?.home?.form ?? null;
  const awayForm = input.teamStats?.away?.form ?? null;
  const riskLevel = riskLevelFrom(confidence, input.probability);
  const recommendation = buildRecommendation(
    input,
    predicted,
    confidence,
    riskLevel,
  );
  const valueBet = buildValueBet(input, predicted, input.probability);
  const explainability = buildExplainability(
    input,
    predicted,
    confidence,
    strengths,
    tacticalFactors,
    riskLevel,
  );

  const explainable = explainPrediction({
    matchId: input.match.id,
    homeTeamName: input.homeTeam.name,
    awayTeamName: input.awayTeam.name,
    leagueName: input.league?.name ?? null,
    probability: input.probability,
    confidence,
    strengths,
    weaknesses,
    homeForm,
    awayForm,
    timelineEventCount: input.timeline?.length ?? 0,
    dataProvider: input.match.externalRefs[0]?.provider ?? null,
  });

  return {
    matchId: input.match.id,
    generatedAt: new Date().toISOString(),
    prediction: {
      outcome: predicted,
      label: outcomeLabel(predicted, input.homeTeam.name, input.awayTeam.name),
      oneXTwo: input.probability.oneXTwo,
      modelVersion: input.probability.meta.modelVersion,
    },
    confidence,
    strengths,
    weaknesses,
    tacticalFactors,
    recentForm: {
      home: homeForm,
      away: awayForm,
      summary: formSummary(homeForm, awayForm),
    },
    keyPlayers: deriveKeyPlayers(input),
    injuries:
      input.injuries && input.injuries.length > 0
        ? input.injuries
        : deriveInjuries(input),
    expectedGoals,
    riskLevel,
    recommendation,
    valueBet,
    explainability,
    explainable,
    source: {
      dataPlatform: true,
      probabilityEngine: true,
      reasoning: "rules",
    },
  };
}
