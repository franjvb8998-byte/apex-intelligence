/**
 * PE-4I.2 — Temporal helpers for future as-of-T feature builds.
 * Acquisition may store full seasons; features must enforce kickoff(M) < kickoff(T).
 */

export function parseKickoffUtcMillis(kickoffUtc: string): number | null {
  const ms = Date.parse(kickoffUtc);
  return Number.isFinite(ms) ? ms : null;
}

/** Strict: historical evidence M is eligible for target T only if kickoff(M) < kickoff(T). */
export function isStrictlyBeforeKickoff(
  historicalKickoffUtc: string,
  targetKickoffUtc: string,
): boolean {
  const m = parseKickoffUtcMillis(historicalKickoffUtc);
  const t = parseKickoffUtcMillis(targetKickoffUtc);
  if (m == null || t == null) return false;
  return m < t;
}

export function assertNotSameKickoffOrSelf(input: {
  historicalFixtureId: string;
  historicalKickoffUtc: string;
  targetFixtureId: string;
  targetKickoffUtc: string;
}): { ok: true } | { ok: false; reason: string } {
  if (input.historicalFixtureId === input.targetFixtureId) {
    return { ok: false, reason: "target_fixture_excluded" };
  }
  if (input.historicalKickoffUtc === input.targetKickoffUtc) {
    return { ok: false, reason: "same_kickoff_excluded" };
  }
  if (
    !isStrictlyBeforeKickoff(
      input.historicalKickoffUtc,
      input.targetKickoffUtc,
    )
  ) {
    return { ok: false, reason: "not_strictly_before_target" };
  }
  return { ok: true };
}

/**
 * Future schedule anticipation is UNAVAILABLE without as-of-T snapshots.
 * Storing season fixtures does not prove they were known before T.
 */
export const PE4I2_FUTURE_SCHEDULE_ANTICIPATION =
  "UNAVAILABLE_NO_AS_OF_T_SCHEDULE_SNAPSHOT" as const;
