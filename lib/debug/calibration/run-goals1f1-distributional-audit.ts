/**
 * GOALS-1F.1 — Offline CLI for G1 distributional audit (no fitting).
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1f1-distributional-audit.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsDistributionalAudit } from "@/lib/debug/calibration/goals/distributional-audit/evaluate";
import {
  digestGoalsDistAuditProtocol,
  goalsDistAuditProtocol,
  GOALS_DIST_AUDIT_PARENT_G1_K,
  GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/distributional-audit/protocol";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";

function main() {
  const protocol = goalsDistAuditProtocol();
  const protocolDigest = digestGoalsDistAuditProtocol(protocol);
  console.log(
    JSON.stringify(
      {
        phase: "GOALS1F1_PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        parentG1K: GOALS_DIST_AUDIT_PARENT_G1_K,
        noFitting: true,
        note: "Confirmatory 2024 conclusions not yet computed",
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
  if (manifest.datasetDigest !== GOALS_DIST_AUDIT_REQUIRED_EVIDENCE_DIGEST) {
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

  const result = runGoalsDistributionalAudit({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const result2 = runGoalsDistributionalAudit({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const resultShuffle = runGoalsDistributionalAudit({
    evidenceRows: shuffled,
    evidenceDatasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.finalVerdict === result2.finalVerdict &&
    result.resultDigest === resultShuffle.resultDigest;

  if (!reproducible) {
    throw new Error("GOALS-1F.1 reproducibility failed — STOP");
  }

  const outDir = path.join(evidenceDir, "distributional-audit-v1");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "strata-cuts-2023.json"),
    JSON.stringify(result.cuts2023, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "diagnostics-2023.json"),
    JSON.stringify(result.development2023, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "diagnostics-2024.json"),
    JSON.stringify(result.confirmatory2024, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "classifications.json"),
    JSON.stringify(result.classifications, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        finalVerdict: result.finalVerdict,
        classifications: result.classifications,
        reproducible,
        holdout2025: { predictions: 0, diagnostics: false },
        development2023: {
          eligibleN: result.development2023.eligibleN,
          dispersion: result.development2023.dispersion.classification,
          zeroZero: result.development2023.lowScore.zeroZero,
          residualCorr:
            result.development2023.homeAwayDependence.corrResidualHomeAway,
        },
        confirmatory2024: {
          eligibleN: result.confirmatory2024.eligibleN,
          dispersion: result.confirmatory2024.dispersion.classification,
          zeroZero: result.confirmatory2024.lowScore.zeroZero,
          residualCorr:
            result.confirmatory2024.homeAwayDependence.corrResidualHomeAway,
          bootstrap: result.confirmatory2024.bootstrap,
          ou05: result.confirmatory2024.markets.ou05,
        },
      },
      null,
      2,
    ) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        phase: "AUDIT_COMPLETE",
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        finalVerdict: result.finalVerdict,
        classifications: result.classifications,
        reproducible,
        outDir,
        confirmatory2024: {
          eligibleN: result.confirmatory2024.eligibleN,
          dispersion: result.confirmatory2024.dispersion.classification,
          zeroZero: result.confirmatory2024.lowScore.zeroZero,
          lowScore2x2: result.confirmatory2024.lowScore.lowScore2x2,
          residualCorr:
            result.confirmatory2024.homeAwayDependence.corrResidualHomeAway,
          pearsonTotal: result.confirmatory2024.dispersion.pearsonTotal,
          ou05: result.confirmatory2024.markets.ou05,
        },
        development2023: {
          eligibleN: result.development2023.eligibleN,
          dispersion: result.development2023.dispersion.classification,
          zeroZero: result.development2023.lowScore.zeroZero,
          residualCorr:
            result.development2023.homeAwayDependence.corrResidualHomeAway,
        },
      },
      null,
      2,
    ),
  );
}

main();
