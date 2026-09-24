/**
 * GOALS-1H.1 — Offline CLI for recent attack/defense signal audit.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1h1-recent-attack-defense-audit.ts
 *   npx tsx lib/debug/calibration/run-goals1h1-recent-attack-defense-audit.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsRecentAttackDefenseAudit } from "@/lib/debug/calibration/goals/recent-attack-defense/evaluate";
import {
  digestGoalsRadProtocol,
  goalsRadProtocol,
  GOALS_RAD_PARENT_G1_K,
  GOALS_RAD_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";

function main() {
  const protocol = goalsRadProtocol();
  const protocolDigest = digestGoalsRadProtocol(protocol);
  console.log(
    JSON.stringify(
      {
        phase: "GOALS1H1_PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        parentG1K: GOALS_RAD_PARENT_G1_K,
        signalAuditOnly: true,
        noModelFitting: true,
        note: "Signal metrics not yet computed",
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
  if (manifest.datasetDigest !== GOALS_RAD_REQUIRED_EVIDENCE_DIGEST) {
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

  const result = runGoalsRecentAttackDefenseAudit({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const result2 = runGoalsRecentAttackDefenseAudit({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const resultShuffle = runGoalsRecentAttackDefenseAudit({
    evidenceRows: shuffled,
    evidenceDatasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.finalVerdict === resultShuffle.finalVerdict &&
    result.resultDigest === resultShuffle.resultDigest;

  if (!reproducible) {
    throw new Error("GOALS-1H.1 reproducibility failed — STOP");
  }

  const outDir = path.join(evidenceDir, "recent-attack-defense-audit-v1");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "metrics-2023.json"),
    JSON.stringify(result.development2023, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "metrics-2024.json"),
    JSON.stringify(result.confirmatory2024, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "season-replication.json"),
    JSON.stringify(result.seasonReplication, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        finalVerdict: result.finalVerdict,
        observationCount: result.observationCount,
        attackLast5: {
          "2023": result.development2023.byWindow.last_5?.attack,
          "2024": result.confirmatory2024.byWindow.last_5?.attack,
        },
        defenseLast5: {
          "2023": result.development2023.byWindow.last_5?.defense,
          "2024": result.confirmatory2024.byWindow.last_5?.defense,
        },
        seasonReplication: result.seasonReplication,
        reproducible,
        productionWired: false,
        noModelFitting: true,
        holdout2025: result.holdout2025,
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
        observationCount: result.observationCount,
        attackLast5_2023: result.development2023.byWindow.last_5?.attack,
        attackLast5_2024: result.confirmatory2024.byWindow.last_5?.attack,
        defenseLast5_2023: result.development2023.byWindow.last_5?.defense,
        defenseLast5_2024: result.confirmatory2024.byWindow.last_5?.defense,
        seasonReplication: result.seasonReplication,
        reproducible,
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
