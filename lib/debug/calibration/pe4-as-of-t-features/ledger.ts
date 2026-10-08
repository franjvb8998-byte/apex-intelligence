/**
 * PE-4I.15 — Historical match ledger types (presence-aware; no invented values).
 */

import {
  pe4I15Err,
  pe4I15Ok,
  type Pe4I15Result,
} from "@/lib/debug/calibration/pe4-as-of-t-features/fail-closed";
import {
  classifyHoldoutForResearch,
  type Pe4I15HoldoutClassification,
} from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";
import { parseKickoffUtcMillis } from "@/lib/debug/calibration/pe4-acquisition/temporal";
import { PE4I15_LEDGER_VERSION } from "@/lib/debug/calibration/pe4-as-of-t-features/protocol";

/** Presence enum: never coerce missing → 0. */
export type Pe4I15FieldPresence = "present" | "missing" | "ambiguous";

export type Pe4I15GoalsSource =
  | "provider_ft_score"
  | "provider_regulation_unknown"
  | "unavailable";

export type Pe4I15PresenceNumeric = {
  presence: Pe4I15FieldPresence;
  /** Only set when presence === "present"; never invented. */
  value: number | null;
};

export type Pe4I15TeamBlock = {
  teamId: string;
  goals: Pe4I15PresenceNumeric;
  expectedGoals: Pe4I15PresenceNumeric;
  shots: Pe4I15PresenceNumeric;
  shotsOnTarget: Pe4I15PresenceNumeric;
  possession: Pe4I15PresenceNumeric;
  corners: Pe4I15PresenceNumeric;
  yellowCards: Pe4I15PresenceNumeric;
  redCards: Pe4I15PresenceNumeric;
};

export type Pe4I15ProvenanceRef = {
  /** e.g. statistics::fixture=123 */
  cacheKey?: string;
  envelopeDigest?: string;
  acquisitionStage?: string;
  rawPath?: string;
};

export type Pe4I15HistoricalMatchLedgerRow = {
  ledgerVersion: typeof PE4I15_LEDGER_VERSION;
  fixtureId: string;
  competition: string;
  providerSeason: string;
  kickoffUtc: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  goalsSource: Pe4I15GoalsSource;
  home: Pe4I15TeamBlock;
  away: Pe4I15TeamBlock;
  provenance: Pe4I15ProvenanceRef;
  /**
   * True when status is AET/PEN (or similar) and regulation-only
   * stats/goals cannot be proven from provider fields.
   */
  regulationAmbiguity: boolean;
  holdoutClassification: Pe4I15HoldoutClassification;
};

export function missingNumeric(): Pe4I15PresenceNumeric {
  return { presence: "missing", value: null };
}

export function presentNumeric(value: number): Pe4I15PresenceNumeric {
  return { presence: "present", value };
}

export function ambiguousNumeric(): Pe4I15PresenceNumeric {
  return { presence: "ambiguous", value: null };
}

export function emptyTeamBlock(teamId: string): Pe4I15TeamBlock {
  return {
    teamId,
    goals: missingNumeric(),
    expectedGoals: missingNumeric(),
    shots: missingNumeric(),
    shotsOnTarget: missingNumeric(),
    possession: missingNumeric(),
    corners: missingNumeric(),
    yellowCards: missingNumeric(),
    redCards: missingNumeric(),
  };
}

/**
 * Build a ledger row from explicit inputs. Fail-closed on malformed identity.
 * Does not invent statistic values.
 */
export function buildHistoricalMatchLedgerRow(input: {
  fixtureId: string;
  competition: string;
  providerSeason: string;
  kickoffUtc: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  goalsSource?: Pe4I15GoalsSource;
  home?: Partial<Pe4I15TeamBlock>;
  away?: Partial<Pe4I15TeamBlock>;
  provenance?: Pe4I15ProvenanceRef;
  regulationAmbiguity?: boolean;
}): Pe4I15Result<Pe4I15HistoricalMatchLedgerRow> {
  if (!input.fixtureId?.trim()) {
    return pe4I15Err("missing_fixture_id");
  }
  if (!input.competition?.trim()) {
    return pe4I15Err("missing_competition");
  }
  if (!input.providerSeason?.trim()) {
    return pe4I15Err("missing_provider_season");
  }
  if (parseKickoffUtcMillis(input.kickoffUtc) == null) {
    return input.kickoffUtc
      ? pe4I15Err("malformed_kickoff", input.kickoffUtc)
      : pe4I15Err("missing_kickoff");
  }
  const homeId = input.homeTeamId?.trim() ?? "";
  const awayId = input.awayTeamId?.trim() ?? "";
  if (!homeId || !awayId || homeId === awayId) {
    return pe4I15Err("malformed_teams");
  }

  const statusUpper = (input.status ?? "").toUpperCase();
  const regulationAmbiguity =
    input.regulationAmbiguity ??
    (statusUpper === "AET" || statusUpper === "PEN");

  const holdoutClassification = classifyHoldoutForResearch({
    kickoffUtc: input.kickoffUtc,
    providerSeasonId: input.providerSeason,
  });

  const homeBase = emptyTeamBlock(homeId);
  const awayBase = emptyTeamBlock(awayId);

  return pe4I15Ok({
    ledgerVersion: PE4I15_LEDGER_VERSION,
    fixtureId: input.fixtureId.trim(),
    competition: input.competition.trim(),
    providerSeason: input.providerSeason.trim(),
    kickoffUtc: input.kickoffUtc,
    status: input.status,
    homeTeamId: homeId,
    awayTeamId: awayId,
    goalsSource: input.goalsSource ?? "unavailable",
    home: { ...homeBase, ...input.home, teamId: homeId },
    away: { ...awayBase, ...input.away, teamId: awayId },
    provenance: input.provenance ?? {},
    regulationAmbiguity,
    holdoutClassification,
  });
}

/** Count present fields across both sides for coverage reporting. */
export function countPresence(
  row: Pe4I15HistoricalMatchLedgerRow,
  field: keyof Omit<Pe4I15TeamBlock, "teamId">,
): { present: number; missing: number; ambiguous: number } {
  const sides = [row.home[field], row.away[field]];
  let present = 0;
  let missing = 0;
  let ambiguous = 0;
  for (const s of sides) {
    if (s.presence === "present") present += 1;
    else if (s.presence === "ambiguous") ambiguous += 1;
    else missing += 1;
  }
  return { present, missing, ambiguous };
}
