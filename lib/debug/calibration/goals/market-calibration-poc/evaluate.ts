/**
 * GOALS-1G.2 — Constrained market calibration POC evaluation.
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  assertG1Coherence,
  predictG1FromEvidence,
} from "@/lib/debug/calibration/goals/g1/predict";
import { buildCanonicalObservations } from "@/lib/debug/calibration/goals/market-calibration/observations";
import {
  applySelectionsToObservations,
  assertNoDedicatedO05Calibrator,
  type CalibratedObservation,
} from "@/lib/debug/calibration/goals/market-calibration-poc/apply";
import {
  buildGroupArtifact,
  digestArtifactBundle,
  type GoalsMcalPocArtifact,
} from "@/lib/debug/calibration/goals/market-calibration-poc/artifact";
import { bootstrapDeltaMetrics } from "@/lib/debug/calibration/goals/market-calibration-poc/bootstrap";
import { buildDevelopmentFolds } from "@/lib/debug/calibration/goals/market-calibration-poc/folds";
import {
  aggregateGroupMetrics,
  calMarketMetrics,
  rawMarketMetrics,
  type ProbMetrics,
} from "@/lib/debug/calibration/goals/market-calibration-poc/metrics";
import {
  digestGoalsMcalPocProtocol,
  GOALS_MCAL_POC_CANONICAL_MARKETS,
  GOALS_MCAL_POC_CONFIRMATORY_SEASON,
  GOALS_MCAL_POC_DEV_SEASON,
  GOALS_MCAL_POC_GROUP_AWAY_TOTAL,
  GOALS_MCAL_POC_GROUP_HOME_TOTAL,
  GOALS_MCAL_POC_GROUP_MATCH_TOTAL,
  GOALS_MCAL_POC_HOLDOUT_SEASON,
  GOALS_MCAL_POC_PARENT_G1_K,
  GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST,
  goalsMcalPocProtocol,
  type GoalsMcalPocCanonicalMarket,
  type GoalsMcalPocGroupId,
} from "@/lib/debug/calibration/goals/market-calibration-poc/protocol";
import {
  selectAllGroups,
  type GroupSelectionResult,
} from "@/lib/debug/calibration/goals/market-calibration-poc/select";

export type MarketCompareRow = {
  market: GoalsMcalPocCanonicalMarket;
  selectedFamily: "CAL_0" | "CAL_1";
  groupId: GoalsMcalPocGroupId;
  raw: ProbMetrics;
  cal: ProbMetrics;
  deltaLl: number;
  deltaBrier: number;
  rawCitl: number;
  calCitl: number;
};

export type GeneralizationClass =
  | "GENERALIZES"
  | "WEAK_GENERALIZATION"
  | "DOES_NOT_GENERALIZE"
  | "CAL_0_RETAINED";

export type Ou05Confirmatory = {
  zeroZeroCount: number;
  n: number;
  actualUnder05Rate: number;
  rawMeanUnder05: number;
  calMeanUnder05: number;
  rawLl: number;
  calLl: number;
  rawBrier: number;
  calBrier: number;
  rawCitl: number;
  calCitl: number;
  classification:
    | "IMPROVED"
    | "UNCHANGED"
    | "WORSE"
    | "LOW_SUPPORT_INCONCLUSIVE";
};

function seasonOf(
  obs: readonly CalibratedObservation[],
  season: string,
): CalibratedObservation[] {
  return obs.filter((o) => o.season === season);
}

function classifyGeneralization(
  sel: GroupSelectionResult,
  confirmatoryDeltaLl: number,
): GeneralizationClass {
  if (sel.selectedFamily === "CAL_0") return "CAL_0_RETAINED";
  // Negative deltaLl = cal better
  if (confirmatoryDeltaLl < -0.0005) return "GENERALIZES";
  if (confirmatoryDeltaLl <= 0.0005) return "WEAK_GENERALIZATION";
  return "DOES_NOT_GENERALIZE";
}

function classifyOu05(
  rawLl: number,
  calLl: number,
  negatives: number,
): Ou05Confirmatory["classification"] {
  if (negatives < 20) return "LOW_SUPPORT_INCONCLUSIVE";
  const d = calLl - rawLl;
  if (Math.abs(d) < 1e-4) return "UNCHANGED";
  if (d < 0) return "IMPROVED";
  return "WORSE";
}

function chooseVerdict(input: {
  selections: Record<GoalsMcalPocGroupId, GroupSelectionResult>;
  generalization: Record<GoalsMcalPocGroupId, GeneralizationClass>;
  marketRows: MarketCompareRow[];
}): string {
  const selected = Object.values(input.selections).filter(
    (s) => s.selectedFamily === "CAL_1",
  );
  if (selected.length === 0) return "KEEP_RAW_G1";

  const gens = selected.map((s) => input.generalization[s.groupId]!);
  const good = gens.filter(
    (g) => g === "GENERALIZES" || g === "WEAK_GENERALIZATION",
  ).length;
  const bad = gens.filter((g) => g === "DOES_NOT_GENERALIZE").length;

  if (bad > 0 && good === 0) return "KEEP_RAW_G1";
  if (good === selected.length && selected.length >= 1) {
    // Full group promotion only if match-total (main bias target) is among them
    // and generalizes, or multiple groups generalize cleanly.
    const mt = input.selections.GROUP_MATCH_TOTAL;
    if (
      mt?.selectedFamily === "CAL_1" &&
      (input.generalization.GROUP_MATCH_TOTAL === "GENERALIZES" ||
        input.generalization.GROUP_MATCH_TOTAL === "WEAK_GENERALIZATION")
    ) {
      const o15 = input.marketRows.find(
        (r) => r.market === "MATCH_TOTAL_OVER_1_5",
      );
      if (o15 && o15.deltaLl < 0) {
        return selected.length === 1 && mt.groupId === "GROUP_MATCH_TOTAL"
          ? "PARTIAL_CALIBRATION_CANDIDATE"
          : good === Object.keys(input.selections).length
            ? "CAL_1_PROMOTION_CANDIDATE"
            : "PARTIAL_CALIBRATION_CANDIDATE";
      }
    }
    if (good >= 1) return "PARTIAL_CALIBRATION_CANDIDATE";
  }
  if (good >= 1 && bad === 0) return "PARTIAL_CALIBRATION_CANDIDATE";
  if (good >= 1 && bad >= 1) return "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE";
  return "KEEP_RAW_G1";
}

export type GoalsMcalPocResult = {
  protocolDigest: string;
  protocolVersion: string;
  parentG1K: typeof GOALS_MCAL_POC_PARENT_G1_K;
  evidenceDatasetDigest: string;
  temporalFolds: ReturnType<typeof buildDevelopmentFolds>;
  selections: Record<GoalsMcalPocGroupId, GroupSelectionResult>;
  artifacts: Record<GoalsMcalPocGroupId, GoalsMcalPocArtifact>;
  artifactBundleDigest: string;
  developmentFitMetrics: Record<
    string,
    { raw: ProbMetrics; cal: ProbMetrics }
  >;
  confirmatory2024: {
    markets: MarketCompareRow[];
    groupAggregates: Record<string, { raw: ProbMetrics; cal: ProbMetrics }>;
  };
  ou05Confirmatory: Ou05Confirmatory;
  generalization: Record<GoalsMcalPocGroupId, GeneralizationClass>;
  bootstrap2024: ReturnType<typeof bootstrapDeltaMetrics>;
  coherence: {
    fixturesChecked: number;
    complementFailures: number;
    monoFailures: number;
  };
  finalVerdict: string;
  resultDigest: string;
  calibratedObservations: CalibratedObservation[];
  productionWired: false;
  holdout2025: {
    predictions: 0;
    fitting: false;
    metrics: false;
    hyperparameterSelection: false;
  };
};

export function runGoalsMarketCalibrationPoc(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
}): GoalsMcalPocResult {
  if (input.evidenceDatasetDigest !== GOALS_MCAL_POC_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(
      `Evidence digest mismatch: ${input.evidenceDatasetDigest}`,
    );
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_MCAL_POC_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const protocol = goalsMcalPocProtocol();
  const protocolDigest = digestGoalsMcalPocProtocol(protocol);

  const predictions = [];
  for (const row of input.evidenceRows) {
    if (
      row.season !== GOALS_MCAL_POC_DEV_SEASON &&
      row.season !== GOALS_MCAL_POC_CONFIRMATORY_SEASON
    ) {
      continue;
    }
    const p = predictG1FromEvidence(row, GOALS_MCAL_POC_PARENT_G1_K);
    assertG1Coherence(p);
    predictions.push(p);
  }
  predictions.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );

  const observations = buildCanonicalObservations(predictions);
  const obs23 = observations.filter((o) => o.season === GOALS_MCAL_POC_DEV_SEASON);
  const obs24 = observations.filter(
    (o) => o.season === GOALS_MCAL_POC_CONFIRMATORY_SEASON,
  );

  // --- DEVELOPMENT selection (2023 only) ---
  const temporalFolds = buildDevelopmentFolds(obs23);
  const selections = selectAllGroups(obs23);
  assertNoDedicatedO05Calibrator(selections);

  const artifacts = {} as Record<GoalsMcalPocGroupId, GoalsMcalPocArtifact>;
  for (const [gid, sel] of Object.entries(selections) as [
    GoalsMcalPocGroupId,
    GroupSelectionResult,
  ][]) {
    artifacts[gid] = buildGroupArtifact({ protocolDigest, selection: sel });
  }
  const artifactBundleDigest = digestArtifactBundle(artifacts);

  // Apply to all seasons using development-selected policies + full-2023 refit
  const calibrated = applySelectionsToObservations(observations, selections);
  const cal23 = seasonOf(calibrated, GOALS_MCAL_POC_DEV_SEASON);
  const cal24 = seasonOf(calibrated, GOALS_MCAL_POC_CONFIRMATORY_SEASON);

  // Development in-sample fit metrics (descriptive only — not selection)
  const developmentFitMetrics: GoalsMcalPocResult["developmentFitMetrics"] = {};
  for (const m of GOALS_MCAL_POC_CANONICAL_MARKETS) {
    developmentFitMetrics[m] = {
      raw: rawMarketMetrics(m, obs23),
      cal: calMarketMetrics(m, cal23),
    };
  }

  // Confirmatory 2024 once
  const marketRows: MarketCompareRow[] = [];
  for (const m of GOALS_MCAL_POC_CANONICAL_MARKETS) {
    const groupId = (
      Object.entries(selections) as [GoalsMcalPocGroupId, GroupSelectionResult][]
    ).find(([, s]) => (s.markets as readonly string[]).includes(m))![0];
    const raw = rawMarketMetrics(m, obs24);
    const cal = calMarketMetrics(m, cal24);
    marketRows.push({
      market: m,
      selectedFamily: selections[groupId]!.selectedFamily,
      groupId,
      raw,
      cal,
      deltaLl: cal.logLoss - raw.logLoss,
      deltaBrier: cal.brier - raw.brier,
      rawCitl: raw.calibrationInTheLarge,
      calCitl: cal.calibrationInTheLarge,
    });
  }

  const groupAggregates: Record<
    string,
    { raw: ProbMetrics; cal: ProbMetrics }
  > = {};
  for (const [gid, markets] of [
    ["GROUP_MATCH_TOTAL", GOALS_MCAL_POC_GROUP_MATCH_TOTAL],
    ["GROUP_HOME_TOTAL", GOALS_MCAL_POC_GROUP_HOME_TOTAL],
    ["GROUP_AWAY_TOTAL", GOALS_MCAL_POC_GROUP_AWAY_TOTAL],
    ["BTTS", ["BTTS_YES"] as const],
  ] as const) {
    groupAggregates[gid] = {
      raw: aggregateGroupMetrics(markets, obs24, (o) => o.rawProbability),
      cal: aggregateGroupMetrics(
        markets,
        cal24,
        (o) => (o as CalibratedObservation).calibratedProbability,
      ),
    };
  }

  const generalization = {} as Record<GoalsMcalPocGroupId, GeneralizationClass>;
  for (const [gid, sel] of Object.entries(selections) as [
    GoalsMcalPocGroupId,
    GroupSelectionResult,
  ][]) {
    const agg = groupAggregates[gid]!;
    const deltaLl = agg.cal.logLoss - agg.raw.logLoss;
    generalization[gid] = classifyGeneralization(sel, deltaLl);
  }

  // O/U 0.5 confirmatory (Under = complement)
  const o05Rows = cal24.filter((o) => o.market === "MATCH_TOTAL_OVER_0_5");
  const zeroZeroCount = o05Rows.filter((o) => o.actualBinaryOutcome === 0).length;
  const underPairsRaw = o05Rows.map((o) => ({
    p: 1 - o.rawProbability,
    y: (1 - o.actualBinaryOutcome) as 0 | 1,
  }));
  const underPairsCal = o05Rows.map((o) => ({
    p: 1 - o.calibratedProbability,
    y: (1 - o.actualBinaryOutcome) as 0 | 1,
  }));
  const underRaw = {
    ll:
      underPairsRaw.reduce(
        (s, x) =>
          s +
          -(
            x.y * Math.log(Math.min(1 - 1e-15, Math.max(1e-15, x.p))) +
            (1 - x.y) * Math.log(Math.min(1 - 1e-15, Math.max(1e-15, 1 - x.p)))
          ),
        0,
      ) / underPairsRaw.length,
    br:
      underPairsRaw.reduce((s, x) => s + (x.p - x.y) ** 2, 0) /
      underPairsRaw.length,
    meanP:
      underPairsRaw.reduce((s, x) => s + x.p, 0) / underPairsRaw.length,
    rate:
      underPairsRaw.reduce((s, x) => s + x.y, 0) / underPairsRaw.length,
  };
  const underCal = {
    ll:
      underPairsCal.reduce(
        (s, x) =>
          s +
          -(
            x.y * Math.log(Math.min(1 - 1e-15, Math.max(1e-15, x.p))) +
            (1 - x.y) * Math.log(Math.min(1 - 1e-15, Math.max(1e-15, 1 - x.p)))
          ),
        0,
      ) / underPairsCal.length,
    br:
      underPairsCal.reduce((s, x) => s + (x.p - x.y) ** 2, 0) /
      underPairsCal.length,
    meanP:
      underPairsCal.reduce((s, x) => s + x.p, 0) / underPairsCal.length,
  };

  const ou05Confirmatory: Ou05Confirmatory = {
    zeroZeroCount,
    n: o05Rows.length,
    actualUnder05Rate: underRaw.rate,
    rawMeanUnder05: underRaw.meanP,
    calMeanUnder05: underCal.meanP,
    rawLl: underRaw.ll,
    calLl: underCal.ll,
    rawBrier: underRaw.br,
    calBrier: underCal.br,
    rawCitl: underRaw.rate - underRaw.meanP,
    calCitl: underRaw.rate - underCal.meanP,
    classification: classifyOu05(underRaw.ll, underCal.ll, zeroZeroCount),
  };

  const bootstrapKeys: {
    key: string;
    markets: readonly GoalsMcalPocCanonicalMarket[];
  }[] = [
    { key: "GROUP_MATCH_TOTAL", markets: GOALS_MCAL_POC_GROUP_MATCH_TOTAL },
    { key: "MATCH_TOTAL_OVER_0_5", markets: ["MATCH_TOTAL_OVER_0_5"] },
    { key: "MATCH_TOTAL_OVER_1_5", markets: ["MATCH_TOTAL_OVER_1_5"] },
    { key: "BTTS_YES", markets: ["BTTS_YES"] },
    { key: "GROUP_HOME_TOTAL", markets: GOALS_MCAL_POC_GROUP_HOME_TOTAL },
    { key: "GROUP_AWAY_TOTAL", markets: GOALS_MCAL_POC_GROUP_AWAY_TOTAL },
  ];
  const bootstrap2024 = bootstrapDeltaMetrics(cal24, bootstrapKeys);

  let complementFailures = 0;
  const fixtures = new Set(calibrated.map((o) => o.fixtureId));
  for (const o of calibrated) {
    if (Math.abs(o.calibratedProbability + o.complementCalibrated - 1) > 1e-12) {
      complementFailures += 1;
    }
  }

  const finalVerdict = chooseVerdict({
    selections,
    generalization,
    marketRows,
  });

  const material = {
    protocolDigest,
    parentG1K: GOALS_MCAL_POC_PARENT_G1_K,
    selections: Object.fromEntries(
      Object.entries(selections).map(([k, v]) => [
        k,
        {
          selectedFamily: v.selectedFamily,
          reason: v.reason,
          meanFoldLlImprovement: v.meanFoldLlImprovement,
          intercept: v.fullDevFit?.intercept ?? null,
          slope: v.fullDevFit?.slope ?? null,
          parameterDigest: v.fullDevFit?.parameterDigest ?? null,
          parameterStability: v.parameterStability,
        },
      ]),
    ),
    artifactBundleDigest,
    confirmatoryDeltas: marketRows.map((r) => ({
      market: r.market,
      deltaLl: r.deltaLl,
      deltaBrier: r.deltaBrier,
      selectedFamily: r.selectedFamily,
    })),
    generalization,
    ou05: ou05Confirmatory.classification,
    finalVerdict,
  };
  const resultDigest = createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");

  return {
    protocolDigest,
    protocolVersion: protocol.protocolVersion,
    parentG1K: GOALS_MCAL_POC_PARENT_G1_K,
    evidenceDatasetDigest: input.evidenceDatasetDigest,
    temporalFolds,
    selections,
    artifacts,
    artifactBundleDigest,
    developmentFitMetrics,
    confirmatory2024: { markets: marketRows, groupAggregates },
    ou05Confirmatory,
    generalization,
    bootstrap2024,
    coherence: {
      fixturesChecked: fixtures.size,
      complementFailures,
      monoFailures: 0,
    },
    finalVerdict,
    resultDigest,
    calibratedObservations: calibrated,
    productionWired: false,
    holdout2025: {
      predictions: 0,
      fitting: false,
      metrics: false,
      hyperparameterSelection: false,
    },
  };
}
