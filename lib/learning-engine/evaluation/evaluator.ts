import type { LearningEvaluator } from "@/lib/learning-engine/contracts";
import type { LearningCaseRepository } from "@/lib/learning-engine/contracts";
import type { LearningCase, MatchOutcome } from "@/lib/learning-engine/types/case";
import type {
  CalibrationBin,
  DetectedBias,
  EvaluationReport,
  ModelRecommendation,
  RepetitivePattern,
} from "@/lib/learning-engine/types/evaluation";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function emptyOutcomeStats(): Record<
  MatchOutcome,
  { support: number; accuracy: number }
> {
  return {
    home: { support: 0, accuracy: 0 },
    draw: { support: 0, accuracy: 0 },
    away: { support: 0, accuracy: 0 },
  };
}

/**
 * Heuristic evaluator — architecture-ready for richer metrics later.
 * Does not call the Probability Engine.
 */
export class DefaultLearningEvaluator implements LearningEvaluator {
  constructor(private readonly cases: LearningCaseRepository) {}

  async evaluate(input: {
    modelVersion?: string;
    caseIds?: string[];
  } = {}): Promise<EvaluationReport> {
    let cases = await this.cases.listByModel(input.modelVersion);
    if (input.caseIds?.length) {
      const allowed = new Set(input.caseIds);
      cases = cases.filter((c) => allowed.has(c.id));
    }

    const modelVersion =
      input.modelVersion ??
      cases[0]?.prediction.modelVersion ??
      "unknown";

    const sampleSize = cases.length;
    const outcomeAccuracy =
      sampleSize === 0
        ? 0
        : cases.filter((c) => c.outcomeCorrect).length / sampleSize;

    const byOutcome = computeByOutcome(cases);
    const markets = computeMarketStats(cases);
    const calibration = computeCalibration(cases);
    const biases = detectBiases(cases);
    const patterns = detectPatterns(cases);
    const recommendations = buildRecommendations({
      outcomeAccuracy,
      calibrationEce: calibration.ece,
      biases,
      patterns,
      markets,
      sampleSize,
    });

    const meanBrier =
      sampleSize === 0
        ? 0
        : cases.reduce((s, c) => s + c.error.brierScore, 0) / sampleSize;
    const meanOutcomeError =
      sampleSize === 0
        ? 0
        : cases.reduce((s, c) => s + c.error.outcomeError, 0) / sampleSize;

    return {
      id: `eval:${modelVersion}:${Date.now()}`,
      modelVersion,
      sampleSize,
      evaluatedAt: new Date().toISOString(),
      accuracy: {
        outcome: outcomeAccuracy,
        byOutcome,
        markets,
      },
      calibration,
      biases,
      patterns,
      recommendations,
      aggregateError: {
        meanBrier,
        meanOutcomeError,
      },
    };
  }
}

function computeByOutcome(cases: LearningCase[]) {
  const stats = emptyOutcomeStats();
  const counts: Record<MatchOutcome, { total: number; hits: number }> = {
    home: { total: 0, hits: 0 },
    draw: { total: 0, hits: 0 },
    away: { total: 0, hits: 0 },
  };

  for (const item of cases) {
    const key = item.prediction.predictedOutcome;
    counts[key].total += 1;
    if (item.outcomeCorrect) counts[key].hits += 1;
  }

  for (const key of Object.keys(counts) as MatchOutcome[]) {
    const row = counts[key];
    stats[key] = {
      support: row.total,
      accuracy: row.total === 0 ? 0 : row.hits / row.total,
    };
  }
  return stats;
}

function computeMarketStats(cases: LearningCase[]) {
  const map = new Map<string, { support: number; hits: number }>();
  for (const item of cases) {
    for (const market of [...item.marketsHit, ...item.marketsMissed]) {
      const row = map.get(market.market) ?? { support: 0, hits: 0 };
      row.support += 1;
      if (market.hit) row.hits += 1;
      map.set(market.market, row);
    }
  }
  const out: Record<string, { support: number; hitRate: number }> = {};
  for (const [market, row] of map) {
    out[market] = {
      support: row.support,
      hitRate: row.support === 0 ? 0 : row.hits / row.support,
    };
  }
  return out;
}

function computeCalibration(cases: LearningCase[]): {
  ece: number;
  bins: CalibrationBin[];
} {
  const binCount = 5;
  const bins: Array<{ sumPred: number; hits: number; count: number }> =
    Array.from({ length: binCount }, () => ({
      sumPred: 0,
      hits: 0,
      count: 0,
    }));

  for (const item of cases) {
    const p = item.prediction.confidence;
    const index = Math.min(binCount - 1, Math.floor(p * binCount));
    const bin = bins[index]!;
    bin.count += 1;
    bin.sumPred += p;
    if (item.outcomeCorrect) bin.hits += 1;
  }

  const resultBins: CalibrationBin[] = [];
  let ece = 0;
  const n = Math.max(cases.length, 1);

  for (let i = 0; i < binCount; i += 1) {
    const bin = bins[i]!;
    if (bin.count === 0) {
      resultBins.push({
        predicted: (i + 0.5) / binCount,
        observed: 0,
        count: 0,
      });
      continue;
    }
    const predicted = bin.sumPred / bin.count;
    const observed = bin.hits / bin.count;
    resultBins.push({ predicted, observed, count: bin.count });
    ece += (bin.count / n) * Math.abs(predicted - observed);
  }

  return { ece: clamp01(ece), bins: resultBins };
}

function detectBiases(cases: LearningCase[]): DetectedBias[] {
  const biases: DetectedBias[] = [];
  if (cases.length === 0) return biases;

  const homePreds = cases.filter(
    (c) => c.prediction.predictedOutcome === "home",
  );
  const homeMissHighConf = homePreds.filter(
    (c) => !c.outcomeCorrect && c.prediction.confidence >= 0.65,
  );
  if (homePreds.length >= 2 && homeMissHighConf.length / homePreds.length >= 0.4) {
    biases.push({
      id: "bias-home-overconfidence",
      kind: "home_favorite_overconfidence",
      label: "Sobreconfianza en favoritos locales",
      severity: "medium",
      score: homeMissHighConf.length / homePreds.length,
      evidence: [
        `${homeMissHighConf.length}/${homePreds.length} predicciones local con confianza≥0.65 fallaron`,
      ],
    });
  }

  const drawActual = cases.filter((c) => c.actual.outcome === "draw");
  const drawPredicted = cases.filter(
    (c) => c.prediction.predictedOutcome === "draw",
  );
  if (drawActual.length >= 2 && drawPredicted.length === 0) {
    biases.push({
      id: "bias-draw-under",
      kind: "draw_underestimation",
      label: "Subestimación de empates",
      severity: "high",
      score: 0.7,
      evidence: [
        `${drawActual.length} empates reales sin ninguna predicción de empate en la muestra`,
      ],
    });
  }

  const highConfMisses = cases.filter(
    (c) => !c.outcomeCorrect && c.prediction.confidence >= 0.7,
  );
  if (highConfMisses.length >= 2) {
    biases.push({
      id: "bias-high-conf-miss",
      kind: "high_confidence_miss",
      label: "Fallos en alta confianza",
      severity: "medium",
      score: highConfMisses.length / cases.length,
      evidence: [
        `${highConfMisses.length} fallos con confianza≥0.70`,
      ],
    });
  }

  const ou = cases.flatMap((c) =>
    [...c.marketsHit, ...c.marketsMissed].filter(
      (m) => m.market === "over_under_25",
    ),
  );
  const ouMiss = ou.filter((m) => !m.hit && m.selection === "over");
  if (ou.length >= 3 && ouMiss.length / ou.length >= 0.5) {
    biases.push({
      id: "bias-ou-over",
      kind: "market_over_25_bias",
      label: "Sesgo Over 2.5",
      severity: "low",
      score: ouMiss.length / ou.length,
      evidence: [
        `${ouMiss.length}/${ou.length} selecciones Over 2.5 fallaron`,
      ],
    });
  }

  return biases;
}

function detectPatterns(cases: LearningCase[]): RepetitivePattern[] {
  const patterns: RepetitivePattern[] = [];

  const missedWithInjuryFactor = cases.filter(
    (c) =>
      !c.outcomeCorrect &&
      c.prediction.factors.some((f) =>
        f.key.toLowerCase().includes("injur"),
      ),
  );
  if (missedWithInjuryFactor.length >= 2) {
    patterns.push({
      id: "pattern-injury-miss",
      label: "Fallos con factor de lesiones",
      description:
        "Errores repetidos cuando el modelo ya marcaba incertidumbre por bajas.",
      matchIds: missedWithInjuryFactor.map((c) => c.prediction.matchId),
      frequency: missedWithInjuryFactor.length / Math.max(cases.length, 1),
      confidence: 0.6,
    });
  }

  const bttsMiss = cases.filter((c) =>
    c.marketsMissed.some((m) => m.market === "btts"),
  );
  if (bttsMiss.length >= 2) {
    patterns.push({
      id: "pattern-btts-miss",
      label: "Fallos recurrentes en BTTS",
      description: "El mercado BTTS concentra errores en la muestra actual.",
      matchIds: bttsMiss.map((c) => c.prediction.matchId),
      frequency: bttsMiss.length / Math.max(cases.length, 1),
      confidence: 0.55,
    });
  }

  return patterns;
}

function buildRecommendations(input: {
  outcomeAccuracy: number;
  calibrationEce: number;
  biases: DetectedBias[];
  patterns: RepetitivePattern[];
  markets: Record<string, { support: number; hitRate: number }>;
  sampleSize: number;
}): ModelRecommendation[] {
  const recs: ModelRecommendation[] = [];

  if (input.sampleSize < 5) {
    recs.push({
      id: "rec-more-data",
      priority: "high",
      area: "data",
      title: "Ampliar muestra de aprendizaje",
      detail: `Solo ${input.sampleSize} casos cerrados; las métricas son inestables.`,
      suggestedAction:
        "Registrar más partidos finalizados antes de recalibrar pesos del modelo.",
    });
  }

  if (input.calibrationEce >= 0.12) {
    recs.push({
      id: "rec-calibration",
      priority: "high",
      area: "calibration",
      title: "Recalibrar confianza",
      detail: `ECE≈${input.calibrationEce.toFixed(3)} indica desajuste predicción↔frecuencia.`,
      suggestedAction:
        "Ajustar el calibrador de confianza (isotonic/Platt) sobre el histórico.",
    });
  }

  if (input.outcomeAccuracy < 0.45 && input.sampleSize >= 3) {
    recs.push({
      id: "rec-features",
      priority: "medium",
      area: "features",
      title: "Revisar variables de entrada",
      detail: `Accuracy 1X2=${(input.outcomeAccuracy * 100).toFixed(1)}% por debajo del umbral útil.`,
      suggestedAction:
        "Auditar features con mayor peso en fallos (lesiones, fatiga, H2H).",
    });
  }

  for (const bias of input.biases.slice(0, 3)) {
    recs.push({
      id: `rec-bias-${bias.kind}`,
      priority: bias.severity === "high" ? "high" : "medium",
      area: "process",
      title: `Mitigar: ${bias.label}`,
      detail: bias.evidence.join(" "),
      suggestedAction:
        "Añadir regla de guardrail o feature correctora antes del blend final.",
    });
  }

  const ou = input.markets.over_under_25;
  if (ou && ou.support >= 3 && ou.hitRate < 0.4) {
    recs.push({
      id: "rec-ou-market",
      priority: "medium",
      area: "markets",
      title: "Reentrenar capa Over/Under 2.5",
      detail: `Hit-rate O/U 2.5=${(ou.hitRate * 100).toFixed(1)}% en ${ou.support} apuestas.`,
      suggestedAction:
        "Separar calibración de goles esperados del bloque 1X2.",
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "rec-maintain",
      priority: "low",
      area: "process",
      title: "Mantener monitoreo",
      detail: "No se detectaron degradaciones severas en la muestra actual.",
      suggestedAction:
        "Seguir acumulando casos y revisar ECE semanalmente.",
    });
  }

  return recs;
}

export function createLearningEvaluator(
  cases: LearningCaseRepository,
): LearningEvaluator {
  return new DefaultLearningEvaluator(cases);
}
