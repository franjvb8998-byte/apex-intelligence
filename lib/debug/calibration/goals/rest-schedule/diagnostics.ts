/**
 * GOALS-1I.1 — Associations, strata, demean, classification (no model fit).
 */

import type {
  GoalsRestFixtureObservation,
  GoalsRestTeamObservation,
} from "@/lib/debug/calibration/goals/rest-schedule/observations";
import { priorTeamMatches } from "@/lib/debug/calibration/goals/rest-schedule/observations";
import {
  GOALS_REST_BINS,
  GOALS_REST_NEAR_ZERO_ABS_R,
  GOALS_REST_WINSOR_CAP,
  type GoalsRestBin,
} from "@/lib/debug/calibration/goals/rest-schedule/protocol";

export function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3 || n !== ys.length) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den < 1e-15 ? null : num / den;
}

export function winsorize(x: number, cap = GOALS_REST_WINSOR_CAP): number {
  return Math.max(-cap, Math.min(cap, x));
}

export type Assoc = {
  n: number;
  pearson: number | null;
  meanX: number;
  meanY: number;
};

export function associate(xs: number[], ys: number[]): Assoc {
  const n = xs.length;
  return {
    n,
    pearson: pearson(xs, ys),
    meanX: n ? xs.reduce((a, b) => a + b, 0) / n : NaN,
    meanY: n ? ys.reduce((a, b) => a + b, 0) / n : NaN,
  };
}

export type StratumSummary = {
  bin: string;
  n: number;
  meanResidual: number;
  medianResidual: number;
  stdResidual: number;
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
}

export function residualStrata(
  rows: { bin: string; residual: number }[],
  bins: readonly string[],
): StratumSummary[] {
  return bins.map((bin) => {
    const vals = rows.filter((r) => r.bin === bin).map((r) => r.residual);
    const n = vals.length;
    if (!n) {
      return {
        bin,
        n: 0,
        meanResidual: NaN,
        medianResidual: NaN,
        stdResidual: NaN,
      };
    }
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(
      vals.reduce((s, v) => s + (v - mean) ** 2, 0) / n,
    );
    return {
      bin,
      n,
      meanResidual: mean,
      medianResidual: median(vals),
      stdResidual: std,
    };
  });
}

export function teamRestAssociations(
  obs: readonly GoalsRestTeamObservation[],
): {
  restVsAttack: Assoc;
  restVsDefense: Assoc;
  matches7dVsAttack: Assoc;
  matches7dVsDefense: Assoc;
  matches14dVsAttack: Assoc;
  matches14dVsDefense: Assoc;
  restBinAttack: StratumSummary[];
  restBinDefense: StratumSummary[];
  availableRestN: number;
  unavailableRestN: number;
} {
  const avail = obs.filter((o) => o.restFeatureStatus === "AVAILABLE");
  const rest = avail.map((o) => o.leagueRestDays!);
  const attack = avail.map((o) => o.attackResidual);
  const defense = avail.map((o) => o.defenseResidual);
  const m7a = obs.map((o) => o.leagueMatchesLast7d);
  const m7yA = obs.map((o) => o.attackResidual);
  const m7yD = obs.map((o) => o.defenseResidual);
  const m14a = obs.map((o) => o.leagueMatchesLast14d);

  return {
    restVsAttack: associate(rest, attack),
    restVsDefense: associate(rest, defense),
    matches7dVsAttack: associate(m7a, m7yA),
    matches7dVsDefense: associate(m7a, m7yD),
    matches14dVsAttack: associate(m14a, obs.map((o) => o.attackResidual)),
    matches14dVsDefense: associate(m14a, obs.map((o) => o.defenseResidual)),
    restBinAttack: residualStrata(
      avail.map((o) => ({
        bin: o.restBin as string,
        residual: o.attackResidual,
      })),
      GOALS_REST_BINS,
    ),
    restBinDefense: residualStrata(
      avail.map((o) => ({
        bin: o.restBin as string,
        residual: o.defenseResidual,
      })),
      GOALS_REST_BINS,
    ),
    availableRestN: avail.length,
    unavailableRestN: obs.length - avail.length,
  };
}

export function fixtureRestAssociations(
  fixtures: readonly GoalsRestFixtureObservation[],
): {
  restDiffVsTotal: Assoc;
  restDiffVsHomeAttack: Assoc;
  restDiffVsAwayAttack: Assoc;
  homeRestVsHomeAttack: Assoc;
  awayRestVsAwayAttack: Assoc;
  homeRestVsTotal: Assoc;
  load7DiffVsTotal: Assoc;
} {
  const both = fixtures.filter((f) => f.restDifferenceDays != null);
  const homeAvail = fixtures.filter((f) => f.homeLeagueRestDays != null);
  const awayAvail = fixtures.filter((f) => f.awayLeagueRestDays != null);
  return {
    restDiffVsTotal: associate(
      both.map((f) => f.restDifferenceDays!),
      both.map((f) => f.fixtureTotalResidual),
    ),
    restDiffVsHomeAttack: associate(
      both.map((f) => f.restDifferenceDays!),
      both.map((f) => f.homeAttackResidual),
    ),
    restDiffVsAwayAttack: associate(
      both.map((f) => f.restDifferenceDays!),
      both.map((f) => f.awayAttackResidual),
    ),
    homeRestVsHomeAttack: associate(
      homeAvail.map((f) => f.homeLeagueRestDays!),
      homeAvail.map((f) => f.homeAttackResidual),
    ),
    awayRestVsAwayAttack: associate(
      awayAvail.map((f) => f.awayLeagueRestDays!),
      awayAvail.map((f) => f.awayAttackResidual),
    ),
    homeRestVsTotal: associate(
      homeAvail.map((f) => f.homeLeagueRestDays!),
      homeAvail.map((f) => f.fixtureTotalResidual),
    ),
    load7DiffVsTotal: associate(
      fixtures.map((f) => f.matchesLast7dDifference!),
      fixtures.map((f) => f.fixtureTotalResidual),
    ),
  };
}

/**
 * Expanding team-mean demean: for target T, subtract mean of that team's
 * residuals from fixtures with kickoff < T only.
 */
export function expandingTeamDemeanedAssociations(
  obs: readonly GoalsRestTeamObservation[],
): {
  rawRestVsAttack: Assoc;
  demeanedRestVsAttack: Assoc;
  rawRestVsDefense: Assoc;
  demeanedRestVsDefense: Assoc;
} {
  const byTeam = new Map<string, GoalsRestTeamObservation[]>();
  for (const o of obs) {
    const key = `${o.season}|${o.teamId}`;
    const list = byTeam.get(key) ?? [];
    list.push(o);
    byTeam.set(key, list);
  }
  for (const [k, list] of byTeam) {
    byTeam.set(
      k,
      [...list].sort(
        (a, b) =>
          a.kickoffUtc.localeCompare(b.kickoffUtc) ||
          a.fixtureId.localeCompare(b.fixtureId),
      ),
    );
  }

  const rest: number[] = [];
  const rawA: number[] = [];
  const demA: number[] = [];
  const rawD: number[] = [];
  const demD: number[] = [];

  for (const o of obs) {
    if (o.restFeatureStatus !== "AVAILABLE" || o.leagueRestDays == null) {
      continue;
    }
    const teamList = byTeam.get(`${o.season}|${o.teamId}`) ?? [];
    const priors = priorTeamMatches(o, teamList);
    if (priors.length === 0) continue; // cannot demean without history
    const meanA =
      priors.reduce((s, p) => s + p.attackResidual, 0) / priors.length;
    const meanD =
      priors.reduce((s, p) => s + p.defenseResidual, 0) / priors.length;
    rest.push(o.leagueRestDays);
    rawA.push(o.attackResidual);
    demA.push(o.attackResidual - meanA);
    rawD.push(o.defenseResidual);
    demD.push(o.defenseResidual - meanD);
  }

  return {
    rawRestVsAttack: associate(rest, rawA),
    demeanedRestVsAttack: associate(rest, demA),
    rawRestVsDefense: associate(rest, rawD),
    demeanedRestVsDefense: associate(rest, demD),
  };
}

export function homeAwaySplit(
  obs: readonly GoalsRestTeamObservation[],
): {
  HOME: ReturnType<typeof teamRestAssociations>;
  AWAY: ReturnType<typeof teamRestAssociations>;
} {
  return {
    HOME: teamRestAssociations(obs.filter((o) => o.venueRole === "HOME")),
    AWAY: teamRestAssociations(obs.filter((o) => o.venueRole === "AWAY")),
  };
}

export function seasonStageSplit(
  obs: readonly GoalsRestTeamObservation[],
): Record<string, ReturnType<typeof teamRestAssociations>> {
  const stages = ["EARLY", "MID", "LATE"] as const;
  const out: Record<string, ReturnType<typeof teamRestAssociations>> = {};
  for (const s of stages) {
    out[s] = teamRestAssociations(obs.filter((o) => o.seasonStage === s));
  }
  return out;
}

export function winsorizedTeamAssociations(
  obs: readonly GoalsRestTeamObservation[],
): {
  restVsAttack: Assoc;
  restVsDefense: Assoc;
} {
  const avail = obs.filter((o) => o.restFeatureStatus === "AVAILABLE");
  return {
    restVsAttack: associate(
      avail.map((o) => o.leagueRestDays!),
      avail.map((o) => winsorize(o.attackResidual)),
    ),
    restVsDefense: associate(
      avail.map((o) => o.leagueRestDays!),
      avail.map((o) => winsorize(o.defenseResidual)),
    ),
  };
}

export function restDistribution(
  obs: readonly GoalsRestTeamObservation[],
): {
  availableN: number;
  unavailableN: number;
  meanRestDays: number;
  medianRestDays: number;
  binCounts: Record<GoalsRestBin, number>;
  shortRestLe3dRate: number;
  veryShortRestLe2dRate: number;
  meanMatchesLast7d: number;
  meanMatchesLast14d: number;
  meanMatchesLast28d: number;
} {
  const avail = obs.filter((o) => o.restFeatureStatus === "AVAILABLE");
  const days = avail.map((o) => o.leagueRestDays!);
  const binCounts = {} as Record<GoalsRestBin, number>;
  for (const b of GOALS_REST_BINS) binCounts[b] = 0;
  for (const o of avail) {
    if (o.restBin) binCounts[o.restBin] += 1;
  }
  return {
    availableN: avail.length,
    unavailableN: obs.length - avail.length,
    meanRestDays: days.length
      ? days.reduce((a, b) => a + b, 0) / days.length
      : NaN,
    medianRestDays: days.length ? median(days) : NaN,
    binCounts,
    shortRestLe3dRate: avail.length
      ? avail.filter((o) => o.shortRestLe3d).length / avail.length
      : NaN,
    veryShortRestLe2dRate: avail.length
      ? avail.filter((o) => o.veryShortRestLe2d).length / avail.length
      : NaN,
    meanMatchesLast7d:
      obs.reduce((s, o) => s + o.leagueMatchesLast7d, 0) / obs.length,
    meanMatchesLast14d:
      obs.reduce((s, o) => s + o.leagueMatchesLast14d, 0) / obs.length,
    meanMatchesLast28d:
      obs.reduce((s, o) => s + o.leagueMatchesLast28d, 0) / obs.length,
  };
}

export type SignalClass =
  | "NO_SIGNAL"
  | "WEAK_INCONSISTENT_SIGNAL"
  | "REPLICATED_DESCRIPTIVE_SIGNAL"
  | "CONFOUNDED_SIGNAL"
  | "INSUFFICIENT_SUPPORT";

export function classifyRestSignal(input: {
  n23: number;
  n24: number;
  r23: number | null;
  r24: number | null;
  demeanedR23: number | null;
  ci23ExcludesZero: boolean;
}): SignalClass {
  if (input.n23 < 100 || input.n24 < 100) return "INSUFFICIENT_SUPPORT";
  const r23 = input.r23;
  const r24 = input.r24;
  if (r23 == null || r24 == null) return "INSUFFICIENT_SUPPORT";
  const near23 = Math.abs(r23) < GOALS_REST_NEAR_ZERO_ABS_R;
  const near24 = Math.abs(r24) < GOALS_REST_NEAR_ZERO_ABS_R;
  if (near23 && near24) return "NO_SIGNAL";
  const sameSign = Math.sign(r23) === Math.sign(r24) && Math.sign(r23) !== 0;
  const bothStrong =
    Math.abs(r23) >= GOALS_REST_NEAR_ZERO_ABS_R &&
    Math.abs(r24) >= GOALS_REST_NEAR_ZERO_ABS_R;
  if (bothStrong && sameSign && input.ci23ExcludesZero) {
    const dem = input.demeanedR23;
    if (
      dem != null &&
      Math.sign(dem) === Math.sign(r23) &&
      Math.abs(dem) >= 0.5 * Math.abs(r23)
    ) {
      return "REPLICATED_DESCRIPTIVE_SIGNAL";
    }
    return "CONFOUNDED_SIGNAL";
  }
  return "WEAK_INCONSISTENT_SIGNAL";
}

/** Market secondary: mean predicted vs actual rate by short-rest flag on home. */
export function marketSecondaryByHomeShortRest(
  fixtures: readonly GoalsRestFixtureObservation[],
): Record<
  string,
  {
    shortRest: { n: number; meanPred: number; actualRate: number };
    longerRest: { n: number; meanPred: number; actualRate: number };
  }
> {
  const withRest = fixtures.filter((f) => f.homeLeagueRestDays != null);
  const short = withRest.filter((f) => f.homeLeagueRestDays! <= 3);
  const longer = withRest.filter((f) => f.homeLeagueRestDays! > 3);
  const one = (
    rows: GoalsRestFixtureObservation[],
    pred: (f: GoalsRestFixtureObservation) => number | null,
    actual: (f: GoalsRestFixtureObservation) => 0 | 1,
  ) => {
    const usable = rows.filter((f) => pred(f) != null);
    const n = usable.length;
    return {
      n,
      meanPred: n
        ? usable.reduce((s, f) => s + pred(f)!, 0) / n
        : NaN,
      actualRate: n
        ? usable.reduce((s, f) => s + actual(f), 0) / n
        : NaN,
    };
  };
  return {
    over05: {
      shortRest: one(short, (f) => f.markets?.over05 ?? null, (f) => f.actualOver05),
      longerRest: one(
        longer,
        (f) => f.markets?.over05 ?? null,
        (f) => f.actualOver05,
      ),
    },
    over15: {
      shortRest: one(short, (f) => f.markets?.over15 ?? null, (f) => f.actualOver15),
      longerRest: one(
        longer,
        (f) => f.markets?.over15 ?? null,
        (f) => f.actualOver15,
      ),
    },
    over25: {
      shortRest: one(short, (f) => f.markets?.over25 ?? null, (f) => f.actualOver25),
      longerRest: one(
        longer,
        (f) => f.markets?.over25 ?? null,
        (f) => f.actualOver25,
      ),
    },
    btts: {
      shortRest: one(
        short,
        (f) => f.markets?.bttsYes ?? null,
        (f) => f.actualBttsYes,
      ),
      longerRest: one(
        longer,
        (f) => f.markets?.bttsYes ?? null,
        (f) => f.actualBttsYes,
      ),
    },
  };
}
