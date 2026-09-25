/**
 * PE-4I.3 — Controlled live smoke orchestration (maxCalls-bounded).
 */

import path from "node:path";
import {
  acquireScheduleUnit,
  acquireStatisticsUnit,
} from "@/lib/debug/calibration/pe4-acquisition/acquire-unit";
import { createPe4I2CallBudget } from "@/lib/debug/calibration/pe4-acquisition/budget";
import {
  createPe4I2AcquisitionCache,
  type Pe4I2AcquisitionCache,
} from "@/lib/debug/calibration/pe4-acquisition/cache";
import { classifyPe4I2Competition } from "@/lib/debug/calibration/pe4-acquisition/competition-registry";
import type {
  Pe4I2RawScheduleEnvelope,
  Pe4I2RawScheduleFixtureRow,
  Pe4I2RawStatisticsEnvelope,
} from "@/lib/debug/calibration/pe4-acquisition/envelopes";
import {
  PE4I2_CACHE_ROOT_RELATIVE,
  PE4I2_PL_TEAMS_2024,
  assertSeasonAllowed,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { inventoryStatisticsFields } from "@/lib/debug/calibration/pe4-acquisition/statistics-discovery";
import { isCompletedPrematchEvidenceStatus } from "@/lib/match-center/prematch-strength/completed-status";
import type { Pe4I2ProviderTransport } from "@/lib/debug/calibration/pe4-acquisition/transport";

export const PE4I3_SMOKE_SEASON = "2024" as const;
export const PE4I3_SMOKE_MAX_CALLS = 3 as const;

/** Deterministic: lowest providerTeamId in frozen 2024 PL roster. */
export function selectPe4I3SmokeTeamId(): string {
  const sorted = [...PE4I2_PL_TEAMS_2024].sort((a, b) => Number(a) - Number(b));
  const id = sorted[0];
  if (!id) throw new Error("2024 PL roster empty");
  return id;
}

export type Pe4I3SelectedStatsFixture = {
  providerFixtureId: string;
  competitionId: string | null;
  competitionName: string | null;
  competitionClass: string;
  kickoffUtc: string;
  status: string;
};

/**
 * Earliest eligible completed fixture; prefer PL FT, then any FT, then other completed.
 * Tie-break: kickoffUtc, then fixtureId.
 */
export function selectPe4I3StatisticsFixture(
  envelope: Pe4I2RawScheduleEnvelope,
): Pe4I3SelectedStatsFixture | null {
  const eligible = envelope.fixtures.filter((f) =>
    isCompletedPrematchEvidenceStatus(f.status),
  );
  const rank = (f: Pe4I2RawScheduleFixtureRow): number => {
    const pl = f.competitionClass === "target_domestic_league";
    const ft = f.status.trim().toUpperCase() === "FT";
    if (pl && ft) return 0;
    if (ft) return 1;
    if (pl) return 2;
    return 3;
  };
  const sorted = [...eligible].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    return a.providerFixtureId.localeCompare(b.providerFixtureId);
  });
  const pick = sorted[0];
  if (!pick) return null;
  return {
    providerFixtureId: pick.providerFixtureId,
    competitionId: pick.providerCompetitionId,
    competitionName: pick.providerCompetitionName,
    competitionClass: pick.competitionClass,
    kickoffUtc: pick.kickoffUtc,
    status: pick.status,
  };
}

function competitionSummary(envelope: Pe4I2RawScheduleEnvelope) {
  const map = new Map<
    string,
    {
      providerCompetitionId: string | null;
      providerCompetitionName: string | null;
      competitionClass: string;
      fixtureCount: number;
    }
  >();
  for (const f of envelope.fixtures) {
    const key = `${f.providerCompetitionId ?? ""}|${f.providerCompetitionName ?? ""}`;
    const cur = map.get(key);
    if (cur) cur.fixtureCount += 1;
    else {
      const cl = classifyPe4I2Competition({
        providerCompetitionId: f.providerCompetitionId,
        providerCompetitionName: f.providerCompetitionName,
      });
      map.set(key, {
        providerCompetitionId: f.providerCompetitionId,
        providerCompetitionName: f.providerCompetitionName,
        competitionClass: cl.competitionClass,
        fixtureCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    String(a.providerCompetitionId).localeCompare(
      String(b.providerCompetitionId),
    ),
  );
}

function fieldPresenceStatus(
  inventory: ReturnType<typeof inventoryStatisticsFields>["inventory"],
  candidates: readonly string[],
): "PRESENT" | "MISSING" | "PARTIAL" {
  const hits = inventory.filter((row) =>
    candidates.some((c) => c.toLowerCase() === row.rawName.toLowerCase()),
  );
  if (hits.length === 0) return "MISSING";
  const anyPresent = hits.some((h) => h.teamSideCount > h.missingCount);
  const anyMissing = hits.some((h) => h.missingCount > 0);
  if (anyPresent && !anyMissing) return "PRESENT";
  if (anyPresent && anyMissing) return "PARTIAL";
  return "MISSING";
}

export type Pe4I3SmokeReport = {
  selectedTeamId: string;
  selectedTeamName: string | null;
  selectedSeason: typeof PE4I3_SMOKE_SEASON;
  maxCalls: number;
  firstPass: {
    scheduleOk: boolean;
    statisticsOk: boolean;
    providerCalls: number;
    budget: ReturnType<ReturnType<typeof createPe4I2CallBudget>["snapshot"]>;
  };
  secondPass: {
    providerCalls: number;
    cacheHits: number;
    budget: ReturnType<ReturnType<typeof createPe4I2CallBudget>["snapshot"]>;
  };
  schedule: null | {
    fixturesReturned: number;
    uniqueFixtures: number;
    competitions: Array<{
      providerCompetitionId: string | null;
      providerCompetitionName: string | null;
      competitionClass: string;
      fixtureCount: number;
    }>;
    statuses: Record<string, number>;
    kickoffMin: string | null;
    kickoffMax: string | null;
    crossCompetitionHistoryConfirmed: boolean;
    contentDigest: string;
  };
  selectedStatisticsFixture: Pe4I3SelectedStatsFixture | null;
  statistics: null | {
    contentDigest: string;
    vendorXgFieldObserved: boolean;
    inventory: ReturnType<typeof inventoryStatisticsFields>["inventory"];
    xgStatus:
      | "OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE"
      | "NOT_OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE";
    xgRawField: string | null;
    xgSampleValues: Array<{ teamId: string; rawValue: string | number | null }>;
    fieldStatus: Record<string, "PRESENT" | "MISSING" | "PARTIAL">;
  };
  holdout2025Status: "SEALED";
  errors: string[];
};

export async function runPe4I3ControlledLiveSmoke(input: {
  transport: Pe4I2ProviderTransport;
  maxCalls?: number;
  cache?: Pe4I2AcquisitionCache;
  teamId?: string;
  acquiredAtUtc?: string;
}): Promise<Pe4I3SmokeReport> {
  assertSeasonAllowed(PE4I3_SMOKE_SEASON);
  const maxCalls = input.maxCalls ?? PE4I3_SMOKE_MAX_CALLS;
  if (maxCalls > PE4I3_SMOKE_MAX_CALLS) {
    throw new Error(
      `PE-4I.3 smoke maxCalls must be <= ${PE4I3_SMOKE_MAX_CALLS}`,
    );
  }
  const teamId = input.teamId ?? selectPe4I3SmokeTeamId();
  const cache =
    input.cache ??
    createPe4I2AcquisitionCache(
      path.join(process.cwd(), PE4I2_CACHE_ROOT_RELATIVE, "smoke-i3"),
    );
  const acquiredAtUtc = input.acquiredAtUtc ?? new Date().toISOString();
  const errors: string[] = [];

  const budget1 = createPe4I2CallBudget(maxCalls);
  const scheduleRes = await acquireScheduleUnit({
    transport: input.transport,
    budget: budget1,
    cache,
    providerTeamId: teamId,
    season: PE4I3_SMOKE_SEASON,
    acquiredAtUtc,
  });

  let scheduleSummary: Pe4I3SmokeReport["schedule"] = null;
  let selectedStats: Pe4I3SelectedStatsFixture | null = null;
  let statsSummary: Pe4I3SmokeReport["statistics"] = null;
  let statisticsOk = false;
  let selectedTeamName: string | null = null;

  if (!scheduleRes.ok) {
    errors.push(`schedule: ${scheduleRes.reason}: ${scheduleRes.message}`);
  } else {
    const raw = cache.readRawJson(scheduleRes.unitKey) as {
      payload: Pe4I2RawScheduleEnvelope;
    } | null;
    const envelope = raw?.payload;
    if (!envelope) {
      errors.push("schedule cache payload missing after acquire");
    } else {
      for (const f of envelope.fixtures) {
        if (f.homeTeamId === teamId && f.homeTeamName) {
          selectedTeamName = f.homeTeamName;
          break;
        }
        if (f.awayTeamId === teamId && f.awayTeamName) {
          selectedTeamName = f.awayTeamName;
          break;
        }
      }
      const statuses: Record<string, number> = {};
      for (const f of envelope.fixtures) {
        statuses[f.status] = (statuses[f.status] ?? 0) + 1;
      }
      const kickoffs = envelope.fixtures.map((f) => f.kickoffUtc).sort();
      const comps = competitionSummary(envelope);
      scheduleSummary = {
        fixturesReturned: envelope.fixtures.length,
        uniqueFixtures: envelope.fixtures.length,
        competitions: comps,
        statuses,
        kickoffMin: kickoffs[0] ?? null,
        kickoffMax: kickoffs[kickoffs.length - 1] ?? null,
        crossCompetitionHistoryConfirmed: comps.some(
          (c) =>
            c.providerCompetitionId != null &&
            c.providerCompetitionId !== "39",
        ),
        contentDigest: envelope.contentDigest,
      };
      selectedStats = selectPe4I3StatisticsFixture(envelope);
      if (!selectedStats) {
        errors.push("no eligible completed fixture for statistics");
      } else {
        const statsRes = await acquireStatisticsUnit({
          transport: input.transport,
          budget: budget1,
          cache,
          providerFixtureId: selectedStats.providerFixtureId,
          acquiredAtUtc,
        });
        if (!statsRes.ok) {
          errors.push(`statistics: ${statsRes.reason}: ${statsRes.message}`);
        } else {
          statisticsOk = true;
          const sraw = cache.readRawJson(statsRes.unitKey) as {
            payload: Pe4I2RawStatisticsEnvelope;
          } | null;
          const senvelope = sraw?.payload;
          if (!senvelope) {
            errors.push("statistics cache payload missing after acquire");
          } else {
            const discovery = inventoryStatisticsFields([
              {
                providerFixtureId: senvelope.providerFixtureId,
                teamBlocks: senvelope.teams,
              },
            ]);
            const xgRows = senvelope.teams.flatMap((t) =>
              t.statistics
                .filter((s) => {
                  const n = s.rawName.toLowerCase();
                  return (
                    n === "expected_goals" ||
                    n === "expected goals" ||
                    n === "xg"
                  );
                })
                .map((s) => ({
                  teamId: t.providerTeamId,
                  rawValue: s.rawValue,
                  rawName: s.rawName,
                  present: s.valuePresence === "present",
                })),
            );
            const xgPresent = xgRows.filter((r) => r.present);
            statsSummary = {
              contentDigest: senvelope.contentDigest,
              vendorXgFieldObserved: senvelope.vendorXgFieldObserved,
              inventory: discovery.inventory,
              xgStatus:
                xgPresent.length > 0
                  ? "OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE"
                  : "NOT_OBSERVED_IN_CONTROLLED_PROVIDER_SAMPLE",
              xgRawField: xgPresent[0]?.rawName ?? null,
              xgSampleValues: xgPresent.map((r) => ({
                teamId: r.teamId,
                rawValue: r.rawValue,
              })),
              fieldStatus: {
                shots: fieldPresenceStatus(discovery.inventory, [
                  "Total Shots",
                  "Shots",
                ]),
                shots_on_target: fieldPresenceStatus(discovery.inventory, [
                  "Shots on Goal",
                  "Shots on Target",
                ]),
                possession: fieldPresenceStatus(discovery.inventory, [
                  "Ball Possession",
                  "Possession",
                ]),
                corners: fieldPresenceStatus(discovery.inventory, [
                  "Corner Kicks",
                  "Corners",
                ]),
                cards: fieldPresenceStatus(discovery.inventory, [
                  "Yellow Cards",
                  "Red Cards",
                ]),
                xg:
                  xgPresent.length > 0
                    ? "PRESENT"
                    : xgRows.length > 0
                      ? "PARTIAL"
                      : "MISSING",
              },
            };
          }
        }
      }
    }
  }

  const firstPassCalls = budget1.snapshot().attempted;

  const budget2 = createPe4I2CallBudget(maxCalls);
  await acquireScheduleUnit({
    transport: input.transport,
    budget: budget2,
    cache,
    providerTeamId: teamId,
    season: PE4I3_SMOKE_SEASON,
    acquiredAtUtc,
  });
  if (selectedStats) {
    await acquireStatisticsUnit({
      transport: input.transport,
      budget: budget2,
      cache,
      providerFixtureId: selectedStats.providerFixtureId,
      acquiredAtUtc,
    });
  }

  return {
    selectedTeamId: teamId,
    selectedTeamName,
    selectedSeason: PE4I3_SMOKE_SEASON,
    maxCalls,
    firstPass: {
      scheduleOk: scheduleRes.ok,
      statisticsOk,
      providerCalls: firstPassCalls,
      budget: budget1.snapshot(),
    },
    secondPass: {
      providerCalls: budget2.snapshot().attempted,
      cacheHits: budget2.snapshot().cacheHits,
      budget: budget2.snapshot(),
    },
    schedule: scheduleSummary,
    selectedStatisticsFixture: selectedStats,
    statistics: statsSummary,
    holdout2025Status: "SEALED",
    errors,
  };
}
