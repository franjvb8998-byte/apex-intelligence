import { describe, expect, it } from "vitest";
import {
  allowsCurrentBettingSurfaces,
  evaluatePrematchActionability,
  filterCurrentActionableOpportunities,
  isCurrentlyActionablePrematch,
  prematchActionabilityCopyKey,
} from "@/lib/prematch-decision/actionability";

const KICKOFF = "2026-09-21T15:00:00.000Z";
const BEFORE = "2026-09-21T14:59:59.999Z";
const AT = "2026-09-21T15:00:00.000Z";
const AFTER = "2026-09-21T15:00:00.001Z";

const LIVE_STATUSES = [
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "LIVE",
  "INT",
] as const;

const SUSPENDED_STATUSES = ["SUSP", "INT"] as const;

const CANCELLED_STATUSES = ["ABD", "CANC", "AWD", "WO"] as const;

const TERMINAL_STATUSES = ["FT", "AET", "PEN"] as const;

function gate(
  status: string | null | undefined,
  kickoffUtc: string | null | undefined,
  nowUtc: string,
) {
  return evaluatePrematchActionability({
    vendorStatusShort: status,
    kickoffUtc,
    nowUtc,
  });
}

describe("prematch actionability", () => {
  it("treats NS before kickoff as an actionable current prematch opportunity", () => {
    const result = gate("NS", KICKOFF, BEFORE);
    expect(result.isCurrentlyActionable).toBe(true);
    expect(result.reason).toBe("ACTIONABLE_PREMATCH");
    expect(result.fixtureStatus).toBe("NS");
    expect(allowsCurrentBettingSurfaces(result)).toBe(true);
  });

  it("treats NS exactly at kickoff as not actionable", () => {
    const result = gate("NS", KICKOFF, AT);
    expect(result.isCurrentlyActionable).toBe(false);
    expect(result.reason).toBe("KICKOFF_REACHED");
  });

  it("treats stale NS after kickoff as not actionable", () => {
    const result = gate("NS", KICKOFF, AFTER);
    expect(result.isCurrentlyActionable).toBe(false);
    expect(result.reason).toBe("KICKOFF_REACHED");
    expect(allowsCurrentBettingSurfaces(result)).toBe(false);
  });

  it("does not treat TBD as actionable", () => {
    const result = gate("TBD", KICKOFF, BEFORE);
    expect(result.isCurrentlyActionable).toBe(false);
    expect(result.reason).toBe("STATUS_NOT_PREMATCH");
  });

  it("does not treat PST as actionable", () => {
    const result = gate("PST", KICKOFF, BEFORE);
    expect(result.isCurrentlyActionable).toBe(false);
    expect(result.reason).toBe("STATUS_NOT_PREMATCH");
  });

  it.each(LIVE_STATUSES)("does not treat live status %s as actionable", (status) => {
    const result = gate(status, KICKOFF, BEFORE);
    expect(result.isCurrentlyActionable).toBe(false);
    expect(result.reason).toBe("STATUS_NOT_PREMATCH");
  });

  it.each(SUSPENDED_STATUSES)(
    "does not treat interrupted/suspended status %s as actionable",
    (status) => {
      const result = gate(status, KICKOFF, BEFORE);
      expect(result.isCurrentlyActionable).toBe(false);
      expect(result.reason).toBe("STATUS_NOT_PREMATCH");
    },
  );

  it.each(CANCELLED_STATUSES)(
    "does not treat cancelled/abandoned status %s as actionable",
    (status) => {
      const result = gate(status, KICKOFF, BEFORE);
      expect(result.isCurrentlyActionable).toBe(false);
      expect(result.reason).toBe("STATUS_NOT_PREMATCH");
      expect(prematchActionabilityCopyKey(result)).toBe("noFrozenPrematchDecision");
    },
  );

  it.each(TERMINAL_STATUSES)(
    "does not treat terminal status %s as a current opportunity",
    (status) => {
      const result = gate(status, KICKOFF, AFTER);
      expect(result.isCurrentlyActionable).toBe(false);
      expect(result.reason).toBe("STATUS_NOT_PREMATCH");
      expect(prematchActionabilityCopyKey(result)).toBe("noFrozenPrematchDecision");
    },
  );

  it("fails closed on unknown or unmapped vendor status", () => {
    const unknown = gate("ZZZ", KICKOFF, BEFORE);
    expect(unknown.isCurrentlyActionable).toBe(false);
    expect(unknown.reason).toBe("STATUS_UNKNOWN");
    expect(unknown.fixtureStatus).toBe("ZZZ");

    const missing = gate(null, KICKOFF, BEFORE);
    expect(missing.isCurrentlyActionable).toBe(false);
    expect(missing.reason).toBe("STATUS_UNKNOWN");
    expect(missing.fixtureStatus).toBe("UNKNOWN");
  });

  it("fails closed when kickoff is missing or invalid even if status is NS", () => {
    expect(gate("NS", null, BEFORE).reason).toBe("KICKOFF_MISSING_OR_INVALID");
    expect(gate("NS", "", BEFORE).reason).toBe("KICKOFF_MISSING_OR_INVALID");
    expect(gate("NS", "not-a-date", BEFORE).reason).toBe(
      "KICKOFF_MISSING_OR_INVALID",
    );
    expect(gate("NS", null, BEFORE).isCurrentlyActionable).toBe(false);
  });

  it("uses the injected clock rather than the system clock", () => {
    const asOf = evaluatePrematchActionability({
      vendorStatusShort: "NS",
      kickoffUtc: KICKOFF,
      asOf: BEFORE,
    });
    expect(asOf.isCurrentlyActionable).toBe(true);
    expect(
      isCurrentlyActionablePrematch({
        vendorStatusShort: "NS",
        kickoffUtc: KICKOFF,
        nowUtc: AFTER,
      }),
    ).toBe(false);
  });

  it("does not fabricate a historical prematch snapshot", () => {
    const finished = gate("FT", KICKOFF, AFTER);
    expect(finished.isCurrentlyActionable).toBe(false);
    expect(prematchActionabilityCopyKey(finished)).toBe(
      "noFrozenPrematchDecision",
    );
    expect(finished).not.toHaveProperty("historicalRecommendation");
    expect(finished).not.toHaveProperty("frozenTicket");
  });

  it("does not publish non-actionable scanner rows as current opportunities", () => {
    const rows = [
      {
        fixtureId: "ns-future",
        vendorStatusShort: "NS",
        kickoffAt: KICKOFF,
        recommendation: "Elite" as const,
      },
      {
        fixtureId: "stale-ns",
        vendorStatusShort: "NS",
        kickoffAt: "2026-09-21T12:00:00.000Z",
        recommendation: "Value Bet" as const,
      },
      {
        fixtureId: "live",
        vendorStatusShort: "1H",
        kickoffAt: KICKOFF,
        recommendation: "Strong Bet" as const,
      },
      {
        fixtureId: "ft",
        vendorStatusShort: "FT",
        kickoffAt: KICKOFF,
        recommendation: "Elite" as const,
      },
    ];
    const published = filterCurrentActionableOpportunities(rows, BEFORE);
    expect(published.map((row) => row.fixtureId)).toEqual(["ns-future"]);
    expect(published.every((row) => row.recommendation === "Elite")).toBe(true);
  });
});
