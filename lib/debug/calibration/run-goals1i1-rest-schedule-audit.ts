/**
 * GOALS-1I.1 — Offline CLI for rest/schedule congestion signal audit.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1i1-rest-schedule-audit.ts
 *   npx tsx lib/debug/calibration/run-goals1i1-rest-schedule-audit.ts --execute
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsRestScheduleAudit } from "@/lib/debug/calibration/goals/rest-schedule/evaluate";
import {
  digestGoalsRestProtocol,
  goalsRestProtocol,
  GOALS_REST_PARENT_G1_K,
  GOALS_REST_REQUIRED_EVIDENCE_DIGEST,
  GOALS_REST_SCHEDULE_COVERAGE,
} from "@/lib/debug/calibration/goals/rest-schedule/protocol";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";

function main() {
  const protocol = goalsRestProtocol();
  const protocolDigest = digestGoalsRestProtocol(protocol);
  console.log(
    JSON.stringify(
      {
        phase: "GOALS1I1_PROTOCOL_FROZEN",
        protocolVersion: protocol.protocolVersion,
        protocolDigest,
        parentG1K: GOALS_REST_PARENT_G1_K,
        scheduleCoverage: GOALS_REST_SCHEDULE_COVERAGE,
        signalAuditOnly: true,
        noCoefficientFit: true,
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
  if (manifest.datasetDigest !== GOALS_REST_REQUIRED_EVIDENCE_DIGEST) {
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

  const result = runGoalsRestScheduleAudit({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const result2 = runGoalsRestScheduleAudit({
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
  });
  const resultShuffle = runGoalsRestScheduleAudit({
    evidenceRows: shuffled,
    evidenceDatasetDigest: manifest.datasetDigest,
  });

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.resultDigest === result2.resultDigest &&
    result.finalVerdict === resultShuffle.finalVerdict &&
    result.resultDigest === resultShuffle.resultDigest;

  if (!reproducible) {
    throw new Error("GOALS-1I.1 reproducibility failed — STOP");
  }

  const outDir = path.join(evidenceDir, "rest-schedule-audit-v1");
  mkdirSync(outDir, { recursive: true });

  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "schedule-coverage.json"),
    JSON.stringify(
      {
        scheduleCoverage: result.scheduleCoverage,
        futureScheduleAnticipation: result.futureScheduleAnticipation,
        includesDomesticCups: false,
        includesUefa: false,
        includesOtherCompetitions: false,
        competitionIdFilter: "39",
        semantics: "leagueRestDays / leagueMatchesLast*d are PL-only",
      },
      null,
      2,
    ) + "\n",
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
    path.join(outDir, "report.json"),
    JSON.stringify(
      {
        protocolDigest: result.protocolDigest,
        resultDigest: result.resultDigest,
        finalVerdict: result.finalVerdict,
        attackClassification: result.attackClassification,
        defenseClassification: result.defenseClassification,
        totalClassification: result.totalClassification,
        observationCount: result.observationCount,
        fixtureCount: result.fixtureCount,
        scheduleCoverage: result.scheduleCoverage,
        attackRest: {
          "2023": result.development2023.team.restVsAttack,
          "2024": result.confirmatory2024.team.restVsAttack,
        },
        defenseRest: {
          "2023": result.development2023.team.restVsDefense,
          "2024": result.confirmatory2024.team.restVsDefense,
        },
        demeaned2023: result.development2023.demeaned,
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
        attackClassification: result.attackClassification,
        defenseClassification: result.defenseClassification,
        totalClassification: result.totalClassification,
        attackRest_2023: result.development2023.team.restVsAttack,
        attackRest_2024: result.confirmatory2024.team.restVsAttack,
        defenseRest_2023: result.development2023.team.restVsDefense,
        defenseRest_2024: result.confirmatory2024.team.restVsDefense,
        demeaned2023: result.development2023.demeaned,
        scheduleCoverage: result.scheduleCoverage,
        reproducible,
        outDir,
      },
      null,
      2,
    ),
  );
}

main();
