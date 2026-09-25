/**
 * PE-4I.2 — Fixture identity + dedupe (fail-closed on conflicts).
 */

import { createHash } from "node:crypto";
import type { Pe4I2RawScheduleFixtureRow } from "@/lib/debug/calibration/pe4-acquisition/envelopes";

export type Pe4I2DedupeResult =
  | {
      ok: true;
      fixtures: Pe4I2RawScheduleFixtureRow[];
      collapsedIdenticalDuplicates: number;
    }
  | {
      ok: false;
      reason: "conflicting_duplicate_fixture" | "missing_fixture_id";
      providerFixtureId?: string;
      message: string;
    };

export function scheduleIdentityDigest(input: {
  providerFixtureId: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
  providerCompetitionId: string | null;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
}): string {
  const line = [
    input.providerFixtureId,
    input.kickoffUtc,
    input.homeTeamId,
    input.awayTeamId,
    input.providerCompetitionId ?? "",
    input.status,
    input.homeGoals == null ? "" : String(input.homeGoals),
    input.awayGoals == null ? "" : String(input.awayGoals),
  ].join("|");
  return createHash("sha256").update(line, "utf8").digest("hex");
}

/**
 * Collapse identical fixture rows; fail closed on same id with different identity.
 * Competition class does not participate in identity.
 */
export function dedupeScheduleFixtures(
  rows: readonly Pe4I2RawScheduleFixtureRow[],
): Pe4I2DedupeResult {
  const byId = new Map<string, Pe4I2RawScheduleFixtureRow>();
  let collapsed = 0;
  for (const row of rows) {
    const id = row.providerFixtureId?.trim();
    if (!id) {
      return {
        ok: false,
        reason: "missing_fixture_id",
        message: "schedule row missing providerFixtureId",
      };
    }
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, row);
      continue;
    }
    if (existing.identityDigest === row.identityDigest) {
      collapsed += 1;
      continue;
    }
    return {
      ok: false,
      reason: "conflicting_duplicate_fixture",
      providerFixtureId: id,
      message: `conflicting duplicate fixture ${id}`,
    };
  }
  const fixtures = [...byId.values()].sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.providerFixtureId.localeCompare(b.providerFixtureId);
  });
  return { ok: true, fixtures, collapsedIdenticalDuplicates: collapsed };
}

export function digestFixtureIdSet(ids: readonly string[]): string {
  const sorted = [...ids].map((x) => x.trim()).filter(Boolean).sort();
  return createHash("sha256").update(sorted.join("\n"), "utf8").digest("hex");
}
