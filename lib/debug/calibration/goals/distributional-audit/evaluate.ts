/**
 * GOALS-1F.1 — Run distributional audit on frozen G1 k=10.
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  assertG1Coherence,
  predictG1FromEvidence,
  type GoalsG1Prediction,
} from "@/lib/debug/calibration/goals/g1/predict";
import {
  bootstrapDiagnostics,
} from "@/lib/debug/calibration/goals/distributional-audit/bootstrap";
import {
  classifyDixonColes,
  classifyNegativeBinomial,
  classifyOu05,
} from "@/lib/debug/calibration/goals/distributional-audit/classify";
import {
  dispersionAudit,
  fixtureResiduals,
  homeAwayDependence,
  lowScoreAudit,
  marketErrorAudit,
  scoreCountAdequacy,
  tailAudit,
  toLabeledRows,
  type LabeledG1Row,
} from "@/lib/debug/calibration/goals/distributional-audit/diagnostics";
import {
  GOALS_DIST_AUDIT_CONFIRMATORY_SEASON,
  GOALS_DIST_AUDIT_DEV_SEASON,
  GOALS_DIST_AUDIT_HOLDOUT_SEASON,
  GOALS_DIST_AUDIT_PARENT_G1_K,
  GOALS_DIST_AUDIT_PROTOCOL_VERSION,
  GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST,
  digestGoalsDistAuditProtocol,
  goalsDistAuditProtocol,
} from "@/lib/debug/calibration/goals/distributional-audit/protocol";
import {
  computeExpectedTotalCutsFrom2023,
  stratifiedRobustness,
} from "@/lib/debug/calibration/goals/distributional-audit/strata";

function sortPreds(rows: GoalsG1Prediction[]): GoalsG1Prediction[] {
  return [...rows].sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );
}

function seasonBundle(rows: readonly LabeledG1Row[], cuts: ReturnType<typeof computeExpectedTotalCutsFrom2023>) {
  const low = lowScoreAudit(rows);
  const markets = marketErrorAudit(rows);
  const dep = homeAwayDependence(rows);
  return {
    eligibleN: rows.length,
    scoreCounts: scoreCountAdequacy(rows),
    dispersion: dispersionAudit(rows),
    lowScore: low,
    homeAwayDependence: dep,
    tails: tailAudit(rows),
    markets,
    residuals: fixtureResiduals(rows),
    stratified: stratifiedRobustness(rows, cuts),
    bootstrap: bootstrapDiagnostics(rows),
  };
}

export type GoalsDistAuditResult = {
  protocolDigest: string;
  protocolVersion: string;
  parentG1K: typeof GOALS_DIST_AUDIT_PARENT_G1_K;
  evidenceDatasetDigest: string;
  cuts2023: ReturnType<typeof computeExpectedTotalCutsFrom2023>;
  development2023: ReturnType<typeof seasonBundle>;
  confirmatory2024: ReturnType<typeof seasonBundle>;
  classifications: {
    dixonColes: ReturnType<typeof classifyDixonColes>;
    negativeBinomial: ReturnType<typeof classifyNegativeBinomial>;
    ou05: ReturnType<typeof classifyOu05>;
  };
  finalVerdict: string;
  resultDigest: string;
  predictions2023: GoalsG1Prediction[];
  predictions2024: GoalsG1Prediction[];
};

function chooseVerdict(input: {
  dc: string;
  nb: string;
  ou05: string;
}): string {
  const dcPoc = input.dc === "CONSISTENT_DC_EVIDENCE";
  const nbPoc =
    input.nb === "CONSISTENT_OVERDISPERSION_EVIDENCE" ||
    input.nb === "POSSIBLE_UNDERDISPERSION";

  if (dcPoc && nbPoc) return "READY_FOR_GOALS_1F2_DC_AND_NB_POC";
  if (dcPoc) return "READY_FOR_GOALS_1F2_DC_POC";
  if (nbPoc) return "READY_FOR_GOALS_1F2_NB_POC";

  // Prefer not forcing a model: weak signals + no consistent NB ⇒ no extension.
  if (
    (input.dc === "NO_DC_EVIDENCE" || input.dc === "WEAK_DC_EVIDENCE") &&
    (input.nb === "NO_NB_EVIDENCE" || input.nb === "WEAK_NB_EVIDENCE") &&
    (input.ou05 === "OU05_WELL_REPRESENTED" ||
      input.ou05 === "OU05_MINOR_MIScalibration")
  ) {
    return "NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED";
  }

  if (
    input.dc === "INCONCLUSIVE" ||
    input.nb === "INCONCLUSIVE" ||
    input.ou05 === "OU05_INCONCLUSIVE" ||
    input.ou05 === "OU05_SYSTEMATIC_MIScalibration"
  ) {
    return "INCONCLUSIVE_REQUIRES_MORE_EVIDENCE";
  }

  return "NO_DISTRIBUTIONAL_EXTENSION_JUSTIFIED";
}

export function runGoalsDistributionalAudit(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
}): GoalsDistAuditResult {
  if (input.evidenceDatasetDigest !== GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(
      `Evidence digest mismatch: ${input.evidenceDatasetDigest} vs ${GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST}`,
    );
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_DIST_AUDIT_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const protocol = goalsDistAuditProtocol();
  const protocolDigest = digestGoalsDistAuditProtocol(protocol);

  const predictions2023: GoalsG1Prediction[] = [];
  const predictions2024: GoalsG1Prediction[] = [];
  for (const row of input.evidenceRows) {
    const p = predictG1FromEvidence(row, GOALS_DIST_AUDIT_PARENT_G1_K);
    assertG1Coherence(p);
    if (row.season === GOALS_DIST_AUDIT_DEV_SEASON) predictions2023.push(p);
    else if (row.season === GOALS_DIST_AUDIT_CONFIRMATORY_SEASON)
      predictions2024.push(p);
  }
  sortPreds(predictions2023);
  sortPreds(predictions2024);

  const rows23 = toLabeledRows(predictions2023);
  const rows24 = toLabeledRows(predictions2024);
  const cuts2023 = computeExpectedTotalCutsFrom2023(rows23);

  const development2023 = seasonBundle(rows23, cuts2023);
  const confirmatory2024 = seasonBundle(rows24, cuts2023);

  const dixonColes = classifyDixonColes(
    {
      zeroZero: development2023.lowScore.zeroZero,
      lowScore2x2: development2023.lowScore.lowScore2x2,
      residualCorr: development2023.homeAwayDependence.corrResidualHomeAway,
    },
    {
      zeroZero: confirmatory2024.lowScore.zeroZero,
      lowScore2x2: confirmatory2024.lowScore.lowScore2x2,
      residualCorr: confirmatory2024.homeAwayDependence.corrResidualHomeAway,
    },
    confirmatory2024.bootstrap,
  );
  const negativeBinomial = classifyNegativeBinomial(
    development2023.dispersion,
    confirmatory2024.dispersion,
    confirmatory2024.bootstrap,
  );
  const ou05 = classifyOu05(
    {
      zeroZero: development2023.lowScore.zeroZero,
      u05Diff: development2023.markets.ou05.under.difference,
      ll: development2023.markets.ou05.under.logLoss,
    },
    {
      zeroZero: confirmatory2024.lowScore.zeroZero,
      u05Diff: confirmatory2024.markets.ou05.under.difference,
      ll: confirmatory2024.markets.ou05.under.logLoss,
    },
    confirmatory2024.bootstrap,
  );

  const finalVerdict = chooseVerdict({
    dc: dixonColes.classification,
    nb: negativeBinomial.classification,
    ou05: ou05.classification,
  });

  const resultDigest = createHash("sha256")
    .update(
      JSON.stringify({
        protocolDigest,
        cuts2023,
        d23: development2023.dispersion.classification,
        d24: confirmatory2024.dispersion.classification,
        zz23: development2023.lowScore.zeroZero,
        zz24: confirmatory2024.lowScore.zeroZero,
        dixonColes: dixonColes.classification,
        negativeBinomial: negativeBinomial.classification,
        ou05: ou05.classification,
        finalVerdict,
        n23: rows23.length,
        n24: rows24.length,
      }),
      "utf8",
    )
    .digest("hex");

  return {
    protocolDigest,
    protocolVersion: GOALS_DIST_AUDIT_PROTOCOL_VERSION,
    parentG1K: GOALS_DIST_AUDIT_PARENT_G1_K,
    evidenceDatasetDigest: input.evidenceDatasetDigest,
    cuts2023,
    development2023,
    confirmatory2024,
    classifications: { dixonColes, negativeBinomial, ou05 },
    finalVerdict,
    resultDigest,
    predictions2023,
    predictions2024,
  };
}
