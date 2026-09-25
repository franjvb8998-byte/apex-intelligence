/**
 * PE-4I.6 — Field / xG coverage measurement for a statistics batch.
 *
 * XG classification thresholds (declared BEFORE inspecting live results):
 * - XG_COVERAGE_HIGH:     both-team xG fixtures / batch successes >= 0.90
 * - XG_COVERAGE_PARTIAL:  >= 0.50 and < 0.90
 * - XG_COVERAGE_LOW:      >= 0.10 and < 0.50
 * - XG_COVERAGE_UNUSABLE: < 0.10
 */

import type { Pe4I2RawStatisticsEnvelope } from "@/lib/debug/calibration/pe4-acquisition/envelopes";

export const PE4I6_XG_COVERAGE_THRESHOLDS = {
  highMinInclusive: 0.9,
  partialMinInclusive: 0.5,
  lowMinInclusive: 0.1,
} as const;

export type Pe4I6XgClassification =
  | "XG_COVERAGE_HIGH"
  | "XG_COVERAGE_PARTIAL"
  | "XG_COVERAGE_LOW"
  | "XG_COVERAGE_UNUSABLE";

export function classifyXgCoverage(bothTeamShare: number): Pe4I6XgClassification {
  if (bothTeamShare >= PE4I6_XG_COVERAGE_THRESHOLDS.highMinInclusive) {
    return "XG_COVERAGE_HIGH";
  }
  if (bothTeamShare >= PE4I6_XG_COVERAGE_THRESHOLDS.partialMinInclusive) {
    return "XG_COVERAGE_PARTIAL";
  }
  if (bothTeamShare >= PE4I6_XG_COVERAGE_THRESHOLDS.lowMinInclusive) {
    return "XG_COVERAGE_LOW";
  }
  return "XG_COVERAGE_UNUSABLE";
}

/** Canonical batch fields from PE-4I.6 contract (team-side observations). */
export const PE4I6_CANONICAL_BATCH_FIELDS = [
  "goals",
  "expected_goals",
  "total_shots",
  "shots_on_goal",
  "ball_possession",
  "corner_kicks",
  "yellow_cards",
  "red_cards",
] as const;

/**
 * PE-4I.7 statistics coverage fields.
 * Goals remain fixture-evidence sourced — not classified as stats-endpoint loss.
 */
export const PE4I7_CANONICAL_STATS_FIELDS = [
  "expected_goals",
  "total_shots",
  "shots_on_goal",
  "ball_possession",
  "corner_kicks",
  "yellow_cards",
  "red_cards",
] as const;

export type Pe4I6CanonicalBatchField =
  (typeof PE4I6_CANONICAL_BATCH_FIELDS)[number];

const FIELD_NAME_CANDIDATES: Readonly<
  Record<Pe4I6CanonicalBatchField, readonly string[]>
> = {
  goals: ["goals", "goal"],
  expected_goals: ["expected_goals", "expected goals", "xg"],
  total_shots: ["total shots", "shots"],
  shots_on_goal: ["shots on goal", "shots on target"],
  ball_possession: ["ball possession", "possession"],
  corner_kicks: ["corner kicks", "corners"],
  yellow_cards: ["yellow cards"],
  red_cards: ["red cards"],
};

function matchesField(
  rawName: string,
  field: Pe4I6CanonicalBatchField,
): boolean {
  const lower = rawName.trim().toLowerCase();
  return FIELD_NAME_CANDIDATES[field].some((c) => c === lower);
}

export type Pe4I6FieldCoverageRow = {
  field: Pe4I6CanonicalBatchField;
  fixtureCount: number;
  teamSideObservationCount: number;
  presentCount: number;
  missingCount: number;
  parseableNumericCount: number;
  malformedNonNumericCount: number;
  coveragePercentAmongExpectedTeamSides: number | null;
};

export type Pe4I6RawFieldInventoryRow = {
  rawName: string;
  fixtureCountContaining: number;
  teamSideCount: number;
  presentCount: number;
  missingCount: number;
  parseableNumericCount: number;
};

export type Pe4I6XgFixtureBreakdown = {
  fixturesWithBothTeams: number;
  fixturesOneTeamOnly: number;
  fixturesWithoutXg: number;
  teamSidePresent: number;
  teamSideMissing: number;
  parseableNumeric: number;
  coveragePercent: number | null;
  byCompetition: Record<
    string,
    {
      fixtures: number;
      bothTeams: number;
      oneTeam: number;
      none: number;
    }
  >;
  byProviderSeason: Record<
    string,
    {
      fixtures: number;
      bothTeams: number;
      oneTeam: number;
      none: number;
    }
  >;
  byCalendarYear: Record<
    string,
    {
      fixtures: number;
      bothTeams: number;
      oneTeam: number;
      none: number;
    }
  >;
  classification: Pe4I6XgClassification;
};

export type Pe4I6FixtureMeta = {
  providerFixtureId: string;
  providerCompetitionId: string | null;
  providerCompetitionName: string | null;
  status: string;
  kickoffUtc: string;
  providerSeason: string | null;
  calendarKickoffYear: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
};

function findStatRows(
  envelope: Pe4I2RawStatisticsEnvelope,
  field: Pe4I6CanonicalBatchField,
) {
  const out: Array<{
    present: boolean;
    parseable: boolean;
    malformedPresent: boolean;
  }> = [];
  for (const team of envelope.teams) {
    const hit = team.statistics.find((s) => matchesField(s.rawName, field));
    if (!hit) {
      out.push({ present: false, parseable: false, malformedPresent: false });
      continue;
    }
    const present = hit.valuePresence === "present";
    const parseable = present && hit.parseableNumeric;
    const malformedPresent = present && !hit.parseableNumeric;
    out.push({ present, parseable, malformedPresent });
  }
  return out;
}

export function measureFieldCoverage(
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
  fields: readonly Pe4I6CanonicalBatchField[] = PE4I6_CANONICAL_BATCH_FIELDS,
): Pe4I6FieldCoverageRow[] {
  return fields.map((field) => {
    let fixtureCount = 0;
    let teamSideObservationCount = 0;
    let presentCount = 0;
    let missingCount = 0;
    let parseableNumericCount = 0;
    let malformedNonNumericCount = 0;
    for (const env of envelopes) {
      // Expected team sides = envelope team blocks (typically 2).
      const expectedSides = Math.max(env.teams.length, 2);
      teamSideObservationCount += expectedSides;
      const rows = findStatRows(env, field);
      // Pad to expectedSides if provider returned fewer team blocks.
      while (rows.length < expectedSides) {
        rows.push({
          present: false,
          parseable: false,
          malformedPresent: false,
        });
      }
      let any = false;
      for (let i = 0; i < expectedSides; i++) {
        const r = rows[i]!;
        if (r.present) {
          presentCount += 1;
          any = true;
          if (r.parseable) parseableNumericCount += 1;
          if (r.malformedPresent) malformedNonNumericCount += 1;
        } else {
          missingCount += 1;
        }
      }
      if (any) fixtureCount += 1;
    }
    const coverage =
      teamSideObservationCount === 0
        ? null
        : (presentCount / teamSideObservationCount) * 100;
    return {
      field,
      fixtureCount,
      teamSideObservationCount,
      presentCount,
      missingCount,
      parseableNumericCount,
      malformedNonNumericCount,
      coveragePercentAmongExpectedTeamSides:
        coverage == null ? null : Math.round(coverage * 1000) / 1000,
    };
  });
}

export function inventoryRawFields(
  envelopes: readonly Pe4I2RawStatisticsEnvelope[],
): Pe4I6RawFieldInventoryRow[] {
  const map = new Map<
    string,
    {
      fixtures: Set<string>;
      teamSide: number;
      present: number;
      missing: number;
      parseable: number;
    }
  >();
  for (const env of envelopes) {
    for (const team of env.teams) {
      for (const row of team.statistics) {
        let acc = map.get(row.rawName);
        if (!acc) {
          acc = {
            fixtures: new Set(),
            teamSide: 0,
            present: 0,
            missing: 0,
            parseable: 0,
          };
          map.set(row.rawName, acc);
        }
        acc.fixtures.add(env.providerFixtureId);
        acc.teamSide += 1;
        if (row.valuePresence === "present") {
          acc.present += 1;
          if (row.parseableNumeric) acc.parseable += 1;
        } else {
          acc.missing += 1;
        }
      }
    }
  }
  return [...map.entries()]
    .map(([rawName, acc]) => ({
      rawName,
      fixtureCountContaining: acc.fixtures.size,
      teamSideCount: acc.teamSide,
      presentCount: acc.present,
      missingCount: acc.missing,
      parseableNumericCount: acc.parseable,
    }))
    .sort((a, b) => a.rawName.localeCompare(b.rawName));
}

function xgSides(envelope: Pe4I2RawStatisticsEnvelope): {
  presentSides: number;
  missingSides: number;
  parseable: number;
} {
  const expected = Math.max(envelope.teams.length, 2);
  let presentSides = 0;
  let parseable = 0;
  for (const team of envelope.teams) {
    const hit = team.statistics.find((s) =>
      matchesField(s.rawName, "expected_goals"),
    );
    if (hit && hit.valuePresence === "present") {
      presentSides += 1;
      if (hit.parseableNumeric) parseable += 1;
    }
  }
  const missingSides = Math.max(0, expected - presentSides);
  return { presentSides, missingSides, parseable };
}

export function measureXgCoverage(input: {
  envelopes: readonly Pe4I2RawStatisticsEnvelope[];
  metaByFixtureId: ReadonlyMap<string, Pe4I6FixtureMeta>;
}): Pe4I6XgFixtureBreakdown {
  let both = 0;
  let one = 0;
  let none = 0;
  let teamPresent = 0;
  let teamMissing = 0;
  let parseable = 0;
  const byCompetition: Pe4I6XgFixtureBreakdown["byCompetition"] = {};
  const byProviderSeason: Pe4I6XgFixtureBreakdown["byProviderSeason"] = {};
  const byCalendarYear: Pe4I6XgFixtureBreakdown["byCalendarYear"] = {};

  const bump = (
    map: Record<
      string,
      { fixtures: number; bothTeams: number; oneTeam: number; none: number }
    >,
    key: string,
    kind: "both" | "one" | "none",
  ) => {
    if (!map[key]) {
      map[key] = { fixtures: 0, bothTeams: 0, oneTeam: 0, none: 0 };
    }
    map[key]!.fixtures += 1;
    if (kind === "both") map[key]!.bothTeams += 1;
    else if (kind === "one") map[key]!.oneTeam += 1;
    else map[key]!.none += 1;
  };

  for (const env of input.envelopes) {
    const sides = xgSides(env);
    teamPresent += sides.presentSides;
    teamMissing += sides.missingSides;
    parseable += sides.parseable;
    let kind: "both" | "one" | "none";
    if (sides.presentSides >= 2) {
      both += 1;
      kind = "both";
    } else if (sides.presentSides === 1) {
      one += 1;
      kind = "one";
    } else {
      none += 1;
      kind = "none";
    }
    const meta = input.metaByFixtureId.get(env.providerFixtureId);
    const comp =
      meta?.providerCompetitionName ??
      meta?.providerCompetitionId ??
      "unknown";
    const season = meta?.providerSeason ?? "unknown";
    const calYear =
      meta?.calendarKickoffYear == null
        ? "unknown"
        : String(meta.calendarKickoffYear);
    bump(byCompetition, comp, kind);
    bump(byProviderSeason, season, kind);
    bump(byCalendarYear, calYear, kind);
  }

  const n = input.envelopes.length;
  const bothShare = n === 0 ? 0 : both / n;
  const coveragePercent =
    teamPresent + teamMissing === 0
      ? null
      : Math.round(
          (teamPresent / (teamPresent + teamMissing)) * 100000,
        ) / 1000;

  return {
    fixturesWithBothTeams: both,
    fixturesOneTeamOnly: one,
    fixturesWithoutXg: none,
    teamSidePresent: teamPresent,
    teamSideMissing: teamMissing,
    parseableNumeric: parseable,
    coveragePercent,
    byCompetition,
    byProviderSeason,
    byCalendarYear,
    classification: classifyXgCoverage(bothShare),
  };
}
