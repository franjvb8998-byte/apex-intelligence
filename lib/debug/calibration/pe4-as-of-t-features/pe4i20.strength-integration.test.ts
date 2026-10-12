import { describe, expect, it } from "vitest";

import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import {
  buildPe4I20DatasetInMemory,
  buildPe4I20DatasetFromLocalLedger,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-dataset";
import { PE4I20_PRODUCTION_WIRING } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-protocol";
import { buildPe4I20StructuralAuditInMemory } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i20-structure-audit";
import {
  buildHistoricalMatchLedgerRow,
  type Pe4I15HistoricalMatchLedgerRow,
} from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";

function row(input: {
  id: string;
  kickoff: string;
  home: string;
  away: string;
  season?: string;
  status?: string;
}): Pe4I15HistoricalMatchLedgerRow {
  const built = buildHistoricalMatchLedgerRow({
    fixtureId: input.id,
    competition: "league",
    providerSeason: input.season ?? "2024",
    kickoffUtc: input.kickoff,
    status: input.status ?? "FT",
    homeTeamId: input.home,
    awayTeamId: input.away,
    home: { goals: { presence: "present", value: 1 } },
    away: { goals: { presence: "present", value: 0 } },
    provenance: { cacheKey: input.id, envelopeDigest: `digest-${input.id}` },
  });
  if (!built.ok) throw new Error(built.reason);
  return built.value;
}

const completeLedger = () => [
  row({ id: "m1", kickoff: "2024-01-01T12:00:00.000Z", home: "A", away: "B" }),
  row({ id: "m2", kickoff: "2024-01-08T12:00:00.000Z", home: "C", away: "A" }),
  row({ id: "m3", kickoff: "2024-01-15T12:00:00.000Z", home: "A", away: "D" }),
  row({ id: "m4", kickoff: "2024-01-22T12:00:00.000Z", home: "A", away: "E" }),
];

describe("PE-4I.20 strength-integrated dataset", () => {
  it("emits a complete pre-M mean without changing Path B population or xG semantics", () => {
    const result = buildPe4I20DatasetInMemory({
      ledger: completeLedger(),
      ledgerDigest: "toy-ledger",
    });
    const record = result.pathARecords.find(
      (candidate) =>
        candidate.targetFixtureId === "m4" &&
        candidate.teamId === "A" &&
        candidate.windowId === "last_3" &&
        candidate.venueMode === "all",
    )!;
    expect(record.opponentStrength.status).toBe("AVAILABLE");
    expect(record.opponentStrength.observationCount).toBe(3);
    expect(record.opponentStrength.meanOpponentCommonStrengthAsOfM).not.toBeNull();
    expect(record.opponentStrength.partialMeanComputed).toBe(false);
    expect(record.opponentStrength.zeroFillUsed).toBe(false);
    expect(result.populationParity).toBe(true);
    expect(result.pathBDigest).toBe(result.basePathBDigest);
    expect(result.pathBRecords.every((candidate) =>
      candidate.pathB.zeroFillUsed === false && candidate.pathB.populationShifted === false,
    )).toBe(true);
  });

  it("fails the family closed on a conflicting key without dropping the record", () => {
    const ledger = [
      row({ id: "c1", kickoff: "2024-01-01T12:00:00.000Z", home: "A", away: "X" }),
      row({ id: "c2", kickoff: "2024-01-01T12:00:00.000Z", home: "B", away: "X" }),
      row({ id: "m2", kickoff: "2024-01-08T12:00:00.000Z", home: "A", away: "C" }),
      row({ id: "m3", kickoff: "2024-01-15T12:00:00.000Z", home: "D", away: "A" }),
      row({ id: "target", kickoff: "2024-01-22T12:00:00.000Z", home: "A", away: "E" }),
    ];
    const result = buildPe4I20DatasetInMemory({
      ledger,
      ledgerDigest: "conflict-ledger",
      expectedConflictCounts: { conflictedKeys: 1, missingPerspectives: 2 },
    });
    const record = result.pathARecords.find(
      (candidate) =>
        candidate.targetFixtureId === "target" &&
        candidate.teamId === "A" &&
        candidate.windowId === "last_3" &&
        candidate.venueMode === "all",
    )!;
    expect(record.opponentStrength.status).toBe("UNAVAILABLE");
    expect(record.opponentStrength.unavailableReason).toBe("incomplete_strength_join_coverage");
    expect(record.opponentStrength.meanOpponentCommonStrengthAsOfM).toBeNull();
    expect(record.opponentStrength.matchedCount).toBe(2);
    expect(record.opponentStrength.missingCount).toBe(1);
    expect(result.pathARowCount).toBe(result.pathBRowCount);
  });

  it("keeps both holdout axes and AET/PEN targets excluded", () => {
    const result = buildPe4I20DatasetInMemory({
      ledger: [
        ...completeLedger(),
        row({ id: "calendar", kickoff: "2025-01-01T12:00:00.000Z", home: "A", away: "B" }),
        row({ id: "season", kickoff: "2024-02-01T12:00:00.000Z", home: "A", away: "B", season: "2025" }),
        row({ id: "aet", kickoff: "2024-02-08T12:00:00.000Z", home: "A", away: "B", status: "AET" }),
        row({ id: "pen", kickoff: "2024-02-15T12:00:00.000Z", home: "A", away: "B", status: "PEN" }),
      ],
      ledgerDigest: "firewall-ledger",
    });
    const ids = new Set(result.pathARecords.map((candidate) => candidate.targetFixtureId));
    expect(ids.has("calendar")).toBe(false);
    expect(ids.has("season")).toBe(false);
    expect(ids.has("aet")).toBe(false);
    expect(ids.has("pen")).toBe(false);
    expect(result.holdoutFirewall.pass).toBe(true);
  });

  it("runs a deterministic label-free renewed structural audit", () => {
    const dataset = buildPe4I20DatasetInMemory({
      ledger: completeLedger(),
      ledgerDigest: "audit-ledger",
    });
    const audit = buildPe4I20StructuralAuditInMemory(dataset);
    expect(audit.labelsRead).toBe(false);
    expect(audit.noFeatureVsOutcomeStats).toBe(true);
    expect(audit.reproducibility.pass).toBe(true);
    expect(audit.comparisons.populationParityPreserved).toBe(true);
    expect(audit.featureFamilyMatrix.opponentStrengthStatus).toBe("PARTIAL");
  });

  it("is deterministic under shuffled ledger input", () => {
    const rows = completeLedger();
    const a = buildPe4I20DatasetInMemory({ ledger: rows, ledgerDigest: "same" });
    const b = buildPe4I20DatasetInMemory({
      ledger: [...rows].reverse(),
      ledgerDigest: "same",
    });
    expect(a.pathADigest).toBe(b.pathADigest);
    expect(a.pathBDigest).toBe(b.pathBDigest);
    expect(a.catalogueDigest).toBe(b.catalogueDigest);
  });

  it("pins the local corpus at 969 targets, 40,698 rows/path, 8 keys and 16 perspectives", () => {
    const result = buildPe4I20DatasetFromLocalLedger();
    expect(result.targetCount).toBe(969);
    expect(result.pathARowCount).toBe(40_698);
    expect(result.pathBRowCount).toBe(40_698);
    expect(result.strengthCoverage.conflictedStrengthKeyCount).toBe(8);
    expect(result.strengthCoverage.devPerspectiveJoinMissingCount).toBe(16);
    expect(result.populationParity).toBe(true);
    expect(result.holdoutFirewall.pass).toBe(true);
  }, 60_000);

  it("keeps all production activation disabled", () => {
    expect(PE4I20_PRODUCTION_WIRING).toBe(false);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
  });
});
