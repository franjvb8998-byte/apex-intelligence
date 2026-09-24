/**
 * PE-4G.5 — Refinement fit: C2 selection on 2023, confirmatory 2024 compare.
 */

import { createHash } from "node:crypto";
import { loadTrainValidationRows } from "@/lib/debug/calibration/pe4-expectation/eligibility";
import { buildPe4ExpectationInternalFolds } from "@/lib/debug/calibration/pe4-expectation/folds";
import {
  calibrationBinsForClass,
  multiclassLogLoss,
  probabilityExtrema,
  scorePredictions,
  type MetricBundle,
  type OneXTwoProb,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import {
  fitBaseline0,
  predictBaseline0,
} from "@/lib/debug/calibration/pe4-expectation/model-baseline";
import {
  fitModelC,
  predictModelC,
  type ModelCArtifact,
} from "@/lib/debug/calibration/pe4-expectation/model-c";
import {
  assertModelC2DrawShapeValid,
  fitModelC2,
  modelC2DiagnosticGrid,
  predictModelC2,
  type ModelC2Artifact,
} from "@/lib/debug/calibration/pe4-expectation/model-c2";
import {
  fitModelD,
  predictModelD,
  type ModelDArtifact,
} from "@/lib/debug/calibration/pe4-expectation/model-d";
import { fitLowInfoFallbackPrior } from "@/lib/debug/calibration/pe4-expectation/low-information";
import { resolveHomeOrientedExpectation } from "@/lib/debug/calibration/pe4-expectation/low-information";
import {
  PE4_EXPECTATION_REFINEMENT_ABS_D_REGIONS,
  PE4_EXPECTATION_REFINEMENT_C2_L2_LAMBDAS,
  PE4_EXPECTATION_REFINEMENT_D_GRID,
  PE4_EXPECTATION_REFINEMENT_PARENT_PROTOCOL_DIGEST,
  PE4_EXPECTATION_REFINEMENT_PROTOCOL_VERSION,
  PE4_EXPECTATION_REFINEMENT_REQUIRED_DATASET_DIGEST,
  digestPe4ExpectationRefinementProtocol,
  pe4ExpectationRefinementProtocol,
} from "@/lib/debug/calibration/pe4-expectation/refinement-protocol";
import {
  PE4_EXPECTATION_POC_MODEL_C_L2_LAMBDAS,
  PE4_EXPECTATION_POC_MODEL_D_BIN_WIDTHS,
  PE4_EXPECTATION_POC_MODEL_D_SHRINK_KAPPA,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import { PE4_EXPECTATION_REFINEMENT_MODEL_VERSION } from "@/lib/debug/calibration/pe4-expectation/inference-adapter";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

function selectByInternalMean(
  candidates: {
    key: string;
    hyper: Record<string, number>;
    meanLogLoss: number;
    meanBrier: number;
    preferLargerRegularization: number;
  }[],
): (typeof candidates)[number] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.meanLogLoss !== b.meanLogLoss) return a.meanLogLoss - b.meanLogLoss;
    if (a.meanBrier !== b.meanBrier) return a.meanBrier - b.meanBrier;
    return b.preferLargerRegularization - a.preferLargerRegularization;
  });
  return sorted[0]!;
}

/** Reproduce PE-4G.4 frozen D/C selection on 2023 folds (parent benchmark). */
function selectPe4g4Benchmarks(
  folds: ReturnType<typeof buildPe4ExpectationInternalFolds>,
  trainEligible: readonly Pe4ExpectationDatasetRow[],
): { modelD: ModelDArtifact; modelC: ModelCArtifact } {
  const dCandidates: {
    key: string;
    hyper: Record<string, number>;
    meanLogLoss: number;
    meanBrier: number;
    preferLargerRegularization: number;
  }[] = [];
  for (const binWidth of PE4_EXPECTATION_POC_MODEL_D_BIN_WIDTHS) {
    for (const shrinkKappa of PE4_EXPECTATION_POC_MODEL_D_SHRINK_KAPPA) {
      const losses: number[] = [];
      const briers: number[] = [];
      for (const fold of folds) {
        const model = fitModelD({
          trainRows: fold.train,
          binWidth,
          shrinkKappa,
        });
        const preds = predictModelD(model, fold.eval);
        const scored = scorePredictions(
          preds,
          fold.eval.map((r) => r.actualOutcome),
        );
        losses.push(scored.logLoss);
        briers.push(scored.brier);
      }
      dCandidates.push({
        key: `D_w${binWidth}_k${shrinkKappa}`,
        hyper: { binWidth, shrinkKappa },
        meanLogLoss: losses.reduce((a, b) => a + b, 0) / losses.length,
        meanBrier: briers.reduce((a, b) => a + b, 0) / briers.length,
        preferLargerRegularization: shrinkKappa,
      });
    }
  }
  const dBest = selectByInternalMean(dCandidates);

  const cCandidates: {
    key: string;
    hyper: Record<string, number>;
    meanLogLoss: number;
    meanBrier: number;
    preferLargerRegularization: number;
  }[] = [];
  for (const l2Lambda of PE4_EXPECTATION_POC_MODEL_C_L2_LAMBDAS) {
    const losses: number[] = [];
    const briers: number[] = [];
    for (const fold of folds) {
      const model = fitModelC({ trainRows: fold.train, l2Lambda });
      const preds = predictModelC(model, fold.eval);
      const scored = scorePredictions(
        preds,
        fold.eval.map((r) => r.actualOutcome),
      );
      losses.push(scored.logLoss);
      briers.push(scored.brier);
    }
    cCandidates.push({
      key: `C_l2_${l2Lambda}`,
      hyper: { l2Lambda },
      meanLogLoss: losses.reduce((a, b) => a + b, 0) / losses.length,
      meanBrier: briers.reduce((a, b) => a + b, 0) / briers.length,
      preferLargerRegularization: l2Lambda,
    });
  }
  const cBest = selectByInternalMean(cCandidates);

  return {
    modelD: fitModelD({
      trainRows: trainEligible,
      binWidth: dBest.hyper.binWidth!,
      shrinkKappa: dBest.hyper.shrinkKappa!,
    }),
    modelC: fitModelC({
      trainRows: trainEligible,
      l2Lambda: cBest.hyper.l2Lambda!,
    }),
  };
}

function applyLowInfoPolicy(
  rows: readonly Pe4ExpectationDatasetRow[],
  modelPreds: readonly OneXTwoProb[],
  lowInfoPrior: OneXTwoProb,
  modelVersion: string,
): OneXTwoProb[] {
  return rows.map((row, i) => {
    const resolved = resolveHomeOrientedExpectation({
      qualityKind: row.qualityKind,
      lowInformationBothBasePrior: row.lowInformationBothBasePrior,
      modelPrediction: modelPreds[i]!,
      lowInfoPrior,
      modelVersion,
    });
    return resolved.expectedOneXTwo;
  });
}

function drawDiagnostics(
  preds: readonly OneXTwoProb[],
  rows: readonly Pe4ExpectationDatasetRow[],
) {
  const outcomes = rows.map((r) => r.actualOutcome);
  const drawIdx = outcomes
    .map((y, i) => (y === "DRAW" ? i : -1))
    .filter((i) => i >= 0);
  let drawLogLoss = 0;
  for (const i of drawIdx) {
    drawLogLoss += -Math.log(Math.max(1e-12, preds[i]!.DRAW));
  }
  drawLogLoss = drawIdx.length > 0 ? drawLogLoss / drawIdx.length : NaN;

  let drawBrierContrib = 0;
  for (let i = 0; i < preds.length; i += 1) {
    const t = outcomes[i] === "DRAW" ? 1 : 0;
    drawBrierContrib += (preds[i]!.DRAW - t) ** 2;
  }
  drawBrierContrib /= preds.length;

  const meanDrawPred =
    preds.reduce((s, p) => s + p.DRAW, 0) / Math.max(1, preds.length);
  const actualDrawRate =
    outcomes.filter((y) => y === "DRAW").length / Math.max(1, outcomes.length);

  const absDRegions = PE4_EXPECTATION_REFINEMENT_ABS_D_REGIONS.map(
    (region, idx) => {
      const lo =
        idx === 0
          ? 0
          : PE4_EXPECTATION_REFINEMENT_ABS_D_REGIONS[idx - 1]!.maxAbsExclusive;
      const hi = region.maxAbsExclusive;
      let n = 0;
      let sumP = 0;
      let sumY = 0;
      for (let i = 0; i < rows.length; i += 1) {
        const absD = Math.abs(rows[i]!.strengthDifferentialHome);
        if (absD >= lo && absD < hi) {
          n += 1;
          sumP += preds[i]!.DRAW;
          sumY += outcomes[i] === "DRAW" ? 1 : 0;
        }
      }
      return {
        id: region.id,
        lo,
        hi,
        n,
        meanPredictedDraw: n > 0 ? sumP / n : null,
        empiricalDrawRate: n > 0 ? sumY / n : null,
      };
    },
  );

  return {
    meanDrawPred,
    actualDrawRate,
    drawLogLossOnRealizedDraws: drawLogLoss,
    drawBrierContribution: drawBrierContrib,
    drawProbMin: Math.min(...preds.map((p) => p.DRAW)),
    drawProbMax: Math.max(...preds.map((p) => p.DRAW)),
    absDRegions,
  };
}

export function runPe4ExpectationRefinement(input: {
  rows: readonly Pe4ExpectationDatasetRow[];
  datasetDigest: string;
}): {
  protocolDigest: string;
  parentProtocolDigest: string;
  protocolVersion: string;
  datasetDigest: string;
  trainEligibleCount: number;
  confirmatoryCount: number;
  modelC2: ModelC2Artifact;
  modelC2Selection: {
    l2Lambda: number;
    internalMeanLogLoss: number;
    internalMeanBrier: number;
  };
  modelC: ModelCArtifact;
  modelD: ModelDArtifact;
  baseline0: ReturnType<typeof fitBaseline0>;
  lowInfoPrior: OneXTwoProb;
  preValidationDrawShape: { D: number; p: OneXTwoProb }[];
  identifiability: {
    featureCorrelationZAbs: number;
    dMin: number;
    dMax: number;
    dMean: number;
    dStd: number;
    note: string;
  };
  complexity: {
    modelCParamCount: number;
    modelC2ParamCount: number;
    modelCInternalMeanLogLoss: number;
    modelC2InternalMeanLogLoss: number;
    modelCTrainLogLoss: number;
    modelC2TrainLogLoss: number;
  };
  confirmatory: Record<
    string,
    {
      metricsAll: MetricBundle;
      metricsCatalogue: MetricBundle;
      metricsBothBasePrior: MetricBundle | null;
      draw: ReturnType<typeof drawDiagnostics>;
      calibration: {
        extrema: ReturnType<typeof probabilityExtrema>;
        drawBins: ReturnType<typeof calibrationBinsForClass>;
      };
    }
  >;
  resultDigest: string;
} {
  if (input.datasetDigest !== PE4_EXPECTATION_REFINEMENT_REQUIRED_DATASET_DIGEST) {
    throw new Error("dataset digest mismatch vs refinement protocol");
  }

  const protocol = pe4ExpectationRefinementProtocol();
  const protocolDigest = digestPe4ExpectationRefinementProtocol(protocol);
  if (
    protocol.parentProtocolDigest !==
    PE4_EXPECTATION_REFINEMENT_PARENT_PROTOCOL_DIGEST
  ) {
    throw new Error("parent protocol digest mismatch");
  }

  const splits = loadTrainValidationRows(input.rows);
  const folds = buildPe4ExpectationInternalFolds(splits.trainEligible);

  // --- C2 λ selection on 2023 only ---
  const c2Candidates: {
    key: string;
    hyper: Record<string, number>;
    meanLogLoss: number;
    meanBrier: number;
    preferLargerRegularization: number;
  }[] = [];
  for (const l2Lambda of PE4_EXPECTATION_REFINEMENT_C2_L2_LAMBDAS) {
    const losses: number[] = [];
    const briers: number[] = [];
    for (const fold of folds) {
      const model = fitModelC2({ trainRows: fold.train, l2Lambda });
      const preds = predictModelC2(model, fold.eval);
      const scored = scorePredictions(
        preds,
        fold.eval.map((r) => r.actualOutcome),
      );
      losses.push(scored.logLoss);
      briers.push(scored.brier);
    }
    c2Candidates.push({
      key: `C2_l2_${l2Lambda}`,
      hyper: { l2Lambda },
      meanLogLoss: losses.reduce((a, b) => a + b, 0) / losses.length,
      meanBrier: briers.reduce((a, b) => a + b, 0) / briers.length,
      preferLargerRegularization: l2Lambda,
    });
  }
  const c2Best = selectByInternalMean(c2Candidates);

  const modelC2 = fitModelC2({
    trainRows: splits.trainEligible,
    l2Lambda: c2Best.hyper.l2Lambda!,
  });

  // Pre-2024 draw shape validity
  const preValidationDrawShape = modelC2DiagnosticGrid(
    modelC2,
    PE4_EXPECTATION_REFINEMENT_D_GRID,
  );
  assertModelC2DrawShapeValid(preValidationDrawShape);

  const benchmarks = selectPe4g4Benchmarks(folds, splits.trainEligible);
  const baseline0 = fitBaseline0(splits.trainEligible);
  const lowInfoPrior = fitLowInfoFallbackPrior(splits.trainEligible);

  // Complexity: training LL + C internal mean (from recompute)
  let cInternalMean = 0;
  const c2InternalMean = c2Best.meanLogLoss;
  {
    const losses: number[] = [];
    for (const fold of folds) {
      const m = fitModelC({
        trainRows: fold.train,
        l2Lambda: benchmarks.modelC.l2Lambda,
      });
      const preds = predictModelC(m, fold.eval);
      losses.push(
        scorePredictions(
          preds,
          fold.eval.map((r) => r.actualOutcome),
        ).logLoss,
      );
    }
    cInternalMean = losses.reduce((a, b) => a + b, 0) / losses.length;
  }

  const trainY = splits.trainEligible.map((r) => r.actualOutcome);
  const modelCTrainLogLoss = multiclassLogLoss(
    predictModelC(benchmarks.modelC, splits.trainEligible),
    trainY,
  );
  const modelC2TrainLogLoss = multiclassLogLoss(
    predictModelC2(modelC2, splits.trainEligible),
    trainY,
  );

  // --- Confirmatory 2024 (after freeze) ---
  const val = splits.validationAll;
  const valCat = splits.validationCatalogue;
  const valBp = splits.validationBothBasePrior;
  const yAll = val.map((r) => r.actualOutcome);
  const yCat = valCat.map((r) => r.actualOutcome);
  const yBp = valBp.map((r) => r.actualOutcome);

  function packFamily(name: string, applyPolicy: boolean) {
    const subsetPreds = (rows: readonly Pe4ExpectationDatasetRow[]) => {
      const raw = predictFamilyRaw(name, rows);
      return applyPolicy
        ? applyLowInfoPolicy(
            rows,
            raw,
            lowInfoPrior,
            PE4_EXPECTATION_REFINEMENT_MODEL_VERSION,
          )
        : raw;
    };

    const pAll = subsetPreds(val);
    const pCat = subsetPreds(valCat);
    const pBp = subsetPreds(valBp);

    return {
      metricsAll: scorePredictions(pAll, yAll),
      metricsCatalogue: scorePredictions(pCat, yCat),
      metricsBothBasePrior:
        yBp.length > 0 ? scorePredictions(pBp, yBp) : null,
      draw: drawDiagnostics(pAll, val),
      calibration: {
        extrema: probabilityExtrema(pAll),
        drawBins: calibrationBinsForClass(pAll, yAll, "DRAW"),
      },
    };
  }

  function predictFamilyRaw(
    name: string,
    rows: readonly Pe4ExpectationDatasetRow[],
  ): OneXTwoProb[] {
    if (name === "BASELINE_0") return predictBaseline0(baseline0, rows);
    if (name === "MODEL_D") return predictModelD(benchmarks.modelD, rows);
    if (name === "MODEL_C") return predictModelC(benchmarks.modelC, rows);
    if (name === "MODEL_C2") return predictModelC2(modelC2, rows);
    throw new Error(`unknown family ${name}`);
  }

  const confirmatory = {
    BASELINE_0: packFamily("BASELINE_0", false),
    MODEL_D: packFamily("MODEL_D", true),
    MODEL_C: packFamily("MODEL_C", true),
    MODEL_C2: packFamily("MODEL_C2", true),
  };

  const Ds = splits.trainEligible.map((r) => r.strengthDifferentialHome);
  const resultPayload = {
    protocolDigest,
    modelC2Digest: modelC2.parameterDigest,
    confirmatory: Object.fromEntries(
      Object.entries(confirmatory).map(([k, v]) => [
        k,
        { logLoss: v.metricsAll.logLoss, brier: v.metricsAll.brier },
      ]),
    ),
  };
  const resultDigest = createHash("sha256")
    .update(JSON.stringify(resultPayload), "utf8")
    .digest("hex");

  return {
    protocolDigest,
    parentProtocolDigest: PE4_EXPECTATION_REFINEMENT_PARENT_PROTOCOL_DIGEST,
    protocolVersion: PE4_EXPECTATION_REFINEMENT_PROTOCOL_VERSION,
    datasetDigest: input.datasetDigest,
    trainEligibleCount: splits.trainEligible.length,
    confirmatoryCount: val.length,
    modelC2,
    modelC2Selection: {
      l2Lambda: modelC2.l2Lambda,
      internalMeanLogLoss: c2Best.meanLogLoss,
      internalMeanBrier: c2Best.meanBrier,
    },
    modelC: benchmarks.modelC,
    modelD: benchmarks.modelD,
    baseline0,
    lowInfoPrior,
    preValidationDrawShape,
    identifiability: {
      featureCorrelationZAbs: modelC2.featureCorrelationZAbs,
      dMin: Math.min(...Ds),
      dMax: Math.max(...Ds),
      dMean: modelC2.dMean,
      dStd: modelC2.dStd,
      note:
        "zD and abs(zD) are not highly collinear when D is roughly symmetric around 0; abs(zD) is piecewise-linear. Conditioning mitigated by L2.",
    },
    complexity: {
      modelCParamCount: 4,
      modelC2ParamCount: 6,
      modelCInternalMeanLogLoss: cInternalMean,
      modelC2InternalMeanLogLoss: c2InternalMean,
      modelCTrainLogLoss,
      modelC2TrainLogLoss,
    },
    confirmatory,
    resultDigest,
  };
}
