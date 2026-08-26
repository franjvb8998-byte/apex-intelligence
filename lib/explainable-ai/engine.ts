/**
 * Explainable AI engine v1 — rule-based explanations from PE + context signals.
 * Does not modify Probability Engine / Learning Engine / Data Platform.
 */

import type { HybridProbabilityResult } from "@/lib/intelligence/modules/probability";
import {
  mostLikelyOutcome,
  normalizedEntropy,
} from "@/lib/intelligence/modules/probability";
import type { ConfidenceScore, MatchOutcome } from "@/lib/intelligence/types";
import type {
  ExplainableFactor,
  ExplainablePrediction,
  ExplanationEvidence,
  ExplanationQualityScore,
} from "@/lib/explainable-ai/types";

export type ExplainableAiInput = {
  matchId: string;
  homeTeamName: string;
  awayTeamName: string;
  leagueName?: string | null;
  probability: HybridProbabilityResult;
  confidence?: ConfidenceScore;
  /** Optional pre-computed strengths / weaknesses from Match Analysis. */
  strengths?: Array<{ id: string; label: string; detail: string }>;
  weaknesses?: Array<{ id: string; label: string; detail: string }>;
  homeForm?: string | null;
  awayForm?: string | null;
  timelineEventCount?: number;
  dataProvider?: string | null;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function confidenceFromProbability(
  probability: HybridProbabilityResult,
): ConfidenceScore {
  const value = clamp01(1 - normalizedEntropy(probability.oneXTwo));
  const band: ConfidenceScore["band"] =
    value >= 0.75 ? "high" : value >= 0.45 ? "medium" : "low";
  return { value, band };
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

function buildEvidence(input: ExplainableAiInput): ExplanationEvidence[] {
  const { probability } = input;
  const evidence: ExplanationEvidence[] = [
    {
      id: "ev-1x2",
      source: "probability-engine",
      label: "Probabilidades 1X2",
      value: `${Math.round(probability.oneXTwo.home * 100)}/${Math.round(probability.oneXTwo.draw * 100)}/${Math.round(probability.oneXTwo.away * 100)}`,
    },
    {
      id: "ev-xg",
      source: "probability-engine",
      label: "Expected goals (λ)",
      value: `${probability.expectedGoals.home.toFixed(2)} – ${probability.expectedGoals.away.toFixed(2)} (total ${probability.expectedGoals.total.toFixed(2)})`,
    },
    {
      id: "ev-ou",
      source: "probability-engine",
      label: "Over/Under 2.5",
      value: `Over ${Math.round(probability.overUnder25.over * 100)}% · Under ${Math.round(probability.overUnder25.under * 100)}%`,
    },
    {
      id: "ev-elo",
      source: "probability-engine",
      label: "Elo win expectancy (local)",
      value: `${(probability.elo.winExpectancyHome * 100).toFixed(0)}%`,
    },
    {
      id: "ev-model",
      source: "probability-engine",
      label: "Modelo",
      value: probability.meta.modelVersion,
    },
  ];

  if (input.leagueName) {
    evidence.push({
      id: "ev-league",
      source: "data-platform",
      label: "Competición",
      value: input.leagueName,
    });
  }
  if (input.dataProvider) {
    evidence.push({
      id: "ev-provider",
      source: "data-platform",
      label: "Fuente de datos",
      value: input.dataProvider,
    });
  }
  if (input.homeForm || input.awayForm) {
    evidence.push({
      id: "ev-form",
      source: "team-stats",
      label: "Forma reciente",
      value: `Local ${input.homeForm ?? "n/a"} · Visitante ${input.awayForm ?? "n/a"}`,
    });
  }
  if ((input.timelineEventCount ?? 0) > 0) {
    evidence.push({
      id: "ev-timeline",
      source: "timeline",
      label: "Eventos de timeline",
      value: String(input.timelineEventCount),
    });
  }

  evidence.push({
    id: "ev-method",
    source: "rules",
    label: "Método de explicación",
    value: "Reglas APEX Explainable AI v1 (sin OpenAI)",
  });

  return evidence;
}

function buildFactors(
  input: ExplainableAiInput,
  predicted: MatchOutcome,
  confidence: ConfidenceScore,
): { positive: ExplainableFactor[]; negative: ExplainableFactor[] } {
  const { probability } = input;
  const xg = probability.expectedGoals;
  const positive: ExplainableFactor[] = [];
  const negative: ExplainableFactor[] = [];

  if (input.strengths?.length) {
    for (const s of input.strengths.slice(0, 4)) {
      positive.push({
        id: s.id,
        label: s.label,
        detail: s.detail,
        weight: 0.22,
        polarity: "positive",
        evidenceIds: ["ev-xg", "ev-1x2"],
      });
    }
  } else {
    if (xg.home >= xg.away + 0.2) {
      positive.push({
        id: "pos-xg-home",
        label: "Ventaja de xG local",
        detail: `ΔxG = +${(xg.home - xg.away).toFixed(2)} a favor del local.`,
        weight: 0.28,
        polarity: "positive",
        evidenceIds: ["ev-xg"],
      });
    }
    if (xg.away >= xg.home + 0.2) {
      positive.push({
        id: "pos-xg-away",
        label: "Ventaja de xG visitante",
        detail: `ΔxG = +${(xg.away - xg.home).toFixed(2)} a favor del visitante.`,
        weight: 0.28,
        polarity: "positive",
        evidenceIds: ["ev-xg"],
      });
    }
    if (probability.elo.winExpectancyHome >= 0.58 && predicted === "home") {
      positive.push({
        id: "pos-elo",
        label: "Elo alineado con la predicción",
        detail: `Expectativa Elo local ${(probability.elo.winExpectancyHome * 100).toFixed(0)}%.`,
        weight: 0.24,
        polarity: "positive",
        evidenceIds: ["ev-elo"],
      });
    }
    if (probability.oneXTwo[predicted] >= 0.45) {
      positive.push({
        id: "pos-clarity",
        label: "Claridad en el desenlace favorito",
        detail: `P(predicción)=${(probability.oneXTwo[predicted] * 100).toFixed(0)}%.`,
        weight: 0.26,
        polarity: "positive",
        evidenceIds: ["ev-1x2"],
      });
    }
  }

  if (input.weaknesses?.length) {
    for (const w of input.weaknesses.slice(0, 4)) {
      negative.push({
        id: w.id,
        label: w.label,
        detail: w.detail,
        weight: 0.22,
        polarity: "negative",
        evidenceIds: ["ev-1x2", "ev-method"],
      });
    }
  } else {
    if (confidence.band === "low") {
      negative.push({
        id: "neg-entropy",
        label: "Alta incertidumbre",
        detail: "Entropía 1X2 elevada: la señal debe tomarse con cautela.",
        weight: 0.3,
        polarity: "negative",
        evidenceIds: ["ev-1x2"],
      });
    }
    if (probability.oneXTwo.draw >= 0.3) {
      negative.push({
        id: "neg-draw",
        label: "Masa de empate relevante",
        detail: `P(empate)=${(probability.oneXTwo.draw * 100).toFixed(0)}%.`,
        weight: 0.26,
        polarity: "negative",
        evidenceIds: ["ev-1x2"],
      });
    }
    if (Math.abs(xg.home - xg.away) < 0.15) {
      negative.push({
        id: "neg-xg-close",
        label: "xG casi empatados",
        detail: "Diferencia de goles esperados inferior a 0.15.",
        weight: 0.22,
        polarity: "negative",
        evidenceIds: ["ev-xg"],
      });
    }
  }

  if (positive.length === 0) {
    positive.push({
      id: "pos-default",
      label: "Señal del modelo disponible",
      detail: "El Probability Engine aportó una lectura 1X2 utilizable.",
      weight: 0.2,
      polarity: "positive",
      evidenceIds: ["ev-1x2", "ev-model"],
    });
  }
  if (negative.length === 0) {
    negative.push({
      id: "neg-default",
      label: "Sin riesgos críticos detectados",
      detail: "Las reglas no marcan un contrafactor dominante.",
      weight: 0.15,
      polarity: "negative",
      evidenceIds: ["ev-method"],
    });
  }

  return { positive: positive.slice(0, 5), negative: negative.slice(0, 5) };
}

function buildQualityScore(
  confidence: ConfidenceScore,
  evidenceCount: number,
  positiveCount: number,
  negativeCount: number,
): ExplanationQualityScore {
  const confidencePts = Math.round(confidence.value * 100);
  const evidencePts = Math.min(100, evidenceCount * 12);
  const balancePts = Math.min(
    100,
    40 + positiveCount * 10 + Math.max(0, 3 - negativeCount) * 8,
  );
  const value = Math.round(
    Math.min(
      100,
      Math.max(0, confidencePts * 0.45 + evidencePts * 0.3 + balancePts * 0.25),
    ),
  );
  const band: ExplanationQualityScore["band"] =
    value >= 75 ? "high" : value >= 50 ? "medium" : "low";

  return {
    value,
    band,
    label:
      band === "high"
        ? "Explicación robusta"
        : band === "medium"
          ? "Explicación aceptable"
          : "Explicación frágil",
    components: [
      { key: "confidence", label: "Confianza del modelo", value: confidencePts },
      { key: "evidence", label: "Cobertura de evidencias", value: evidencePts },
      { key: "balance", label: "Balance de factores", value: balancePts },
    ],
  };
}

function buildSummary(
  input: ExplainableAiInput,
  predicted: MatchOutcome,
  label: string,
  confidence: ConfidenceScore,
  quality: ExplanationQualityScore,
): string {
  const p = input.probability.oneXTwo[predicted];
  return `${input.homeTeamName} vs ${input.awayTeamName}: lectura ${label} (${Math.round(p * 100)}%) con confianza ${confidence.band}. Calidad de explicación ${quality.value}/100 — generada por reglas sobre el Probability Engine${input.dataProvider ? ` y datos ${input.dataProvider}` : ""}.`;
}

/**
 * Build a structured explainable prediction from existing system signals.
 */
export function explainPrediction(
  input: ExplainableAiInput,
): ExplainablePrediction {
  const confidence =
    input.confidence ?? confidenceFromProbability(input.probability);
  const predicted = mostLikelyOutcome(input.probability.oneXTwo);
  const predictedLabel = outcomeLabel(
    predicted,
    input.homeTeamName,
    input.awayTeamName,
  );
  const evidence = buildEvidence(input);
  const { positive, negative } = buildFactors(input, predicted, confidence);
  const qualityScore = buildQualityScore(
    confidence,
    evidence.length,
    positive.length,
    negative.length,
  );

  return {
    matchId: input.matchId,
    predictedOutcome: predicted,
    predictedLabel,
    summary: buildSummary(
      input,
      predicted,
      predictedLabel,
      confidence,
      qualityScore,
    ),
    confidence,
    positiveFactors: positive,
    negativeFactors: negative,
    evidence,
    qualityScore,
    generatedAt: new Date().toISOString(),
    method: "rules",
  };
}

export function createExplainableAiEngine() {
  return { explain: explainPrediction };
}
