/**
 * GOALS-1G.3 — Offline CLI for match-total calibration refinement.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1g3-match-total-refinement.ts
 *   npx tsx lib/debug/calibration/run-goals1g3-match-total-refinement.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsMarketCalibrationRefinement } from "@/lib/debug/calibration/goals/market-calibration-refinement/evaluate";
import {
  digestGoalsMcalRefProtocol,
  goalsMcalRefProtocol,
  GOALS_MCAL_REF_PARENT_G1_K,
  GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/market-calibration-refinement/protocol";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";

function slimCandidate(c: {
  candidateId: string;
  eligible: boolean;
  ineligibilityReasons: string[];
  meanFoldAggLl: number;
  meanFoldAggBrier: number;
  meanFoldO05Ll: number;
  meanFoldO15Ll: number;
  meanFoldAggLlImprovementVsR0: number;
  meanFoldBrierDeltaVsR0: number;
  meanFoldO05LlWorsenVsR0: number;
  meanFoldO15LlWorsenVsR0: number;
  fullDevParams: {
    intercept: number | null;
    slope: number | null;
    fitN: number;
    positiveN: number;
    negativeN: number;
    converged: boolean;
    parameterDigest: string;
    appliedMarkets: readonly string[];
  };
  fullDevCoherence: unknown;
  parameterStability: string;
  folds: {
    foldId: string;
    aggregate: unknown;
    byMarket: unknown;
    params: { intercept: number | null; slope: number | null };
    coherence: { violationCount: number; coherenceValid: boolean };
  }[];
}) {
  return {
    candidateId: c.candidateId,
    eligible: c.eligible,
    ineligibilityReasons: c.ineligibilityReasons,
    meanFoldAggLl: c.meanFoldAggLl,
    meanFoldAggBrier: c.meanFoldAggBrier,
    meanFoldO05Ll: c.meanFoldO05Ll,
    meanFoldO15Ll: c.meanFoldO15Ll,
    meanFoldAggLlImprovementVsR0: c.meanFoldAggLlImprovementVsR0,
    meanFoldBrierDeltaVsR0: c.meanFoldBrierDeltaVsR0,
    meanFoldO05LlWorsenVsR0: c.meanFoldO05LlWorsenVsR0,
    meanFoldO15LlWorsenVsR0: c.meanFoldO15LlWorsenVsR0,
    fullDevParams: c.fullDevParams,
    fullDevCoherence: c.fullDevCoherence,
    parameterStability: c.parameterStability,
    folds: c.folds.map((f) => ({
      foldId: f.foldId,
      aggregate: f.aggregate,
      byMarket: f.byMarket,
      params: { intercept: f.params.intercept, slope: f.params.slope },
      coherence: {
        violationCount: f.coherence.violationCount,
        coherenceValid: f.coherence.coherenceValid,
      },
    })),
  };
}

function main() {
  const protocol = goalsMcalRefProtocol();
  const protocolDigest = digestGoalsMcalRefProtocol(protocol);
  console.log(
    JSON.stringify(
      {
        phase: "GOALS1G3_PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        parentG1K: GOALS_MCAL_REF_PARENT_G1_K,
        candidates: protocol.candidates,
        confirmatory2024PreviouslyObserved: true,
        confirmatory2024SelectionEligible: false,
        note: "G.3 candidates not yet evaluated on 2024",
      },
      null,
      2,
    ),
  );

  if (!process.argv.includes("--execute")) {
    console.log(JSON.stringify({ dryRun: true, hint: "Pass --execute" }));
    return;
  }

  const evidenceDir = path.join(
    process.cwd(),
    CALIBRATION_ARTIFACT_DIR,
    "goals",
  );
  const manifest = JSON.parse(
    readFileSync(
      path.join(evidenceDir, "goals-evidence-v1.manifest.json"),
      "utf8",
    ),
  ) as { datasetDigest: string };
  if (manifest.datasetDigest !== GOALS_MCAL_REF_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error("GOALS-1B digest mismatch");
  }

  const evidenceRows = readFileSync(
    path.join(evidenceDir, "goals-evidence-v1.jsonl"),
    "utf8",
  )
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoalsTargetEvidence);

  const shuffled = [...evidenceRows].sort((a, b) =>
    b.fixtureId.localeCompare(a.fixtureId),
  );

  const result = runGoalsMarketCalibrationRefinement({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const result2 = runGoalsMarketCalibrationRefinement({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const resultShuffle = runGoalsMarketCalibrationRefinement({
    evidenceRows: shuffled,
    evidenceDatasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.selectedCandidate === resultShuffle.selectedCandidate &&
    result.resultDigest === resultShuffle.resultDigest &&
    result.artifactDigest === resultShuffle.artifactDigest;

  if (!reproducible) {
    throw new Error("GOALS-1G.3 reproducibility failed — STOP");
  }

  console.log(
    JSON.stringify(
      {
        phase: "GOALS1G3_CANDIDATE_SELECTED",
        candidate: result.selectedCandidate,
        parameters: {
          intercept: result.selectedParams.intercept,
          slope: result.selectedParams.slope,
          appliedMarkets: result.selectedParams.appliedMarkets,
        },
        parameterDigest: result.selectedParams.parameterDigest,
        selectionEvidenceDigest: result.selection.selectionEvidenceDigest,
        reason: result.selection.reason,
      },
      null,
      2,
    ),
  );

  const outDir = path.join(evidenceDir, "market-calibration-refinement-v1");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "development-selection.json"),
    JSON.stringify(
      {
        selected: result.selectedCandidate,
        reason: result.selection.reason,
        selectionEvidenceDigest: result.selection.selectionEvidenceDigest,
        candidates: Object.fromEntries(
          Object.entries(result.developmentResults).map(([k, v]) => [
            k,
            slimCandidate(v),
          ]),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "artifact.json"),
    JSON.stringify(
      { artifact: result.artifact, artifactDigest: result.artifactDigest },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "previously-observed-2024.json"),
    JSON.stringify(result.previouslyObserved2024, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "o15-audit.json"),
    JSON.stringify(result.o15Audit, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "ou05-audit.json"),
    JSON.stringify(result.ou05Audit, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "higher-threshold-damage.json"),
    JSON.stringify(result.higherThresholdDamage, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "bootstrap-2024.json"),
    JSON.stringify(result.bootstrap2024, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        artifactDigest: result.artifactDigest,
        selectedCandidate: result.selectedCandidate,
        selectionReason: result.selection.reason,
        finalVerdict: result.finalVerdict,
        o15Classification: result.o15Audit.classification,
        damageClassification: result.higherThresholdDamage.classification,
        reproducible,
        productionWired: false,
        holdout2025: result.holdout2025,
        previouslyObserved2024: true,
        notPristineHoldout: true,
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        phase: "REFINEMENT_COMPLETE",
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        selectedCandidate: result.selectedCandidate,
        finalVerdict: result.finalVerdict,
        o15: result.o15Audit.classification,
        damage: result.higherThresholdDamage.classification,
        reproducible,
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
