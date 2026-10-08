/**
 * PE-4I.15 — Temporal / target-time contract.
 * Every history M must satisfy kickoffUtc(M) < kickoffUtc(T).
 * Fail-closed for self, same-kickoff, future, post-T, missing kickoff,
 * duplicates, conflicting identity, malformed teams, incomplete stats, AET/PEN.
 */

import {
  assertNotSameKickoffOrSelf,
  isStrictlyBeforeKickoff,
  parseKickoffUtcMillis,
} from "@/lib/debug/calibration/pe4-acquisition/temporal";
import { isEligibleHistoricalForTarget } from "@/lib/debug/calibration/pe4-acquisition/as-of-t";
import {
  pe4I15Err,
  pe4I15Ok,
  type Pe4I15FailClosedReason,
  type Pe4I15Result,
} from "@/lib/debug/calibration/pe4-as-of-t-features/fail-closed";
import {
  assertCalendar2025OutcomeExcludedFromResearchPools,
  isCalendar2025Kickoff,
} from "@/lib/debug/calibration/pe4-as-of-t-features/holdout-firewall";

export type Pe4I15TargetRef = {
  fixtureId: string;
  kickoffUtc: string;
};

export type Pe4I15HistoryCandidate = {
  fixtureId: string;
  kickoffUtc: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  status?: string | null;
  /** When true, stats required for the consuming family are incomplete. */
  incompleteStats?: boolean;
  /** AET/PEN with no proven regulation-only split. */
  regulationAmbiguous?: boolean;
};

export type Pe4I15TemporalReject = {
  fixtureId: string;
  reason: Pe4I15FailClosedReason;
  detail?: string;
};

/**
 * Validate a single history row against target T.
 * Reuses pe4-acquisition temporal helpers; adds fail-closed for
 * malformed teams / incomplete stats / AET-PEN / calendar-2025 holdout.
 */
export function validateHistoryAgainstTarget(input: {
  historical: Pe4I15HistoryCandidate;
  target: Pe4I15TargetRef;
  /** When true (default), exclude calendar-2025 holdout outcomes from research pools. */
  excludeCalendar2025HoldoutOutcomes?: boolean;
  /** When true, require both team IDs non-empty. */
  requireTeams?: boolean;
  /** When true, reject incompleteStats. */
  requireCompleteStats?: boolean;
  /** When true, reject regulationAmbiguous (AET/PEN). */
  rejectRegulationAmbiguous?: boolean;
}): Pe4I15Result<Pe4I15HistoryCandidate> {
  const {
    historical,
    target,
    excludeCalendar2025HoldoutOutcomes = true,
    requireTeams = false,
    requireCompleteStats = false,
    rejectRegulationAmbiguous = false,
  } = input;

  if (!historical.fixtureId || historical.fixtureId.trim() === "") {
    return pe4I15Err("missing_fixture_id");
  }
  if (!target.fixtureId || target.fixtureId.trim() === "") {
    return pe4I15Err("missing_fixture_id", "target");
  }

  const histMs = parseKickoffUtcMillis(historical.kickoffUtc);
  const tgtMs = parseKickoffUtcMillis(target.kickoffUtc);
  if (histMs == null) {
    return historical.kickoffUtc == null || historical.kickoffUtc === ""
      ? pe4I15Err("missing_kickoff")
      : pe4I15Err("malformed_kickoff", historical.kickoffUtc);
  }
  if (tgtMs == null) {
    return target.kickoffUtc == null || target.kickoffUtc === ""
      ? pe4I15Err("missing_kickoff", "target")
      : pe4I15Err("malformed_kickoff", `target:${target.kickoffUtc}`);
  }

  const eligibility = isEligibleHistoricalForTarget({
    historical: {
      providerFixtureId: historical.fixtureId,
      kickoffUtc: historical.kickoffUtc,
    },
    target: {
      providerFixtureId: target.fixtureId,
      kickoffUtc: target.kickoffUtc,
    },
  });
  if (!eligibility.ok) {
    const mapped =
      eligibility.reason === "target_fixture_excluded"
        ? "target_fixture_excluded"
        : eligibility.reason === "same_kickoff_excluded"
          ? "same_kickoff_excluded"
          : "not_strictly_before_target";
    return pe4I15Err(
      mapped === "not_strictly_before_target" && histMs >= tgtMs
        ? "future_or_post_t_info"
        : mapped,
    );
  }

  // Defense-in-depth: assert helper + strict before
  const selfCheck = assertNotSameKickoffOrSelf({
    historicalFixtureId: historical.fixtureId,
    historicalKickoffUtc: historical.kickoffUtc,
    targetFixtureId: target.fixtureId,
    targetKickoffUtc: target.kickoffUtc,
  });
  if (!selfCheck.ok) {
    return pe4I15Err(
      selfCheck.reason as Pe4I15FailClosedReason,
      selfCheck.reason,
    );
  }
  if (!isStrictlyBeforeKickoff(historical.kickoffUtc, target.kickoffUtc)) {
    return pe4I15Err("future_or_post_t_info");
  }

  if (excludeCalendar2025HoldoutOutcomes) {
    const holdout = assertCalendar2025OutcomeExcludedFromResearchPools({
      kickoffUtc: historical.kickoffUtc,
    });
    if (!holdout.ok) return holdout;
  }

  if (requireTeams) {
    const home = historical.homeTeamId?.trim() ?? "";
    const away = historical.awayTeamId?.trim() ?? "";
    if (!home || !away || home === away) {
      return pe4I15Err("malformed_teams");
    }
  }

  if (requireCompleteStats && historical.incompleteStats === true) {
    return pe4I15Err("incomplete_stats");
  }

  if (
    rejectRegulationAmbiguous &&
    historical.regulationAmbiguous === true
  ) {
    return pe4I15Err("aet_pen_ambiguous_regulation");
  }

  return pe4I15Ok(historical);
}

/**
 * Filter + validate a candidate pool. Deterministic ordering:
 * kickoffUtc ascending, then fixtureId ascending.
 * Duplicate IDs and conflicting identity → fail-closed for the whole batch
 * when `failOnDuplicates` (default true).
 */
export function filterEligibleHistoryForTarget(input: {
  candidates: readonly Pe4I15HistoryCandidate[];
  target: Pe4I15TargetRef;
  excludeCalendar2025HoldoutOutcomes?: boolean;
  requireTeams?: boolean;
  requireCompleteStats?: boolean;
  rejectRegulationAmbiguous?: boolean;
  failOnDuplicates?: boolean;
}): Pe4I15Result<{
  accepted: Pe4I15HistoryCandidate[];
  rejected: Pe4I15TemporalReject[];
}> {
  const failOnDuplicates = input.failOnDuplicates !== false;
  const accepted: Pe4I15HistoryCandidate[] = [];
  const rejected: Pe4I15TemporalReject[] = [];
  const seen = new Map<string, Pe4I15HistoryCandidate>();

  for (const c of input.candidates) {
    if (seen.has(c.fixtureId)) {
      const prev = seen.get(c.fixtureId)!;
      if (
        prev.kickoffUtc !== c.kickoffUtc ||
        prev.homeTeamId !== c.homeTeamId ||
        prev.awayTeamId !== c.awayTeamId
      ) {
        if (failOnDuplicates) {
          return pe4I15Err(
            "conflicting_identity",
            `fixtureId=${c.fixtureId}`,
          );
        }
        rejected.push({
          fixtureId: c.fixtureId,
          reason: "conflicting_identity",
        });
        continue;
      }
      if (failOnDuplicates) {
        return pe4I15Err("duplicate_fixture_id", c.fixtureId);
      }
      rejected.push({
        fixtureId: c.fixtureId,
        reason: "duplicate_fixture_id",
      });
      continue;
    }
    seen.set(c.fixtureId, c);

    const v = validateHistoryAgainstTarget({
      historical: c,
      target: input.target,
      excludeCalendar2025HoldoutOutcomes:
        input.excludeCalendar2025HoldoutOutcomes,
      requireTeams: input.requireTeams,
      requireCompleteStats: input.requireCompleteStats,
      rejectRegulationAmbiguous: input.rejectRegulationAmbiguous,
    });
    if (!v.ok) {
      rejected.push({
        fixtureId: c.fixtureId || "(missing)",
        reason: v.reason,
        detail: v.detail,
      });
      continue;
    }
    accepted.push(v.value);
  }

  accepted.sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.fixtureId.localeCompare(b.fixtureId);
  });

  return pe4I15Ok({ accepted, rejected });
}

/** True when candidate kickoff is calendar-2025 (UTC). */
export function historyIsCalendar2025Holdout(
  historical: Pick<Pe4I15HistoryCandidate, "kickoffUtc">,
): boolean {
  return isCalendar2025Kickoff(historical.kickoffUtc);
}
