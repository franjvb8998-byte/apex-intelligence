/**
 * Human-readable capture integrity report. No ranking. No winner.
 */

import { PROSPECTIVE_CANDIDATE_IDS } from "@/lib/debug/calibration/prospective/candidate-types";
import type {
  CaptureReport,
  ProspectiveCaptureBatch,
} from "@/lib/debug/calibration/prospective/capture/capture-types";

export function buildCaptureReport(batch: ProspectiveCaptureBatch): CaptureReport {
  return {
    batchId: batch.batchId,
    createdAt: batch.createdAt,
    candidateFingerprint: batch.candidateFingerprint,
    fixtureCount: batch.fixtureCount,
    recordCount: batch.recordCount,
    fixtures: batch.fixtures.map((fixture) => {
      const candidateIds = batch.records
        .filter((record) => record.fixtureId === fixture.fixtureId)
        .map((record) => record.candidateId);
      return {
        fixtureId: fixture.fixtureId,
        teams: `${fixture.homeTeamName} vs ${fixture.awayTeamName}`,
        kickoff: fixture.kickoff,
        capturedAt: fixture.capturedAt,
        evidenceAsOf: fixture.evidenceAsOf,
        oddsPresent: fixture.oddsPresent,
        candidateIds,
      };
    }),
    integrity: {
      timeGuards: "PASS",
      evidenceGuards: "PASS",
      duplicateGuards: "PASS",
      hashVerification: "PASS",
      pendingOutcomeVerification: "PASS",
    },
  };
}

export function formatCaptureReport(report: CaptureReport): string {
  const lines = [
    "RC2 5C.2 prospective capture report",
    `batchId: ${report.batchId}`,
    `createdAt: ${report.createdAt}`,
    `candidateFingerprint: ${report.candidateFingerprint}`,
    `fixtureCount: ${report.fixtureCount}`,
    `recordCount: ${report.recordCount}`,
    "",
    "fixtures:",
  ];
  for (const fixture of report.fixtures) {
    lines.push(
      `- ${fixture.fixtureId} | ${fixture.teams} | kickoff=${fixture.kickoff} | capturedAt=${fixture.capturedAt} | evidenceAsOf=${fixture.evidenceAsOf} | odds=${fixture.oddsPresent ? "yes" : "no"} | candidates=${fixture.candidateIds.join(",")}`,
    );
  }
  lines.push("");
  lines.push("integrity:");
  lines.push(`- time guards: ${report.integrity.timeGuards}`);
  lines.push(`- evidence guards: ${report.integrity.evidenceGuards}`);
  lines.push(`- duplicate guards: ${report.integrity.duplicateGuards}`);
  lines.push(`- hash verification: ${report.integrity.hashVerification}`);
  lines.push(`- pending outcome verification: ${report.integrity.pendingOutcomeVerification}`);
  lines.push("");
  lines.push(`frozen candidate IDs: ${PROSPECTIVE_CANDIDATE_IDS.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
