/**
 * Compact, versioned digest of accepted C0 priors for ticket reproducibility.
 *
 * Does not prove provider historical immutability — only that the same accepted
 * evidence rows yield the same digest. Order-independent. No secrets.
 */

import { createHash } from "node:crypto";
import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";

export const PREMATCH_ACCEPTED_EVIDENCE_DIGEST_VERSION = "1" as const;

function rowLine(row: PrematchStrengthUniverseFixture): string {
  return [
    row.fixtureId,
    row.kickoffUtc,
    row.homeTeamId,
    row.awayTeamId,
    row.competitionId,
    row.season,
    row.status,
    row.homeGoals == null ? "" : String(row.homeGoals),
    row.awayGoals == null ? "" : String(row.awayGoals),
  ].join("|");
}

/**
 * SHA-256 hex digest over sorted accepted prior lines.
 * Empty accepted set → deterministic empty digest for the version.
 */
export function digestAcceptedPrematchEvidence(
  accepted: readonly PrematchStrengthUniverseFixture[],
): string {
  const lines = accepted.map(rowLine).sort((a, b) => a.localeCompare(b));
  const payload = [
    `v${PREMATCH_ACCEPTED_EVIDENCE_DIGEST_VERSION}`,
    ...lines,
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
