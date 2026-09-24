/**
 * GOALS-1E — Descriptive opponent-quality audit (development 2023).
 */

import type { PrematchStrengthUniverseFixture } from "@/lib/match-center/prematch-strength/types";
import {
  createPe4HistoricalStrengthMemo,
} from "@/lib/prematch-decision/pe4-form-schedule/historical-strength";
import type {
  GoalsHistoricalFixture,
  GoalsTargetEvidence,
} from "@/lib/debug/calibration/goals/types";
import {
  computeEmpiricalOpponentCenter,
} from "@/lib/debug/calibration/goals/g3/adjustment";
import {
  listVenueRolePriorsWithOpponents,
} from "@/lib/debug/calibration/goals/g3/opponent-attach";
import {
  GOALS_G3_DEV_SEASON,
  GOALS_G3_OPPONENT_CENTERED_BINS,
  GOALS_G3_RECONSTRUCTION_BASE,
} from "@/lib/debug/calibration/goals/g3/protocol";
import { normalizeOpponentQuality } from "@/lib/debug/calibration/goals/g3/adjustment";

export function runOpponentQualityAudit(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  targetsById: Map<string, GoalsHistoricalFixture>;
  goalsUniverseBySeason: Map<string, GoalsHistoricalFixture[]>;
  strengthUniverseBySeason: Map<string, PrematchStrengthUniverseFixture[]>;
}): {
  reconstructionBase: typeof GOALS_G3_RECONSTRUCTION_BASE;
  empiricalCenter: number;
  catalogueN: number;
  sourceCounts: {
    catalogue: number;
    base_prior: number;
    unavailable: number;
  };
  playedBefore: { mean: number; p0: number; p50: number; p100: number };
  strengthDist: { mean: number; p0: number; p50: number; p100: number };
  descriptiveBins: {
    bin: string;
    n: number;
    meanGoalsFor: number;
    meanGoalsAgainst: number;
    meanGoalDiff: number;
    meanOpponentStrength: number;
  }[];
  note: string;
} {
  const memo = createPe4HistoricalStrengthMemo();
  const neutral = {
    attackAdjustmentFn: () => 1,
    defenseAdjustmentFn: () => 1,
  };

  const allContribs = [];
  for (const row of input.evidenceRows) {
    if (row.season !== GOALS_G3_DEV_SEASON) continue;
    const target = input.targetsById.get(row.fixtureId);
    if (!target) continue;
    const gu = input.goalsUniverseBySeason.get(row.season) ?? [];
    const su = input.strengthUniverseBySeason.get(row.season) ?? [];
    const home = listVenueRolePriorsWithOpponents({
      teamId: row.homeTeamId,
      venue: "HOME",
      target,
      goalsUniverse: gu,
      strengthUniverse: su,
      memo,
      ...neutral,
    });
    const away = listVenueRolePriorsWithOpponents({
      teamId: row.awayTeamId,
      venue: "AWAY",
      target,
      goalsUniverse: gu,
      strengthUniverse: su,
      memo,
      ...neutral,
    });
    allContribs.push(...home, ...away);
  }

  const sourceCounts = { catalogue: 0, base_prior: 0, unavailable: 0 };
  const catalogueStrengths: number[] = [];
  const played: number[] = [];
  for (const c of allContribs) {
    sourceCounts[c.opponentStrengthSource] += 1;
    if (
      c.opponentStrengthSource === "catalogue" &&
      c.opponentCommonStrengthAsOfM != null
    ) {
      catalogueStrengths.push(c.opponentCommonStrengthAsOfM);
    }
    if (c.opponentStrengthPlayed != null) played.push(c.opponentStrengthPlayed);
  }

  const { center, n: catalogueN } =
    computeEmpiricalOpponentCenter(catalogueStrengths);

  const percentile = (xs: number[], p: number) => {
    if (!xs.length) return NaN;
    const s = [...xs].sort((a, b) => a - b);
    return s[
      Math.min(s.length - 1, Math.max(0, Math.floor((p / 100) * (s.length - 1))))
    ]!;
  };
  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;

  const bins = GOALS_G3_OPPONENT_CENTERED_BINS;
  const labels = [
    "much_weaker_z<-1.5",
    "weaker_-1.5_to_-0.5",
    "near_avg_-0.5_to_0.5",
    "stronger_0.5_to_1.5",
    "much_stronger_z>=1.5",
  ];
  const bucketData = labels.map(() => ({
    gf: [] as number[],
    ga: [] as number[],
    st: [] as number[],
  }));

  for (const c of allContribs) {
    if (
      c.opponentStrengthSource !== "catalogue" ||
      c.opponentCommonStrengthAsOfM == null
    ) {
      continue;
    }
    const z = normalizeOpponentQuality(c.opponentCommonStrengthAsOfM, center);
    let idx = labels.length - 1;
    for (let i = 0; i < bins.length - 1; i += 1) {
      if (z >= bins[i]! && z < bins[i + 1]!) {
        idx = i;
        break;
      }
    }
    bucketData[idx]!.gf.push(c.rawGoalsFor);
    bucketData[idx]!.ga.push(c.rawGoalsAgainst);
    bucketData[idx]!.st.push(c.opponentCommonStrengthAsOfM);
  }

  return {
    reconstructionBase: GOALS_G3_RECONSTRUCTION_BASE,
    empiricalCenter: center,
    catalogueN,
    sourceCounts,
    playedBefore: {
      mean: mean(played),
      p0: percentile(played, 0),
      p50: percentile(played, 50),
      p100: percentile(played, 100),
    },
    strengthDist: {
      mean: mean(catalogueStrengths),
      p0: percentile(catalogueStrengths, 0),
      p50: percentile(catalogueStrengths, 50),
      p100: percentile(catalogueStrengths, 100),
    },
    descriptiveBins: labels.map((bin, i) => ({
      bin,
      n: bucketData[i]!.gf.length,
      meanGoalsFor: mean(bucketData[i]!.gf),
      meanGoalsAgainst: mean(bucketData[i]!.ga),
      meanGoalDiff:
        mean(bucketData[i]!.gf.map((g, j) => g - bucketData[i]!.ga[j]!)),
      meanOpponentStrength: mean(bucketData[i]!.st),
    })),
    note: "1580 is reconstruction baseline only; empiricalCenter is mean catalogue opponent strength on 2023 historical matches. Common strength is a generic team-quality index, not separate attack/defense Elo.",
  };
}
