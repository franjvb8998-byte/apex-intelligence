/**
 * PE-4I.16 — Presence-aware extraction of canonical stats from raw envelopes.
 * Missing ≠ 0. No imputation / EloPoisson substitution.
 */

import type { Pe4I2RawStatisticsEnvelope } from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import {
  ambiguousNumeric,
  missingNumeric,
  presentNumeric,
  type Pe4I15PresenceNumeric,
  type Pe4I15TeamBlock,
  emptyTeamBlock,
} from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";

type ExtractableField =
  | "expectedGoals"
  | "shots"
  | "shotsOnTarget"
  | "possession"
  | "corners"
  | "yellowCards"
  | "redCards";

const FIELD_CANDIDATES: Readonly<Record<ExtractableField, readonly string[]>> = {
  expectedGoals: ["expected_goals", "expected goals", "xg"],
  shots: ["total shots", "shots"],
  shotsOnTarget: ["shots on goal", "shots on target"],
  possession: ["ball possession", "possession"],
  corners: ["corner kicks", "corners"],
  yellowCards: ["yellow cards"],
  redCards: ["red cards"],
};

function matchField(rawName: string, field: ExtractableField): boolean {
  const lower = rawName.trim().toLowerCase();
  return FIELD_CANDIDATES[field].some((c) => c === lower);
}

function extractFieldPresence(
  team: Pe4I2RawStatisticsEnvelope["teams"][number] | undefined,
  field: ExtractableField,
): Pe4I15PresenceNumeric {
  if (!team) return missingNumeric();
  const hit = team.statistics.find((s) => matchField(s.rawName, field));
  if (!hit || hit.valuePresence !== "present") return missingNumeric();
  if (!hit.parseableNumeric || hit.parsedNumeric == null) {
    return ambiguousNumeric();
  }
  return presentNumeric(hit.parsedNumeric);
}

/**
 * Build a presence-aware team block from a statistics envelope side.
 * Goals are NOT taken from the stats endpoint (fixture evidence owns goals).
 */
export function teamBlockFromStatisticsSide(input: {
  teamId: string;
  envelope: Pe4I2RawStatisticsEnvelope | null | undefined;
}): Pe4I15TeamBlock {
  const base = emptyTeamBlock(input.teamId);
  if (!input.envelope) return base;

  const team = input.envelope.teams.find(
    (t) => t.providerTeamId === input.teamId,
  );

  return {
    teamId: input.teamId,
    goals: base.goals,
    expectedGoals: extractFieldPresence(team, "expectedGoals"),
    shots: extractFieldPresence(team, "shots"),
    shotsOnTarget: extractFieldPresence(team, "shotsOnTarget"),
    possession: extractFieldPresence(team, "possession"),
    corners: extractFieldPresence(team, "corners"),
    yellowCards: extractFieldPresence(team, "yellowCards"),
    redCards: extractFieldPresence(team, "redCards"),
  };
}
