/**
 * Catalogue Elo maturity, same-team role effect, GD saturation, and match traces.
 */

import { distributionSummary } from "@/lib/debug/calibration/xg-5b9-geometry";
import type {
  MatchCatalogueTrace,
  SideObservation,
} from "@/lib/debug/calibration/cat-5b10-evaluate";
import { MATURITY_PLAYED_MARKS } from "@/lib/debug/calibration/cat-5b10-shape";

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type TeamAppearance = SideObservation;

function sortAppearances(sides: readonly SideObservation[]): SideObservation[] {
  return [...sides].sort((left, right) => {
    const kick = left.kickoff.localeCompare(right.kickoff);
    if (kick !== 0) return kick;
    return left.fixtureId.localeCompare(right.fixtureId);
  });
}

export type MaturityJumpRow = {
  playedBucket: string;
  n: number;
  medianAbsChange: number;
  p90AbsChange: number;
  maxAbsChange: number;
};

export type EloJumpCase = {
  season: string;
  teamId: string;
  teamName: string;
  fixtureId: string;
  kickoff: string;
  prevFixtureId: string;
  prevElo: number;
  elo: number;
  absChange: number;
  prevRole: "home" | "away";
  role: "home" | "away";
  prevPlayed: number;
  played: number;
  winRateDelta: number;
  gdContributionDelta: number;
  roleChanged: boolean;
  firstCatalogueObservation: boolean;
};

export type MaturityReport = {
  byLaterPlayed: MaturityJumpRow[];
  topJumps: EloJumpCase[];
};

export function maturityStability(sides: readonly SideObservation[]): MaturityReport {
  const byTeam = new Map<string, SideObservation[]>();
  for (const side of sides) {
    const key = `${side.season}|${side.teamId}`;
    const list = byTeam.get(key) ?? [];
    list.push(side);
    byTeam.set(key, list);
  }
  const jumps: EloJumpCase[] = [];
  const byPlayed = new Map<string, number[]>();
  for (const list of byTeam.values()) {
    const sorted = sortAppearances(list);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const absChange = Math.abs(curr.finalCatalogueElo - prev.finalCatalogueElo);
      const playedKey =
        curr.playedBefore >= 30 ? "30+" : String(curr.playedBefore);
      const bucket = byPlayed.get(playedKey) ?? [];
      bucket.push(absChange);
      byPlayed.set(playedKey, bucket);
      jumps.push({
        season: curr.season,
        teamId: curr.teamId,
        teamName: curr.teamName,
        fixtureId: curr.fixtureId,
        kickoff: curr.kickoff,
        prevFixtureId: prev.fixtureId,
        prevElo: prev.finalCatalogueElo,
        elo: curr.finalCatalogueElo,
        absChange,
        prevRole: prev.side,
        role: curr.side,
        prevPlayed: prev.playedBefore,
        played: curr.playedBefore,
        winRateDelta: curr.winRateContribution - prev.winRateContribution,
        gdContributionDelta: curr.gdContribution - prev.gdContribution,
        roleChanged: prev.side !== curr.side,
        firstCatalogueObservation: prev.playedBefore === 0 && curr.playedBefore > 0,
      });
    }
  }
  const byLaterPlayed: MaturityJumpRow[] = MATURITY_PLAYED_MARKS.map((mark) => {
    const key = mark >= 30 ? "30+" : String(mark);
    const values = byPlayed.get(key) ?? [];
    const summary = distributionSummary(values);
    return {
      playedBucket: key,
      n: values.length,
      medianAbsChange: summary.median,
      p90AbsChange: summary.p90,
      maxAbsChange: summary.max,
    };
  });
  const topJumps = [...jumps]
    .sort((left, right) => {
      const delta = right.absChange - left.absChange;
      if (delta !== 0) return delta;
      return left.fixtureId.localeCompare(right.fixtureId);
    })
    .slice(0, 20);
  return { byLaterPlayed, topJumps };
}

export type RoleEffectReport = {
  pairedN: number;
  meanHomeMinusAway: number;
  medianHomeMinusAway: number;
  expectedMechanicalShift: 60;
};

export function sameTeamRoleEffect(sides: readonly SideObservation[]): RoleEffectReport {
  const byTeam = new Map<string, SideObservation[]>();
  for (const side of sides) {
    const key = `${side.season}|${side.teamId}`;
    const list = byTeam.get(key) ?? [];
    list.push(side);
    byTeam.set(key, list);
  }
  const diffs: number[] = [];
  for (const list of byTeam.values()) {
    const homes = list.filter((side) => side.side === "home");
    const aways = list.filter((side) => side.side === "away");
    for (const home of homes) {
      const pair = aways.find(
        (away) => Math.abs(away.playedBefore - home.playedBefore) <= 1,
      );
      if (!pair) continue;
      diffs.push(home.finalCatalogueElo - pair.finalCatalogueElo);
    }
  }
  return {
    pairedN: diffs.length,
    meanHomeMinusAway: mean(diffs),
    medianHomeMinusAway: distributionSummary(diffs).median,
    expectedMechanicalShift: 60,
  };
}

export type GdSaturationExample = {
  season: string;
  teamId: string;
  teamName: string;
  firstClampKickoff: string;
  laterFixtures: number;
  clampedGd: number;
  gdContribution: number;
};

export function gdSaturationExamples(
  sides: readonly SideObservation[],
): GdSaturationExample[] {
  const byTeam = new Map<string, SideObservation[]>();
  for (const side of sides) {
    const key = `${side.season}|${side.teamId}`;
    const list = byTeam.get(key) ?? [];
    list.push(side);
    byTeam.set(key, list);
  }
  const out: GdSaturationExample[] = [];
  for (const list of byTeam.values()) {
    const sorted = sortAppearances(list);
    const first = sorted.find((side) => side.gdClampHit);
    if (!first) continue;
    const later = sorted.filter(
      (side) => side.kickoff > first.kickoff && side.gdClampHit && side.clampedGd === first.clampedGd,
    );
    if (later.length < 3) continue;
    out.push({
      season: first.season,
      teamId: first.teamId,
      teamName: first.teamName,
      firstClampKickoff: first.kickoff,
      laterFixtures: later.length,
      clampedGd: first.clampedGd,
      gdContribution: first.gdContribution,
    });
  }
  return out.sort((left, right) => right.laterFixtures - left.laterFixtures).slice(0, 12);
}

export type ExtremeMatchTrace = {
  label: string;
  fixtureId: string;
  kickoff: string;
  season: string;
  homeTeamName: string;
  awayTeamName: string;
  score: string;
  home: MatchCatalogueTrace["home"];
  away: MatchCatalogueTrace["away"];
  rawGap: number;
  rolePriorGap: number;
  winRateGap: number;
  gdGap: number;
  roundingGap: number;
  constantGap: number;
  lambdaHome: number;
  lambdaAway: number;
  lambdaRatio: number;
  poisson: MatchCatalogueTrace["poisson"];
  hybrid: MatchCatalogueTrace["hybrid"];
  actualOutcome: MatchCatalogueTrace["actualOutcome"];
};

const NAMED_TRACES = [
  { season: "2023", home: "Aston Villa", away: "Sheffield Utd", score: "1-1" },
  { season: "2024", home: "Chelsea", away: "Ipswich", score: "2-2" },
  { season: "2025", home: "Manchester City", away: "Nottingham Forest", score: "2-2" },
] as const;

export function extremeMatchTraces(
  matches: readonly MatchCatalogueTrace[],
): ExtremeMatchTrace[] {
  const named = NAMED_TRACES.flatMap((spec) => {
    const match = matches.find(
      (row) =>
        row.season === spec.season &&
        row.homeTeamName === spec.home &&
        row.awayTeamName === spec.away &&
        `${row.actualHomeGoals}-${row.actualAwayGoals}` === spec.score,
    );
    return match ? [toTrace(`${spec.season} ${spec.home} vs ${spec.away} ${spec.score}`, match)] : [];
  });
  const extras = [...matches]
    .sort((left, right) => {
      const delta = right.absGap - left.absGap;
      if (delta !== 0) return delta;
      return left.fixtureId.localeCompare(right.fixtureId);
    })
    .slice(0, 3)
    .map((match) => toTrace(`${match.season} largest |gap| ${match.homeTeamName} vs ${match.awayTeamName}`, match));
  const seen = new Set<string>();
  const out: ExtremeMatchTrace[] = [];
  for (const trace of [...named, ...extras]) {
    if (seen.has(trace.fixtureId)) continue;
    seen.add(trace.fixtureId);
    out.push(trace);
  }
  return out;
}

function toTrace(label: string, match: MatchCatalogueTrace): ExtremeMatchTrace {
  return {
    label,
    fixtureId: match.fixtureId,
    kickoff: match.kickoff,
    season: match.season,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    score: `${match.actualHomeGoals}-${match.actualAwayGoals}`,
    home: match.home,
    away: match.away,
    rawGap: match.rawGap,
    rolePriorGap: match.rolePriorGap,
    winRateGap: match.winRateGap,
    gdGap: match.gdGap,
    roundingGap: match.roundingGap,
    constantGap: match.constantGap,
    lambdaHome: match.lambdaHome,
    lambdaAway: match.lambdaAway,
    lambdaRatio: match.lambdaRatio,
    poisson: match.poisson,
    hybrid: match.hybrid,
    actualOutcome: match.actualOutcome,
  };
}
