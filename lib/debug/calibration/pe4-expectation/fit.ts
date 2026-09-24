/**
 * PE-4G.4 — Orchestrate internal selection + freeze + 2024 validation.
 */

import { createHash } from "node:crypto";
import { loadTrainValidationRows } from "@/lib/debug/calibration/pe4-expectation/eligibility";
import { buildPe4ExpectationInternalFolds } from "@/lib/debug/calibration/pe4-expectation/folds";
import {
  scorePredictions,
  type MetricBundle,
  type OneXTwoProb,
} from "@/lib/debug/calibration/pe4-expectation/metrics";
import {
  fitBaseline0,
  predictBaseline0,
  type Baseline0Model,
} from "@/lib/debug/calibration/pe4-expectation/model-baseline";
import {
  fitModelC,
  modelCDiagnosticGrid,
  predictModelC,
  type ModelCArtifact,
} from "@/lib/debug/calibration/pe4-expectation/model-c";
import {
  fitModelD,
  modelDBinIndex,
  predictModelD,
  type ModelDArtifact,
} from "@/lib/debug/calibration/pe4-expectation/model-d";
import {
  digestPe4ExpectationPocProtocol,
  PE4_EXPECTATION_POC_MODEL_B_STATUS,
  PE4_EXPECTATION_POC_MODEL_C_L2_LAMBDAS,
  PE4_EXPECTATION_POC_MODEL_D_BIN_WIDTHS,
  PE4_EXPECTATION_POC_MODEL_D_SHRINK_KAPPA,
  PE4_EXPECTATION_POC_PROTOCOL_VERSION,
  PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST,
  PE4_EXPECTATION_POC_VENUE_NOTE,
  pe4ExpectationPocProtocol,
} from "@/lib/debug/calibration/pe4-expectation/protocol";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";

export type FamilyValidationReport = {
  family: string;
  hyperparameters: Record<string, number | string>;
  parameterDigest: string;
  metricsAll: MetricBundle;
  metricsCatalogue: MetricBundle;
  metricsBothBasePrior: MetricBundle | null;
  deltaLogLossVsBaseline0: number;
  deltaBrierVsBaseline0: number;
  strengthSignal: "improved" | "approximately_tied" | "worse";
};

function classifyDelta(deltaLogLoss: number): "improved" | "approximately_tied" | "worse" {
  // Descriptive only — no arbitrary significance. Tiny threshold for float noise.
  if (deltaLogLoss < -1e-6) return "improved";
  if (deltaLogLoss > 1e-6) return "worse";
  return "approximately_tied";
}

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

export function runPe4ExpectationPoc(input: {
  rows: readonly Pe4ExpectationDatasetRow[];
  datasetDigest: string;
}): {
  protocolDigest: string;
  protocolVersion: string;
  datasetDigest: string;
  trainEligibleCount: number;
  trainAllCount: number;
  validationCount: number;
  holdoutSeasonExcluded: true;
  venueNote: string;
  modelBStatus: string;
  internalFoldSummaries: {
    id: string;
    trainCount: number;
    evalCount: number;
    trainFirstKickoffUtc: string;
    trainLastKickoffUtc: string;
    evalFirstKickoffUtc: string;
    evalLastKickoffUtc: string;
    trainFixtureDigest: string;
    evalFixtureDigest: string;
  }[];
  baseline0: Baseline0Model;
  modelD: ModelDArtifact;
  modelC: ModelCArtifact;
  modelDSelection: {
    binWidth: number;
    shrinkKappa: number;
    internalMeanLogLoss: number;
    internalMeanBrier: number;
  };
  modelCSelection: {
    l2Lambda: number;
    internalMeanLogLoss: number;
    internalMeanBrier: number;
  };
  validation: {
    BASELINE_0: FamilyValidationReport;
    MODEL_D: FamilyValidationReport;
    MODEL_C: FamilyValidationReport;
  };
  modelCDrawGrid: { D: number; p: OneXTwoProb }[];
  modelDBinValidationCounts: { id: string; trainCount: number; validationCount: number }[];
  resultDigest: string;
} {
  if (input.datasetDigest !== PE4_EXPECTATION_POC_REQUIRED_DATASET_DIGEST) {
    throw new Error("dataset digest mismatch vs frozen protocol");
  }

  const protocol = pe4ExpectationPocProtocol();
  const protocolDigest = digestPe4ExpectationPocProtocol(protocol);

  const splits = loadTrainValidationRows(input.rows);
  const folds = buildPe4ExpectationInternalFolds(splits.trainEligible);

  // --- Model D hyperparameter selection on 2023 folds only ---
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

  // --- Model C hyperparameter selection on 2023 folds only ---
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

  // --- Freeze on all eligible 2023 ---
  const baseline0 = fitBaseline0(splits.trainEligible);
  const modelD = fitModelD({
    trainRows: splits.trainEligible,
    binWidth: dBest.hyper.binWidth!,
    shrinkKappa: dBest.hyper.shrinkKappa!,
  });
  const modelC = fitModelC({
    trainRows: splits.trainEligible,
    l2Lambda: cBest.hyper.l2Lambda!,
  });

  // --- Single 2024 evaluation ---
  const yAll = splits.validationAll.map((r) => r.actualOutcome);
  const yCat = splits.validationCatalogue.map((r) => r.actualOutcome);
  const yBp = splits.validationBothBasePrior.map((r) => r.actualOutcome);

  function reportFamily(
    family: string,
    hyper: Record<string, number | string>,
    parameterDigest: string,
    predsAll: OneXTwoProb[],
    predsCat: OneXTwoProb[],
    predsBp: OneXTwoProb[],
    baselineMetrics: MetricBundle,
  ): FamilyValidationReport {
    const metricsAll = scorePredictions(predsAll, yAll);
    const metricsCatalogue = scorePredictions(predsCat, yCat);
    const metricsBothBasePrior =
      yBp.length > 0 ? scorePredictions(predsBp, yBp) : null;
    const deltaLogLossVsBaseline0 = metricsAll.logLoss - baselineMetrics.logLoss;
    const deltaBrierVsBaseline0 = metricsAll.brier - baselineMetrics.brier;
    return {
      family,
      hyperparameters: hyper,
      parameterDigest,
      metricsAll,
      metricsCatalogue,
      metricsBothBasePrior,
      deltaLogLossVsBaseline0,
      deltaBrierVsBaseline0,
      strengthSignal: classifyDelta(deltaLogLossVsBaseline0),
    };
  }

  const predB0All = predictBaseline0(baseline0, splits.validationAll);
  const predB0Cat = predictBaseline0(baseline0, splits.validationCatalogue);
  const predB0Bp = predictBaseline0(baseline0, splits.validationBothBasePrior);
  const baselineMetricsAll = scorePredictions(predB0All, yAll);

  const validation = {
    BASELINE_0: reportFamily(
      "BASELINE_0",
      {},
      createHash("sha256")
        .update(JSON.stringify(baseline0.prior), "utf8")
        .digest("hex"),
      predB0All,
      predB0Cat,
      predB0Bp,
      baselineMetricsAll,
    ),
    MODEL_D: reportFamily(
      "MODEL_D_EMPIRICAL_BINS",
      { binWidth: modelD.binWidth, shrinkKappa: modelD.shrinkKappa },
      modelD.parameterDigest,
      predictModelD(modelD, splits.validationAll),
      predictModelD(modelD, splits.validationCatalogue),
      predictModelD(modelD, splits.validationBothBasePrior),
      baselineMetricsAll,
    ),
    MODEL_C: reportFamily(
      "MODEL_C_MULTINOMIAL_LOGIT",
      { l2Lambda: modelC.l2Lambda },
      modelC.parameterDigest,
      predictModelC(modelC, splits.validationAll),
      predictModelC(modelC, splits.validationCatalogue),
      predictModelC(modelC, splits.validationBothBasePrior),
      baselineMetricsAll,
    ),
  };

  // Baseline delta vs itself should be ~0
  validation.BASELINE_0.deltaLogLossVsBaseline0 = 0;
  validation.BASELINE_0.deltaBrierVsBaseline0 = 0;
  validation.BASELINE_0.strengthSignal = "approximately_tied";

  const modelCDrawGrid = modelCDiagnosticGrid(
    modelC,
    [-200, -100, -50, -20, 0, 20, 50, 100, 200],
  );

  const valCounts = modelD.bins.map(() => 0);
  for (const row of splits.validationAll) {
    const idx = modelDBinIndex(row.strengthDifferentialHome, modelD.binWidth);
    valCounts[idx]! += 1;
  }
  const modelDBinValidationCounts = modelD.bins.map((bin, i) => ({
    id: bin.id,
    trainCount: bin.trainCount,
    validationCount: valCounts[i]!,
  }));

  const resultPayload = {
    protocolDigest,
    modelDDigest: modelD.parameterDigest,
    modelCDigest: modelC.parameterDigest,
    validation,
  };
  const resultDigest = createHash("sha256")
    .update(JSON.stringify(resultPayload), "utf8")
    .digest("hex");

  return {
    protocolDigest,
    protocolVersion: PE4_EXPECTATION_POC_PROTOCOL_VERSION,
    datasetDigest: input.datasetDigest,
    trainEligibleCount: splits.trainEligible.length,
    trainAllCount: splits.trainAll.length,
    validationCount: splits.validationAll.length,
    holdoutSeasonExcluded: true,
    venueNote: PE4_EXPECTATION_POC_VENUE_NOTE,
    modelBStatus: PE4_EXPECTATION_POC_MODEL_B_STATUS,
    internalFoldSummaries: folds.map((f) => ({
      id: f.id,
      trainCount: f.train.length,
      evalCount: f.eval.length,
      trainFirstKickoffUtc: f.trainFirstKickoffUtc,
      trainLastKickoffUtc: f.trainLastKickoffUtc,
      evalFirstKickoffUtc: f.evalFirstKickoffUtc,
      evalLastKickoffUtc: f.evalLastKickoffUtc,
      trainFixtureDigest: f.trainFixtureDigest,
      evalFixtureDigest: f.evalFixtureDigest,
    })),
    baseline0,
    modelD,
    modelC,
    modelDSelection: {
      binWidth: modelD.binWidth,
      shrinkKappa: modelD.shrinkKappa,
      internalMeanLogLoss: dBest.meanLogLoss,
      internalMeanBrier: dBest.meanBrier,
    },
    modelCSelection: {
      l2Lambda: modelC.l2Lambda,
      internalMeanLogLoss: cBest.meanLogLoss,
      internalMeanBrier: cBest.meanBrier,
    },
    validation,
    modelCDrawGrid,
    modelDBinValidationCounts,
    resultDigest,
  };
}
