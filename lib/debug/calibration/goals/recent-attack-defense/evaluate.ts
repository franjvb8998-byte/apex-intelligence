/**
 * GOALS-1H.1 — Recent attack/defense signal audit evaluation (no fitting).
 */

import { createHash } from "node:crypto";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import {
  assertG1Coherence,
  predictG1FromEvidence,
} from "@/lib/debug/calibration/goals/g1/predict";
import { buildAllTeamObservations } from "@/lib/debug/calibration/goals/recent-attack-defense/observations";
import type { GoalsRadTeamObservation } from "@/lib/debug/calibration/goals/recent-attack-defense/observations";
import {
  associate,
  associateCross,
  buildSignalPairs,
  classifyReplication,
  classifySignal,
  extremeResidualStrata,
  fixtureClusterPearsonCi,
  homeAwayRobustness,
  horizonPersistence,
  qualityStrata,
  supportInventory,
  teamDemeanedLast5,
  venueRoleAudit,
  winsorize,
  type AssociationSummary,
  type SignalClass,
} from "@/lib/debug/calibration/goals/recent-attack-defense/diagnostics";
import { shuffleNullDiagnostic } from "@/lib/debug/calibration/goals/recent-attack-defense/shuffle";
import {
  digestGoalsRadProtocol,
  GOALS_RAD_CONFIRMATORY_SEASON,
  GOALS_RAD_DEV_SEASON,
  GOALS_RAD_HOLDOUT_SEASON,
  GOALS_RAD_PARENT_G1_K,
  GOALS_RAD_REQUIRED_EVIDENCE_DIGEST,
  goalsRadProtocol,
  type GoalsRadProtocol,
} from "@/lib/debug/calibration/goals/recent-attack-defense/protocol";
import type { GoalsRadWindowId } from "@/lib/debug/calibration/goals/recent-attack-defense/history";

const WINDOWS: GoalsRadWindowId[] = [
  "last_3",
  "last_5",
  "last_8",
  "days_28",
  "days_56",
  "halfLife_28",
];

function seasonBundle(obs: readonly GoalsRadTeamObservation[]) {
  const byWindow: Record<
    string,
    {
      attack: AssociationSummary & { classification: SignalClass };
      defense: AssociationSummary & { classification: SignalClass };
      cross: {
        attackToGoalsFor: AssociationSummary;
        defenseToGoalsAgainst: AssociationSummary;
      };
    }
  > = {};
  for (const w of WINDOWS) {
    const pairs = buildSignalPairs(obs, w, 1);
    const attack = associate(pairs, "attack");
    const defense = associate(pairs, "defense");
    byWindow[w] = {
      attack: { ...attack, classification: classifySignal(attack.pearson) },
      defense: { ...defense, classification: classifySignal(defense.pearson) },
      cross: {
        attackToGoalsFor: associateCross(pairs, "attack", "goalsFor"),
        defenseToGoalsAgainst: associateCross(
          pairs,
          "defense",
          "goalsAgainst",
        ),
      },
    };
  }

  const last5 = buildSignalPairs(obs, "last_5", 1);
  const winsorPairs = last5.map((p) => ({
    ...p,
    historicalAttack: winsorize(p.historicalAttack),
    historicalDefense: winsorize(p.historicalDefense),
    nextAttackResidual: winsorize(p.nextAttackResidual),
    nextDefenseResidual: winsorize(p.nextDefenseResidual),
  }));

  return {
    support: supportInventory(obs),
    byWindow,
    venueRole: venueRoleAudit(obs),
    horizonLast5: horizonPersistence(obs, "last_5"),
    horizonHalfLife: horizonPersistence(obs, "halfLife_28"),
    quality: qualityStrata(obs),
    homeAway: homeAwayRobustness(obs),
    extremeAttack: extremeResidualStrata(last5, "attack"),
    extremeDefense: extremeResidualStrata(last5, "defense"),
    winsorized: {
      attack: associate(winsorPairs, "attack"),
      defense: associate(winsorPairs, "defense"),
    },
    teamDemeaned: teamDemeanedLast5(obs),
    bootstrap: {
      attackLast5: fixtureClusterPearsonCi(last5, "attack"),
      defenseLast5: fixtureClusterPearsonCi(last5, "defense"),
      attackHl28: fixtureClusterPearsonCi(
        buildSignalPairs(obs, "halfLife_28", 1),
        "attack",
      ),
      defenseHl28: fixtureClusterPearsonCi(
        buildSignalPairs(obs, "halfLife_28", 1),
        "defense",
      ),
    },
    shuffle: shuffleNullDiagnostic(obs, "last_5"),
  };
}

function chooseVerdict(
  s23: ReturnType<typeof seasonBundle>,
  s24: ReturnType<typeof seasonBundle>,
): string {
  const windows = ["last_5", "halfLife_28", "last_3", "last_8"] as const;
  let attackPos = 0;
  let defensePos = 0;
  let attackNeg = 0;
  let defenseNeg = 0;
  let attackNear = 0;
  let defenseNear = 0;
  let unstable = 0;

  for (const w of windows) {
    const a23 = s23.byWindow[w]!.attack.classification;
    const a24 = s24.byWindow[w]!.attack.classification;
    const d23 = s23.byWindow[w]!.defense.classification;
    const d24 = s24.byWindow[w]!.defense.classification;
    const ar = classifyReplication(a23, a24);
    const dr = classifyReplication(d23, d24);
    if (ar === "REPLICATES" && a23 === "POSITIVE_PERSISTENCE") attackPos += 1;
    if (dr === "REPLICATES" && d23 === "POSITIVE_PERSISTENCE") defensePos += 1;
    if (ar === "REPLICATES" && a23 === "NEGATIVE_PERSISTENCE") attackNeg += 1;
    if (dr === "REPLICATES" && d23 === "NEGATIVE_PERSISTENCE") defenseNeg += 1;
    if (ar === "REPLICATES" && a23 === "NEAR_ZERO") attackNear += 1;
    if (dr === "REPLICATES" && d23 === "NEAR_ZERO") defenseNear += 1;
    if (ar === "UNSTABLE" || ar === "DOES_NOT_REPLICATE") unstable += 1;
    if (dr === "UNSTABLE" || dr === "DOES_NOT_REPLICATE") unstable += 1;
  }

  // Primary: last_5 replication
  const aL5 = classifyReplication(
    s23.byWindow.last_5!.attack.classification,
    s24.byWindow.last_5!.attack.classification,
  );
  const dL5 = classifyReplication(
    s23.byWindow.last_5!.defense.classification,
    s24.byWindow.last_5!.defense.classification,
  );
  const aPos =
    aL5 === "REPLICATES" &&
    s23.byWindow.last_5!.attack.classification === "POSITIVE_PERSISTENCE";
  const dPos =
    dL5 === "REPLICATES" &&
    s23.byWindow.last_5!.defense.classification === "POSITIVE_PERSISTENCE";

  if (aPos && dPos) return "RECENT_ATTACK_DEFENSE_SIGNAL_FOUND";
  if (aPos && !dPos) return "ATTACK_ONLY_SIGNAL";
  if (dPos && !aPos) return "DEFENSE_ONLY_SIGNAL";
  if (attackPos + defensePos >= 2) return "WEAK_OR_UNSTABLE_SIGNAL";
  if (unstable >= 4 || attackNear + defenseNear >= 4) {
    // mostly near-zero or unstable
    if (attackPos + defensePos === 0 && attackNeg + defenseNeg === 0) {
      return "NO_INCREMENTAL_RECENT_GOAL_SIGNAL";
    }
  }
  if (attackPos + defensePos === 0 && attackNeg + defenseNeg === 0) {
    return "NO_INCREMENTAL_RECENT_GOAL_SIGNAL";
  }
  return "WEAK_OR_UNSTABLE_SIGNAL";
}

export type GoalsRadAuditResult = {
  protocol: GoalsRadProtocol;
  protocolDigest: string;
  parentG1K: typeof GOALS_RAD_PARENT_G1_K;
  observationCount: number;
  development2023: ReturnType<typeof seasonBundle>;
  confirmatory2024: ReturnType<typeof seasonBundle>;
  seasonReplication: Record<
    string,
    {
      attack: ReturnType<typeof classifyReplication>;
      defense: ReturnType<typeof classifyReplication>;
    }
  >;
  finalVerdict: string;
  resultDigest: string;
  productionWired: false;
  noModelFitting: true;
  holdout2025: {
    observations: 0;
    histories: false;
    metrics: false;
    bootstrap: false;
    shuffle: false;
  };
};

export function runGoalsRecentAttackDefenseAudit(input: {
  evidenceRows: readonly GoalsTargetEvidence[];
  evidenceDatasetDigest: string;
}): GoalsRadAuditResult {
  if (input.evidenceDatasetDigest !== GOALS_RAD_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error(`Evidence digest mismatch: ${input.evidenceDatasetDigest}`);
  }
  for (const row of input.evidenceRows) {
    if (row.season === GOALS_RAD_HOLDOUT_SEASON) {
      throw new Error(`Holdout evidence row leaked: ${row.fixtureId}`);
    }
  }

  const protocol = goalsRadProtocol();
  const protocolDigest = digestGoalsRadProtocol(protocol);

  const predictions = [];
  for (const row of input.evidenceRows) {
    if (
      row.season !== GOALS_RAD_DEV_SEASON &&
      row.season !== GOALS_RAD_CONFIRMATORY_SEASON
    ) {
      continue;
    }
    const p = predictG1FromEvidence(row, GOALS_RAD_PARENT_G1_K);
    assertG1Coherence(p);
    predictions.push(p);
  }
  predictions.sort(
    (a, b) =>
      a.kickoffUtc.localeCompare(b.kickoffUtc) ||
      a.fixtureId.localeCompare(b.fixtureId),
  );

  const observations = buildAllTeamObservations(predictions);
  const obs23 = observations.filter((o) => o.season === GOALS_RAD_DEV_SEASON);
  const obs24 = observations.filter(
    (o) => o.season === GOALS_RAD_CONFIRMATORY_SEASON,
  );

  const development2023 = seasonBundle(obs23);
  const confirmatory2024 = seasonBundle(obs24);

  const seasonReplication: GoalsRadAuditResult["seasonReplication"] = {};
  for (const w of WINDOWS) {
    seasonReplication[w] = {
      attack: classifyReplication(
        development2023.byWindow[w]!.attack.classification,
        confirmatory2024.byWindow[w]!.attack.classification,
      ),
      defense: classifyReplication(
        development2023.byWindow[w]!.defense.classification,
        confirmatory2024.byWindow[w]!.defense.classification,
      ),
    };
  }

  const finalVerdict = chooseVerdict(development2023, confirmatory2024);

  const material = {
    protocolDigest,
    parentG1K: GOALS_RAD_PARENT_G1_K,
    observationCount: observations.length,
    attackLast5_2023: development2023.byWindow.last_5!.attack,
    attackLast5_2024: confirmatory2024.byWindow.last_5!.attack,
    defenseLast5_2023: development2023.byWindow.last_5!.defense,
    defenseLast5_2024: confirmatory2024.byWindow.last_5!.defense,
    seasonReplication,
    finalVerdict,
    noModelFitting: true,
  };
  const resultDigest = createHash("sha256")
    .update(JSON.stringify(material), "utf8")
    .digest("hex");

  return {
    protocol,
    protocolDigest,
    parentG1K: GOALS_RAD_PARENT_G1_K,
    observationCount: observations.length,
    development2023,
    confirmatory2024,
    seasonReplication,
    finalVerdict,
    resultDigest,
    productionWired: false,
    noModelFitting: true,
    holdout2025: {
      observations: 0,
      histories: false,
      metrics: false,
      bootstrap: false,
      shuffle: false,
    },
  };
}
