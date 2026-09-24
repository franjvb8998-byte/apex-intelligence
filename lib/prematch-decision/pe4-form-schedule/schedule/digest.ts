/**
 * PE-4F — Deterministic digest of material cross-comp schedule evidence.
 * Independent of acquisition timestamps and provider response order.
 */

import { createHash } from "node:crypto";
import type { Pe4CrossCompScheduleSideEvidence } from "@/lib/prematch-decision/pe4-form-schedule/schedule/types";

export const PE4_TEAM_SCHEDULE_EVIDENCE_DIGEST_VERSION = "1" as const;

export function digestPe4CrossCompScheduleSide(
  side: Omit<Pe4CrossCompScheduleSideEvidence, "scheduleEvidenceDigest">,
): string {
  const payload = [
    `v${PE4_TEAM_SCHEDULE_EVIDENCE_DIGEST_VERSION}`,
    `team=${side.teamId}`,
    `vendor=${side.vendorTeamId}`,
    `season=${side.providerSeason}`,
    `scope=${side.acquisitionScope}`,
    `from=${side.requestedFromDate ?? ""}`,
    `to=${side.requestedToDate ?? ""}`,
    `envComplete=${side.providerEnvelopeComplete ? 1 : 0}`,
    `congComplete=${side.congestionWindowComplete ? 1 : 0}`,
    `prevComplete=${side.previousMatchComplete ? 1 : 0}`,
    `blind=${side.crossCompetitionBlind ? 1 : 0}`,
    `winFrom=${side.congestionWindowFromUtc}`,
    `winToEx=${side.congestionWindowToExclusiveUtc}`,
    `congIds=${[...side.congestionFixtureIds].sort().join(",")}`,
    `congCount=${side.congestionMatchCount}`,
    `prevKick=${side.previousCompletedKickoffUtc ?? ""}`,
    `rest=${
      side.restHoursSincePreviousCompleted == null
        ? ""
        : String(side.restHoursSincePreviousCompleted)
    }`,
    `comps=${[...side.competitionIdsRepresented].sort().join(",")}`,
    `allIds=${[...side.normalizedFixtureIds].sort().join(",")}`,
    `status=${side.semanticStatus}`,
    `semanticComplete=${side.semanticScheduleComplete ? 1 : 0}`,
    `reason=${side.semanticReason ?? ""}`,
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
