/**
 * PE-4I.3 — Offline tests for live auth / smoke selection (no HTTP).
 */

import { describe, expect, it } from "vitest";
import {
  Pe4I2LiveAuthError,
  assertPe4I2LiveAuthorized,
  isPe4I2LiveAuthorized,
} from "@/lib/debug/calibration/pe4-acquisition/live-auth";
import {
  selectPe4I3SmokeTeamId,
  selectPe4I3StatisticsFixture,
} from "@/lib/debug/calibration/pe4-acquisition/smoke";
import { PE4I2_PL_TEAMS_2024 } from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { scheduleIdentityDigest } from "@/lib/debug/calibration/pe4-acquisition/dedupe";
import type { Pe4I2RawScheduleEnvelope } from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import {
  PE4I2_ACQUISITION_VERSION,
  PE4I2_PROVIDER,
  PE4I2_SCHEMA_VERSION,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";

describe("PE-4I.3 live auth", () => {
  it("requires both live flags and positive max-calls", () => {
    expect(isPe4I2LiveAuthorized([])).toBe(false);
    expect(
      isPe4I2LiveAuthorized(["--execute-live", "--max-calls", "3"]),
    ).toBe(false);
    expect(
      isPe4I2LiveAuthorized([
        "--execute-live",
        "--confirm-provider-calls",
        "--max-calls",
        "0",
      ]),
    ).toBe(false);
    expect(() =>
      assertPe4I2LiveAuthorized([
        "--execute-live",
        "--confirm-provider-calls",
        "--max-calls",
        "3",
      ]),
    ).not.toThrow();
    expect(() => assertPe4I2LiveAuthorized(["--execute-live"])).toThrow(
      Pe4I2LiveAuthError,
    );
  });

  it("selects lowest 2024 roster team id", () => {
    const expected = [...PE4I2_PL_TEAMS_2024].sort(
      (a, b) => Number(a) - Number(b),
    )[0];
    expect(selectPe4I3SmokeTeamId()).toBe(expected);
    expect(selectPe4I3SmokeTeamId()).toBe("33");
  });

  it("selects earliest PL FT for statistics", () => {
    const mk = (
      id: string,
      kickoff: string,
      status: string,
      comp: string,
      cls: "target_domestic_league" | "unknown_competition",
    ) => ({
      providerFixtureId: id,
      providerCompetitionId: comp,
      providerCompetitionName: comp === "39" ? "Premier League" : "Other",
      competitionClass: cls,
      kickoffUtc: kickoff,
      status,
      homeTeamId: "33",
      awayTeamId: "40",
      homeTeamName: "A",
      awayTeamName: "B",
      homeGoals: 1,
      awayGoals: 0,
      identityDigest: scheduleIdentityDigest({
        providerFixtureId: id,
        kickoffUtc: kickoff,
        homeTeamId: "33",
        awayTeamId: "40",
        providerCompetitionId: comp,
        status,
        homeGoals: 1,
        awayGoals: 0,
      }),
    });
    const envelope: Pe4I2RawScheduleEnvelope = {
      schemaVersion: PE4I2_SCHEMA_VERSION,
      acquisitionVersion: PE4I2_ACQUISITION_VERSION,
      evidenceKind: "team_season_schedule",
      acquiredAtUtc: "2026-01-01T00:00:00.000Z",
      provider: PE4I2_PROVIDER,
      providerTeamId: "33",
      requestedSeason: "2024",
      providerEnvelopeComplete: true,
      pagingCurrent: 1,
      pagingTotal: 1,
      resultsCount: 3,
      fixtures: [
        mk("2", "2024-08-20T00:00:00.000Z", "FT", "39", "target_domestic_league"),
        mk("1", "2024-08-10T00:00:00.000Z", "FT", "39", "target_domestic_league"),
        mk("9", "2024-08-05T00:00:00.000Z", "NS", "39", "target_domestic_league"),
      ],
      contentDigest: "x",
    };
    const pick = selectPe4I3StatisticsFixture(envelope);
    expect(pick?.providerFixtureId).toBe("1");
  });
});
