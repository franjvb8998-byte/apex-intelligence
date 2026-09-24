/**
 * GOALS-1I.1 — Rest/schedule signal audit evaluation (no fitting).
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  assertG1Coherence,
  predictG1FromEvidence,
} from "@/lib/debug/calibration/goals/g1/predict";
import {
  buildRestFixtureObservations,
  buildRestTeamObservations,
} from "@/lib/debug/calibration/goals/rest-schedule/observations";
import {
  classifyRestSignal,
  expandingTeamDemeanedAssociations,
  fixtureRestAssociations,
  homeAwaySplit,
  marketSecondaryByHomeShortRest,
  restDistribution,
  seasonStageSplit,
  teamRestAssociations,
  winsorizedTeamAssociations,
  type SignalClass,
} from "@/lib/debug/calibration/goals/rest-schedule/diagnostics";
import { fixtureClusterRestPearsonCi } from "@/lib/debug/calibration/goals/rest-schedule/bootstrap";
import { shuffleNullRestDiagnostic } from "@/lib/debug/calibration/goals/rest-schedule/shuffle";
import {
  digestGoalsRestProtocol,
  GOALS_REST_CONFIRMATORY_SEASON,
  GOALS_REST_DEV_SEASON,
  GOALS_REST_FUTURE_SCHEDULE_ANTICIPATION,
  GOALS_REST_HOLDOUT_SEASON,
  GOALS_REST_PARENT_G1_K,
  GOALS_REST_REQUIRED_EVIDENCE_DIGEST,
  GOALS_REST_SCHEDULE_COVERAGE,
  goalsRestProtocol,
} from "@/lib/debug/calibration/goals/rest-schedule/protocol";

function seasonBundle(
  teamObs: ReturnType<typeof buildRestTeamObservations>,
  fixtures: ReturnType<typeof buildRestFixtureObservations>,
) {
  const team = teamRestAssociations(teamObs);
  const fixture = fixtureRestAssociations(fixtures);
  const demeaned = expandingTeamDemeanedAssociations(teamObs);
  const bootstrapAttack = fixtureClusterRestPearsonCi(teamObs, "attack");
  const bootstrapDefense = fixtureClusterRestPearsonCi(teamObs, "defense");
  return {
    support: restDistribution(teamObs),
    team,
    fixture,
    demeaned,
    homeAway: homeAwaySplit(teamObs),
    seasonStage: seasonStageSplit(teamObs),
    winsorized: winsorizedTeamAssociations(teamObs),
    bootstrap: { attack: bootstrapAttack, defense: bootstrapDefense },
    shuffle: shuffleNullRestDiagnostic(teamObs),
    markets: marketSecondaryByHomeShortRest(fixtures),
  };
}

function chooseOverallVerdict(
  attackClass: SignalClass,
  defenseClass: SignalClass,
  totalClass: SignalClass,
): SignalClass {
  const classes = [attackClass, defenseClass, totalClass];
  if (classes.includes("REPLICATED_DESCRIPTIVE_SIGNAL")) {
    return "REPLICATED_DESCRIPTIVE_SIGNAL";
  }
  if (classes.every((c) => c === "NO_SIGNAL" || c === "INSUFFICIENT_SUPPORT")) {
    if (classes.every((c) => c === "INSUFFICIENT_SUPPORT")) {
      return "INSUFFICIENT_SUPPORT";
    }
    return "NO_SIGNAL";
  }
  if (classes.includes("CONFOUNDED_SIGNAL")) return "CONFOUNDED_SIGNAL";
  return "WEAK_INCONSISTENT_SIGNAL";
}

export type GoalsRestAuditResult = {
  protocolDigest: string;
  parentG1K: typeof GOALS_REST_PARENT_G1_K;
  scheduleCoverage: typeof GOALS_REST_SCHEDULE_COVERAGE;
  futureScheduleAnticipation: typeof GOALS_REST_FUTURE_SCHEDULE_ANTICIPATION;
  observationCount: number;
  fixtureCount: number;
  development2023: ReturnType<typeof seasonBundle>;
  confirmatory2024: ReturnType<typeof seasonBundle>;
  attackClassification: SignalClass;
  defenseClassification: SignalClass;
  totalClassification: SignalClass;
  finalVerdict: SignalClass;
  resultDigest: string;
  productionWired: false;
  noModelFitting: true;
  holdout2025: {
    observations: 0;
    metrics: false;
    features: false;
  };
};

export function runGoalsRestScheduleAudit(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
}): GoalsRestAuditResult {
  if (input.evidenceDatasetDigest !== GOALS_REST_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(`Evidence digest mismatch: ${input.evidenceDatasetDigest}`);
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_REST_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const protocol = goalsRestProtocol();
  const protocolDigest = digestGoalsRestProtocol(protocol);

  const predictions = [];
  for (const row of input.evidenceRows) {
    if (
      row.season !== GOALS_REST_DEV_SEASON &&
      row.season !== GOALS_REST_CONFIRMATORY_SEASON
    ) {
      continue;
    }
    const p = predictG1FromEvidence(row, GOALS_REST_PARENT_G1_K);
    assertG1Coherence(p);
    predictions.push(p);
  }
  predictions.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );

  const teamObs = buildRestTeamObservations(predictions);
  const fixtures = buildRestFixtureObservations(predictions, teamObs);

  const obs23 = teamObs.filter((o) => o.season === GOALS_REST_DEV_SEASON);
  const obs24 = teamObs.filter(
    (o) => o.season === GOALS_REST_CONFIRMATORY_SEASON,
  );
  const fx23 = fixtures.filter((f) => f.season === GOALS_REST_DEV_SEASON);
  const fx24 = fixtures.filter(
    (f) => f.season === GOALS_REST_CONFIRMATORY_SEASON,
  );

  const development2023 = seasonBundle(obs23, fx23);
  const confirmatory2024 = seasonBundle(obs24, fx24);

  const attackClassification = classifyRestSignal({
    n23: development2023.team.restVsAttack.n,
    n24: confirmatory2024.team.restVsAttack.n,
    r23: development2023.team.restVsAttack.pearson,
    r24: confirmatory2024.team.restVsAttack.pearson,
    demeanedR23: development2023.demeaned.demeanedRestVsAttack.pearson,
    ci23ExcludesZero:
      development2023.bootstrap.attack?.excludesZero ?? false,
  });
  const defenseClassification = classifyRestSignal({
    n23: development2023.team.restVsDefense.n,
    n24: confirmatory2024.team.restVsDefense.n,
    r23: development2023.team.restVsDefense.pearson,
    r24: confirmatory2024.team.restVsDefense.pearson,
    demeanedR23: development2023.demeaned.demeanedRestVsDefense.pearson,
    ci23ExcludesZero:
      development2023.bootstrap.defense?.excludesZero ?? false,
  });
  const totalClassification = classifyRestSignal({
    n23: development2023.fixture.homeRestVsTotal.n,
    n24: confirmatory2024.fixture.homeRestVsTotal.n,
    r23: development2023.fixture.homeRestVsTotal.pearson,
    r24: confirmatory2024.fixture.homeRestVsTotal.pearson,
    demeanedR23: development2023.fixture.homeRestVsTotal.pearson,
    ci23ExcludesZero: false,
  });

  const finalVerdict = chooseOverallVerdict(
    attackClassification,
    defenseClassification,
    totalClassification,
  );

  const material = {
    protocolDigest,
    parentG1K: GOALS_REST_PARENT_G1_K,
    scheduleCoverage: GOALS_REST_SCHEDULE_COVERAGE,
    attackClassification,
    defenseClassification,
    totalClassification,
    finalVerdict,
    attack23: development2023.team.restVsAttack,
    attack24: confirmatory2024.team.restVsAttack,
    defense23: development2023.team.restVsDefense,
    defense24: confirmatory2024.team.restVsDefense,
    demeaned23: development2023.demeaned,
    noModelFitting: true,
  };
  const resultDigest = createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");

  return {
    protocolDigest,
    parentG1K: GOALS_REST_PARENT_G1_K,
    scheduleCoverage: GOALS_REST_SCHEDULE_COVERAGE,
    futureScheduleAnticipation: GOALS_REST_FUTURE_SCHEDULE_ANTICIPATION,
    observationCount: teamObs.length,
    fixtureCount: fixtures.length,
    development2023,
    confirmatory2024,
    attackClassification,
    defenseClassification,
    totalClassification,
    finalVerdict,
    resultDigest,
    productionWired: false,
    noModelFitting: true,
    holdout2025: {
      observations: 0,
      metrics: false,
      features: false,
    },
  };
}
