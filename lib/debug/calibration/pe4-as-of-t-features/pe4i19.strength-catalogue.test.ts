import { describe, expect, it } from "vitest";

import { PRODUCTION_AWAY_ELO_BASE, PRODUCTION_HOME_ELO_BASE } from "@/lib/match-center/catalogue-elo";
import { resolvePrematchStrengthFromUniverse } from "@/lib/match-center/prematch-strength/resolve-prematch-strength";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";
import { buildHistoricalMatchLedgerRow, type Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";
import { expandTeamPerspectiveHistory, teamHistoryFor } from "@/lib/debug/calibration/pe4-as-of-t-features/team-perspective";
import {
  materializePe4I19StrengthCatalogue,
  PE4I19_PRODUCTION_WIRING,
} from "@/lib/debug/calibration/pe4-as-of-t-features/strength-catalogue";
import { joinOpponentStrengthFromPe4I19Catalogue } from "@/lib/debug/calibration/pe4-as-of-t-features/opponent-strength-join";

function row(input: {
  id: string;
  kickoff: string;
  home: string;
  away: string;
  hg?: number;
  ag?: number;
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
    home: { goals: { presence: "present", value: input.hg ?? 1 } },
    away: { goals: { presence: "present", value: input.ag ?? 0 } },
    provenance: { cacheKey: `fixture=${input.id}`, envelopeDigest: `digest-${input.id}` },
  });
  if (!built.ok) throw new Error(built.reason);
  return built.value;
}

const baseRows = () => [
  row({ id: "m1", kickoff: "2024-01-01T12:00:00.000Z", home: "A", away: "B" }),
  row({ id: "same", kickoff: "2024-01-08T12:00:00.000Z", home: "B", away: "D" }),
  row({ id: "m2", kickoff: "2024-01-08T12:00:00.000Z", home: "C", away: "A" }),
  row({ id: "m3", kickoff: "2024-01-15T12:00:00.000Z", home: "A", away: "C" }),
  row({ id: "m4", kickoff: "2024-01-22T12:00:00.000Z", home: "A", away: "D" }),
];

describe("PE-4I.19 common-baseline strength catalogue", () => {
  it("uses the shared 1580 baseline for away teams, not venue-specific 1520", () => {
    const rows = baseRows();
    const catalogue = materializePe4I19StrengthCatalogue(rows);
    const m2 = catalogue.rows.find((candidate) => candidate.fixtureId === "m2")!;
    expect(m2.away.reconstructionBase).toBe(PRODUCTION_HOME_ELO_BASE);
    expect(m2.away.comparableToVenueSpecificC0Elo).toBe(false);

    const venueSpecific = resolvePrematchStrengthFromUniverse({
      target: {
        fixtureId: "m2",
        kickoffUtc: m2.kickoffUtc,
        homeTeamId: "C",
        awayTeamId: "A",
        competitionId: "league",
        season: "2024",
      },
      universe: rows.map((candidate) => ({
        fixtureId: candidate.fixtureId,
        kickoffUtc: candidate.kickoffUtc,
        homeTeamId: candidate.homeTeamId,
        awayTeamId: candidate.awayTeamId,
        competitionId: candidate.competition,
        season: candidate.providerSeason,
        status: candidate.status,
        homeGoals: candidate.home.goals.value,
        awayGoals: candidate.away.goals.value,
      })),
    });
    expect(venueSpecific.away.base).toBe(PRODUCTION_AWAY_ELO_BASE);
    expect(m2.away.strengthAsOfKickoffM - venueSpecific.awayElo).toBe(60);
  });

  it("excludes same-kickoff evidence and records strict pre-M provenance", () => {
    const catalogue = materializePe4I19StrengthCatalogue(baseRows());
    const m2 = catalogue.rows.find((candidate) => candidate.fixtureId === "m2")!;
    expect(m2.away.played).toBe(1);
    expect(m2.evidenceUniverseFixtureIds).toEqual(["m1"]);
    expect(m2.historicalCutoffUtc).toBe(m2.kickoffUtc);
  });

  it("excludes calendar-2025 and provider-season-2025 targets", () => {
    const catalogue = materializePe4I19StrengthCatalogue([
      ...baseRows(),
      row({ id: "calendar", kickoff: "2025-02-01T12:00:00.000Z", home: "A", away: "B", season: "2024" }),
      row({ id: "season", kickoff: "2024-02-01T12:00:00.000Z", home: "A", away: "B", season: "2025" }),
    ]);
    expect(catalogue.rows.some((candidate) => candidate.fixtureId === "calendar")).toBe(false);
    expect(catalogue.rows.some((candidate) => candidate.fixtureId === "season")).toBe(false);
    expect(catalogue.excludedHoldoutCounts.calendar_2025_sealed_outcome).toBe(1);
    expect(catalogue.excludedHoldoutCounts.provider_season_2025_forbidden).toBe(1);
  });

  it("collapses identical duplicates and fails closed on conflicting duplicates", () => {
    const first = baseRows()[0]!;
    const identical = materializePe4I19StrengthCatalogue([first, first]);
    expect(identical.identicalDuplicateFixtureCount).toBe(1);
    expect(() =>
      materializePe4I19StrengthCatalogue([
        first,
        row({ id: "m1", kickoff: first.kickoffUtc, home: "A", away: "B", hg: 9 }),
      ]),
    ).toThrow(/conflicting duplicate fixture/);
  });

  it("has deterministic ordering and digest under shuffled input", () => {
    const rows = baseRows();
    const a = materializePe4I19StrengthCatalogue(rows);
    const b = materializePe4I19StrengthCatalogue([...rows].reverse());
    expect(a.digest).toBe(b.digest);
    expect(a.rows.map((candidate) => candidate.fixtureId)).toEqual(
      b.rows.map((candidate) => candidate.fixtureId),
    );
  });

  it("keeps AET/PEN evidence explicit rather than silently treating ambiguity as absent", () => {
    const rows = [
      row({ id: "aet", kickoff: "2024-01-01T12:00:00.000Z", home: "A", away: "B", status: "AET" }),
      row({ id: "later", kickoff: "2024-01-08T12:00:00.000Z", home: "A", away: "C" }),
    ];
    const catalogue = materializePe4I19StrengthCatalogue(rows);
    expect(catalogue.targetRegulationAmbiguityCount).toBe(1);
    expect(catalogue.rows.find((candidate) => candidate.fixtureId === "later")?.priorRegulationAmbiguityCandidateCount).toBe(1);
  });

  it("fails closed for partial joins and fewer than three complete observations", () => {
    const rows = baseRows();
    const catalogue = materializePe4I19StrengthCatalogue(rows);
    const history = teamHistoryFor(expandTeamPerspectiveHistory(rows), "A").slice(0, 3);
    const insufficient = joinOpponentStrengthFromPe4I19Catalogue({
      selectedHistory: history.slice(0, 2),
      targetKickoffUtc: "2024-02-01T12:00:00.000Z",
      catalogue,
    });
    expect(insufficient.status).toBe("UNAVAILABLE");
    if (insufficient.status === "UNAVAILABLE") {
      expect(insufficient.reason).toBe("insufficient_strength_join_observations");
    }

    catalogue.strengthByTeamAndKickoffM.delete(`${history[0]!.opponentTeamId}\0${history[0]!.kickoffUtc}`);
    const partial = joinOpponentStrengthFromPe4I19Catalogue({
      selectedHistory: history,
      targetKickoffUtc: "2024-02-01T12:00:00.000Z",
      catalogue,
    });
    expect(partial.status).toBe("UNAVAILABLE");
    if (partial.status === "UNAVAILABLE") {
      expect(partial.reason).toBe("incomplete_strength_join_coverage");
    }
    expect(partial.audit.missingCount).toBe(1);
  });

  it("activates only a complete join with the declared minimum observations", () => {
    const rows = baseRows();
    const catalogue = materializePe4I19StrengthCatalogue(rows);
    const history = teamHistoryFor(expandTeamPerspectiveHistory(rows), "A").slice(0, 3);
    const joined = joinOpponentStrengthFromPe4I19Catalogue({
      selectedHistory: history,
      targetKickoffUtc: "2024-02-01T12:00:00.000Z",
      catalogue,
    });
    expect(joined.status).toBe("AVAILABLE");
    expect(joined.audit).toMatchObject({ complete: true, matchedCount: 3, missingCount: 0 });
  });

  it("remains research-only and leaves frozen production activation off", () => {
    expect(PE4I19_PRODUCTION_WIRING).toBe(false);
    expect(PE3C_C0_RECON_ACTIVATION).toBe(false);
    expect(PRODUCTION_HOME_ELO_BASE).toBe(1580);
    expect(PRODUCTION_AWAY_ELO_BASE).toBe(1520);
  });
});
