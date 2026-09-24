/**
 * GOALS-1G.3 — Match-total calibration refinement evaluation.
 * Selection on 2023 only; 2024 is PREVIOUSLY_OBSERVED_CONFIRMATORY.
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  assertG1Coherence,
  predictG1FromEvidence,
} from "@/lib/debug/calibration/goals/g1/predict";
import { binaryBrier, binaryLogLoss } from "@/lib/debug/calibration/goals/g0/metrics";
import { buildCanonicalObservations } from "@/lib/debug/calibration/goals/market-calibration/observations";
import { buildDevelopmentFolds } from "@/lib/debug/calibration/goals/market-calibration-poc/folds";
import {
  applyCandidateProbability,
  assertR2SlopeExact,
  type RefParams,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/candidates";
import {
  buildRefinementArtifact,
  digestRefinementArtifact,
  type GoalsMcalRefArtifact,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/artifact";
import { bootstrapSelectedVsR0 } from "@/lib/debug/calibration/goals/market-calibration-refinement/bootstrap";
import { auditMatchTotalCoherence } from "@/lib/debug/calibration/goals/market-calibration-refinement/coherence";
import {
  digestGoalsMcalRefProtocol,
  GOALS_MCAL_REF_HOLDOUT_SEASON,
  GOALS_MCAL_REF_MATCH_TOTAL_MARKETS,
  GOALS_MCAL_REF_DEV_SEASON,
  GOALS_MCAL_REF_OBSERVED_CONFIRMATORY_SEASON,
  GOALS_MCAL_REF_PARENT_G1_K,
  GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST,
  goalsMcalRefProtocol,
  type GoalsMcalRefCandidateId,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";
import {
  selectRefinementCandidate,
  type CandidateDevResult,
  type SelectionResult,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/select";

export type SeasonMarketMetrics = {
  market: string;
  n: number;
  logLoss: number;
  brier: number;
  meanPredicted: number;
  actualRate: number;
  citl: number;
};

function marketMetrics(
  rows: readonly { p: number; y: 0 | 1 }[],
  market: string,
): SeasonMarketMetrics {
  const n = rows.length;
  if (!n) {
    return {
      market,
      n: 0,
      logLoss: NaN,
      brier: NaN,
      meanPredicted: NaN,
      actualRate: NaN,
      citl: NaN,
    };
  }
  let ll = 0;
  let br = 0;
  let sumP = 0;
  let sumY = 0;
  for (const r of rows) {
    ll += binaryLogLoss(r.p, r.y);
    br += binaryBrier(r.p, r.y);
    sumP += r.p;
    sumY += r.y;
  }
  return {
    market,
    n,
    logLoss: ll / n,
    brier: br / n,
    meanPredicted: sumP / n,
    actualRate: sumY / n,
    citl: sumY / n - sumP / n,
  };
}

function scoreSeason(
  obs: ReturnType<typeof buildCanonicalObservations>,
  params: RefParams,
): {
  aggregate: SeasonMarketMetrics;
  byMarket: Record<string, SeasonMarketMetrics>;
  coherence: ReturnType<typeof auditMatchTotalCoherence>;
} {
  const mt = obs.filter((o) =>
    (GOALS_MCAL_REF_MATCH_TOTAL_MARKETS as readonly string[]).includes(o.market),
  );
  const byMarket: Record<string, SeasonMarketMetrics> = {};
  for (const m of GOALS_MCAL_REF_MATCH_TOTAL_MARKETS) {
    const rows = mt
      .filter((o) => o.market === m)
      .map((o) => ({
        p: applyCandidateProbability(o.market, o.rawProbability, params),
        y: o.actualBinaryOutcome,
      }));
    byMarket[m] = marketMetrics(rows, m);
  }
  const all = mt.map((o) => ({
    p: applyCandidateProbability(o.market, o.rawProbability, params),
    y: o.actualBinaryOutcome,
  }));
  return {
    aggregate: marketMetrics(all, "AGGREGATE"),
    byMarket,
    coherence: auditMatchTotalCoherence(mt, params),
  };
}

export type O15Audit = {
  developmentFoldMean: {
    rawLl: number;
    candLl: number;
    rawBrier: number;
    candBrier: number;
  };
  observed2024: {
    rawLl: number;
    candLl: number;
    rawCitl: number;
    candCitl: number;
    deltaLl: number;
  };
  classification:
    | "RETAINED"
    | "PARTIALLY_RETAINED"
    | "LOST"
    | "INCONCLUSIVE";
};

export type HigherThresholdDamage = {
  classification:
    | "DAMAGE_ELIMINATED"
    | "DAMAGE_REDUCED"
    | "DAMAGE_PERSISTS"
    | "NOT_APPLICABLE_RAW_SELECTED";
  detail: Record<
    string,
    { rawLl: number; r1Ll: number; selectedLl: number; deltaVsR1: number }
  >;
};

function classifyO15(
  selected: GoalsMcalRefCandidateId,
  deltaLl2024: number,
  foldImproved: boolean,
): O15Audit["classification"] {
  if (selected === "R0") return "LOST";
  if (deltaLl2024 < -0.002 && foldImproved) return "RETAINED";
  if (deltaLl2024 < 0) return "PARTIALLY_RETAINED";
  if (deltaLl2024 < 0.002) return "INCONCLUSIVE";
  return "LOST";
}

function classifyDamage(
  selected: GoalsMcalRefCandidateId,
  detail: HigherThresholdDamage["detail"],
): HigherThresholdDamage["classification"] {
  if (selected === "R0") return "NOT_APPLICABLE_RAW_SELECTED";
  const highs = ["MATCH_TOTAL_OVER_2_5", "MATCH_TOTAL_OVER_3_5", "MATCH_TOTAL_OVER_4_5"];
  let r1Damage = 0;
  let selectedDamage = 0;
  let improvedVsR1 = 0;
  for (const m of highs) {
    const d = detail[m]!;
    const r1Worse = d.r1Ll - d.rawLl;
    const selWorse = d.selectedLl - d.rawLl;
    if (r1Worse > 0.0005) r1Damage += 1;
    if (selWorse > 0.0005) selectedDamage += 1;
    if (d.selectedLl < d.r1Ll - 1e-6) improvedVsR1 += 1;
  }
  if (selectedDamage === 0 && r1Damage > 0) return "DAMAGE_ELIMINATED";
  if (improvedVsR1 >= 2 && selectedDamage < r1Damage) return "DAMAGE_REDUCED";
  if (selectedDamage > 0) return "DAMAGE_PERSISTS";
  return "DAMAGE_ELIMINATED";
}

function chooseVerdict(input: {
  selected: GoalsMcalRefCandidateId;
  o15: O15Audit["classification"];
  damage: HigherThresholdDamage["classification"];
  aggDelta2024: number;
}): string {
  if (input.selected === "R0") return "KEEP_RAW_G1";
  if (input.selected === "R1") {
    if (
      input.o15 === "RETAINED" &&
      input.damage === "DAMAGE_PERSISTS" &&
      input.aggDelta2024 >= 0
    ) {
      return "KEEP_G1G2_PARTIAL_CANDIDATE";
    }
    return "KEEP_G1G2_PARTIAL_CANDIDATE";
  }
  // R2 or R3
  if (
    (input.o15 === "RETAINED" || input.o15 === "PARTIALLY_RETAINED") &&
    (input.damage === "DAMAGE_ELIMINATED" || input.damage === "DAMAGE_REDUCED")
  ) {
    return "MATCH_TOTAL_REFINEMENT_CANDIDATE";
  }
  if (input.o15 === "LOST" && input.damage === "DAMAGE_ELIMINATED") {
    return "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE";
  }
  if (input.selected === "R2" || input.selected === "R3") {
    if (input.aggDelta2024 < 0 && input.damage !== "DAMAGE_PERSISTS") {
      return "MATCH_TOTAL_REFINEMENT_CANDIDATE";
    }
    if (input.damage === "DAMAGE_ELIMINATED" || input.damage === "DAMAGE_REDUCED") {
      return input.o15 === "RETAINED" || input.o15 === "PARTIALLY_RETAINED"
        ? "MATCH_TOTAL_REFINEMENT_CANDIDATE"
        : "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE";
    }
  }
  return "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE";
}

export type GoalsMcalRefResult = {
  protocolDigest: string;
  parentG1K: typeof GOALS_MCAL_REF_PARENT_G1_K;
  selection: SelectionResult;
  selectedCandidate: GoalsMcalRefCandidateId;
  selectedParams: RefParams;
  artifact: GoalsMcalRefArtifact;
  artifactDigest: string;
  developmentResults: Record<GoalsMcalRefCandidateId, CandidateDevResult>;
  previouslyObserved2024: {
    label: "PREVIOUSLY_OBSERVED_CONFIRMATORY";
    notPristineHoldout: true;
    selected: ReturnType<typeof scoreSeason>;
    r0: ReturnType<typeof scoreSeason>;
    r1: ReturnType<typeof scoreSeason>;
    deltaVsR0: { aggLl: number; aggBrier: number };
    deltaVsR1: { aggLl: number; aggBrier: number };
  };
  o15Audit: O15Audit;
  ou05Audit: {
    zeroZeroCount: number;
    n: number;
    rawMeanUnder: number;
    candMeanUnder: number;
    actualUnderRate: number;
    rawLl: number;
    candLl: number;
    note: string;
  };
  higherThresholdDamage: HigherThresholdDamage;
  bootstrap2024: ReturnType<typeof bootstrapSelectedVsR0>;
  finalVerdict: string;
  resultDigest: string;
  productionWired: false;
  holdout2025: {
    predictions: 0;
    fitting: false;
    selection: false;
    metrics: false;
  };
};

export function runGoalsMarketCalibrationRefinement(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
}): GoalsMcalRefResult {
  if (input.evidenceDatasetDigest !== GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(`Evidence digest mismatch: ${input.evidenceDatasetDigest}`);
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_MCAL_REF_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const protocol = goalsMcalRefProtocol();
  const protocolDigest = digestGoalsMcalRefProtocol(protocol);

  const predictions = [];
  for (const row of input.evidenceRows) {
    if (
      row.season !== GOALS_MCAL_REF_DEV_SEASON &&
      row.season !== GOALS_MCAL_REF_OBSERVED_CONFIRMATORY_SEASON
    ) {
      continue;
    }
    const p = predictG1FromEvidence(row, GOALS_MCAL_REF_PARENT_G1_K);
    assertG1Coherence(p);
    predictions.push(p);
  }
  predictions.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );

  const observations = buildCanonicalObservations(predictions);
  const obs23 = observations.filter((o) => o.season === GOALS_MCAL_REF_DEV_SEASON);
  const obs24 = observations.filter(
    (o) => o.season === GOALS_MCAL_REF_OBSERVED_CONFIRMATORY_SEASON,
  );

  // --- 2023 selection only ---
  const folds = buildDevelopmentFolds(obs23);
  const selection = selectRefinementCandidate(obs23, folds);
  const selectedParams =
    selection.candidates[selection.selected]!.fullDevParams;
  assertR2SlopeExact(selectedParams);

  const artifact = buildRefinementArtifact({
    protocolDigest,
    params: selectedParams,
    selectionEvidenceDigest: selection.selectionEvidenceDigest,
    selectionReason: selection.reason,
  });
  const artifactDigest = digestRefinementArtifact(artifact);

  // --- 2024 previously observed (after selection frozen) ---
  const r0Params = selection.candidates.R0!.fullDevParams;
  const r1Params = selection.candidates.R1!.fullDevParams;
  const scoredSelected = scoreSeason(obs24, selectedParams);
  const scoredR0 = scoreSeason(obs24, r0Params);
  const scoredR1 = scoreSeason(obs24, r1Params);

  const o15Raw = scoredR0.byMarket.MATCH_TOTAL_OVER_1_5!;
  const o15Cand = scoredSelected.byMarket.MATCH_TOTAL_OVER_1_5!;
  const foldO15Imp =
    selection.candidates.R0!.meanFoldO15Ll -
      selection.candidates[selection.selected]!.meanFoldO15Ll >
    0;
  const o15Audit: O15Audit = {
    developmentFoldMean: {
      rawLl: selection.candidates.R0!.meanFoldO15Ll,
      candLl: selection.candidates[selection.selected]!.meanFoldO15Ll,
      rawBrier: NaN,
      candBrier: NaN,
    },
    observed2024: {
      rawLl: o15Raw.logLoss,
      candLl: o15Cand.logLoss,
      rawCitl: o15Raw.citl,
      candCitl: o15Cand.citl,
      deltaLl: o15Cand.logLoss - o15Raw.logLoss,
    },
    classification: classifyO15(
      selection.selected,
      o15Cand.logLoss - o15Raw.logLoss,
      foldO15Imp,
    ),
  };

  const o05Rows = obs24.filter((o) => o.market === "MATCH_TOTAL_OVER_0_5");
  const zeroZeroCount = o05Rows.filter((o) => o.actualBinaryOutcome === 0).length;
  const underRaw = o05Rows.map((o) => ({
    p: 1 - o.rawProbability,
    y: (1 - o.actualBinaryOutcome) as 0 | 1,
  }));
  const underCand = o05Rows.map((o) => ({
    p:
      1 -
      applyCandidateProbability(o.market, o.rawProbability, selectedParams),
    y: (1 - o.actualBinaryOutcome) as 0 | 1,
  }));
  const underMetrics = (rows: { p: number; y: 0 | 1 }[]) => {
    let ll = 0;
    let sumP = 0;
    let sumY = 0;
    for (const r of rows) {
      ll += binaryLogLoss(r.p, r.y);
      sumP += r.p;
      sumY += r.y;
    }
    return {
      ll: ll / rows.length,
      meanP: sumP / rows.length,
      rate: sumY / rows.length,
    };
  };
  const uRaw = underMetrics(underRaw);
  const uCand = underMetrics(underCand);

  const damageDetail: HigherThresholdDamage["detail"] = {};
  for (const m of [
    "MATCH_TOTAL_OVER_2_5",
    "MATCH_TOTAL_OVER_3_5",
    "MATCH_TOTAL_OVER_4_5",
  ]) {
    damageDetail[m] = {
      rawLl: scoredR0.byMarket[m]!.logLoss,
      r1Ll: scoredR1.byMarket[m]!.logLoss,
      selectedLl: scoredSelected.byMarket[m]!.logLoss,
      deltaVsR1:
        scoredSelected.byMarket[m]!.logLoss - scoredR1.byMarket[m]!.logLoss,
    };
  }
  const higherThresholdDamage: HigherThresholdDamage = {
    detail: damageDetail,
    classification: classifyDamage(selection.selected, damageDetail),
  };

  const aggDelta2024 =
    scoredSelected.aggregate.logLoss - scoredR0.aggregate.logLoss;

  const finalVerdict = chooseVerdict({
    selected: selection.selected,
    o15: o15Audit.classification,
    damage: higherThresholdDamage.classification,
    aggDelta2024,
  });

  const bootstrap2024 = bootstrapSelectedVsR0(obs24, selectedParams);

  const material = {
    protocolDigest,
    selected: selection.selected,
    selectionEvidenceDigest: selection.selectionEvidenceDigest,
    parameterDigest: selectedParams.parameterDigest,
    artifactDigest,
    finalVerdict,
    o15: o15Audit.classification,
    damage: higherThresholdDamage.classification,
    aggDelta2024,
  };
  const resultDigest = createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");

  return {
    protocolDigest,
    parentG1K: GOALS_MCAL_REF_PARENT_G1_K,
    selection,
    selectedCandidate: selection.selected,
    selectedParams,
    artifact,
    artifactDigest,
    developmentResults: selection.candidates,
    previouslyObserved2024: {
      label: "PREVIOUSLY_OBSERVED_CONFIRMATORY",
      notPristineHoldout: true,
      selected: scoredSelected,
      r0: scoredR0,
      r1: scoredR1,
      deltaVsR0: {
        aggLl: aggDelta2024,
        aggBrier:
          scoredSelected.aggregate.brier - scoredR0.aggregate.brier,
      },
      deltaVsR1: {
        aggLl:
          scoredSelected.aggregate.logLoss - scoredR1.aggregate.logLoss,
        aggBrier:
          scoredSelected.aggregate.brier - scoredR1.aggregate.brier,
      },
    },
    o15Audit,
    ou05Audit: {
      zeroZeroCount,
      n: o05Rows.length,
      rawMeanUnder: uRaw.meanP,
      candMeanUnder: uCand.meanP,
      actualUnderRate: uRaw.rate,
      rawLl: uRaw.ll,
      candLl: uCand.ll,
      note: "rare_event_no_dedicated_o05_fit",
    },
    higherThresholdDamage,
    bootstrap2024,
    finalVerdict,
    resultDigest,
    productionWired: false,
    holdout2025: {
      predictions: 0,
      fitting: false,
      selection: false,
      metrics: false,
    },
  };
}
