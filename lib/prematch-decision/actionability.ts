/**
 * Product-level prematch actionability gate.
 *
 * CURRENT ACTIONABLE PREMATCH OPPORTUNITY
 *   = vendor status NS
 *   AND valid kickoffUtc
 *   AND now < kickoffUtc
 *
 * Historical information is not a current recommendation.
 * This module does not freeze tickets or alter PE / scoring math.
 */

export type PrematchActionabilityReason =
  | "ACTIONABLE_PREMATCH"
  | "STATUS_NOT_PREMATCH"
  | "KICKOFF_MISSING_OR_INVALID"
  | "KICKOFF_REACHED"
  | "STATUS_UNKNOWN";

export type PrematchActionabilityCopyKey =
  | "noLongerPrematchOpportunity"
  | "noFrozenPrematchDecision";

export type InjectedClock = Date | string | number;

export type PrematchActionabilityInput = {
  vendorStatusShort?: string | null;
  kickoffUtc?: string | null;
  /** Injected clock. Prefer this over Date.now() inside callers. */
  nowUtc?: InjectedClock;
  /** Alias for nowUtc. */
  asOf?: InjectedClock;
};

export type PrematchActionability = {
  fixtureStatus: string;
  kickoffUtc: string | null;
  nowUtc: string;
  isCurrentlyActionable: boolean;
  reason: PrematchActionabilityReason;
};

export const ACTIONABLE_VENDOR_STATUS = "NS";

const NOT_PREMATCH_VENDOR_STATUSES = new Set<string>([
  "TBD",
  "PST",
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
  "SUSP",
  "ABD",
  "CANC",
  "AWD",
  "WO",
  "FT",
  "AET",
  "PEN",
]);

const KNOWN_VENDOR_STATUSES = new Set<string>([
  ACTIONABLE_VENDOR_STATUS,
  ...NOT_PREMATCH_VENDOR_STATUSES,
]);

const TERMINAL_VENDOR_STATUSES = new Set<string>([
  "FT",
  "AET",
  "PEN",
  "ABD",
  "CANC",
  "AWD",
  "WO",
]);

export type ActionableOpportunityRow = {
  vendorStatusShort?: string | null;
  kickoffAt: string;
  /** Required for current betting publication. L1-only is not enough. */
  durableTicketConfirmed?: boolean;
};

function resolveClock(clock: InjectedClock | undefined): Date {
  if (clock === undefined) return new Date();
  if (clock instanceof Date) return clock;
  return new Date(clock);
}

export function normalizeVendorStatusShort(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function parseKickoffUtc(raw: string | null | undefined): Date | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function notActionable(
  now: Date,
  fixtureStatus: string,
  kickoffUtc: string | null,
  reason: PrematchActionabilityReason,
): PrematchActionability {
  return {
    fixtureStatus,
    kickoffUtc,
    nowUtc: now.toISOString(),
    isCurrentlyActionable: false,
    reason,
  };
}

/**
 * Pure actionability decision. Clock is injected; Date is read once at the edge.
 */
export function evaluatePrematchActionability(
  input: PrematchActionabilityInput,
): PrematchActionability {
  const now = resolveClock(input.nowUtc ?? input.asOf);
  const fixtureStatus =
    normalizeVendorStatusShort(input.vendorStatusShort) ?? "UNKNOWN";
  const kickoff = parseKickoffUtc(input.kickoffUtc);
  const kickoffUtc = kickoff ? kickoff.toISOString() : null;

  if (!KNOWN_VENDOR_STATUSES.has(fixtureStatus)) {
    return notActionable(now, fixtureStatus, kickoffUtc, "STATUS_UNKNOWN");
  }

  if (fixtureStatus !== ACTIONABLE_VENDOR_STATUS) {
    return notActionable(now, fixtureStatus, kickoffUtc, "STATUS_NOT_PREMATCH");
  }

  if (!kickoff) {
    return notActionable(
      now,
      fixtureStatus,
      kickoffUtc,
      "KICKOFF_MISSING_OR_INVALID",
    );
  }

  if (now.getTime() >= kickoff.getTime()) {
    return notActionable(now, fixtureStatus, kickoffUtc, "KICKOFF_REACHED");
  }

  return {
    fixtureStatus,
    kickoffUtc,
    nowUtc: now.toISOString(),
    isCurrentlyActionable: true,
    reason: "ACTIONABLE_PREMATCH",
  };
}

export function isCurrentlyActionablePrematch(
  input: PrematchActionabilityInput,
): boolean {
  return evaluatePrematchActionability(input).isCurrentlyActionable;
}

export function evaluateOpportunityActionability(
  row: ActionableOpportunityRow,
  clock?: InjectedClock,
): PrematchActionability {
  return evaluatePrematchActionability({
    vendorStatusShort: row.vendorStatusShort,
    kickoffUtc: row.kickoffAt,
    nowUtc: clock,
  });
}

export function isCurrentActionableOpportunity(
  row: ActionableOpportunityRow,
  clock?: InjectedClock,
): boolean {
  return (
    row.durableTicketConfirmed === true &&
    evaluateOpportunityActionability(row, clock).isCurrentlyActionable
  );
}

export function filterCurrentActionableOpportunities<
  T extends ActionableOpportunityRow,
>(rows: T[], clock?: InjectedClock): T[] {
  const now = resolveClock(clock);
  return rows.filter((row) =>
    isCurrentActionableOpportunity(row, now),
  );
}

export function prematchActionabilityCopyKey(
  result: PrematchActionability,
): PrematchActionabilityCopyKey {
  if (
    result.reason === "STATUS_NOT_PREMATCH" &&
    TERMINAL_VENDOR_STATUSES.has(result.fixtureStatus)
  ) {
    return "noFrozenPrematchDecision";
  }
  return "noLongerPrematchOpportunity";
}

export function allowsCurrentBettingSurfaces(
  result: PrematchActionability,
): boolean {
  return result.isCurrentlyActionable;
}

export function evaluateMatchActionability(
  match: { vendorStatusShort?: string | null; kickoffAt: string },
  clock?: InjectedClock,
): PrematchActionability {
  return evaluatePrematchActionability({
    vendorStatusShort: match.vendorStatusShort,
    kickoffUtc: match.kickoffAt,
    nowUtc: clock,
  });
}

export function presentMatchCenterBettingSurfaces<TValue>(
  match: {
    vendorStatusShort?: string | null;
    kickoffAt: string;
    durableTicketConfirmed?: boolean;
  },
  dashboard: { valueBet: TValue | null },
  clock?: InjectedClock,
): {
  currentlyActionable: boolean;
  reason: PrematchActionabilityReason;
  copyKey: PrematchActionabilityCopyKey;
  valueBet: TValue | null;
  showCurrentRecommendation: boolean;
} {
  const actionability = evaluateMatchActionability(match, clock);
  const ticketConfirmed = match.durableTicketConfirmed === true;
  const currentlyActionable =
    actionability.isCurrentlyActionable && ticketConfirmed;
  return {
    currentlyActionable,
    reason: actionability.reason,
    copyKey: currentlyActionable
      ? prematchActionabilityCopyKey(actionability)
      : actionability.isCurrentlyActionable
        ? "noFrozenPrematchDecision"
        : prematchActionabilityCopyKey(actionability),
    valueBet: currentlyActionable ? dashboard.valueBet : null,
    showCurrentRecommendation: currentlyActionable,
  };
}
