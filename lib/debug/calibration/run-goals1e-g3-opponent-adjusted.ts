/**
 * GOALS-1E — Offline CLI for G3 opponent-adjusted attack/defense.
 *
 * Usage:
 *   npx tsx lib/debug/calibration/run-goals1e-g3-opponent-adjusted.ts --execute
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runGoalsG3OpponentAdjusted } from "@/lib/debug/calibration/goals/g3/evaluate";
import {
  digestGoalsG3Protocol,
  goalsG3Protocol,
  GOALS_G3_PARENT_G0_PROTOCOL_DIGEST,
  GOALS_G3_PARENT_G1_PROTOCOL_DIGEST,
  GOALS_G3_REQUIRED_EVIDENCE_DIGEST,
} from "@/lib/debug/calibration/goals/g3/protocol";
import { goalsFixtureToStrengthUniverse } from "@/lib/debug/calibration/goals/g3/opponent-attach";
import { applyLeagueFtAssumption } from "@/lib/debug/calibration/goals/regulation";
import {
  calibrationRowToGoalsFixture,
  normalizeGoalsHistoricalUniverse,
} from "@/lib/debug/calibration/goals/normalize";
import type { GoalsTargetEvidence } from "@/lib/debug/calibration/goals/types";
import { CALIBRATION_ARTIFACT_DIR } from "@/lib/debug/calibration/types";
import type { CalibrationRow } from "@/lib/debug/calibration/types";

const POPULATION_SOURCES = [
  {
    label: "pl-2023-population",
    file: "validation-5b6-pl-2023-2026-09-19T06-15-50-956Z.population.jsonl",
    season: "2023",
  },
  {
    label: "pl-2024-population",
    file: "pilot-2026-09-19T05-52-08-473Z.population.jsonl",
    season: "2024",
  },
] as const;

function slimPrediction(p: {
  fixtureId: string;
  season: string;
  kickoffUtc: string;
  predictionStatus: string;
  muHome: number | null;
  muAway: number | null;
  expectedTotalGoals: number | null;
  homeAttackStrength: number | null;
  homeDefenseStrength: number | null;
  awayAttackStrength: number | null;
  awayDefenseStrength: number | null;
  beta: number;
  shrinkageK: number;
  evidenceDigest: string | null;
  markets: unknown;
  diagnostics: unknown;
  labelHomeGoals90: number | null;
  labelAwayGoals90: number | null;
  homeAttackSummary: { contributionsDigest: string; played: number; catalogueOpponentN: number; basePriorOpponentN: number; unavailableOpponentN: number; meanAttackAdjustment: number | null; meanDefenseAdjustment: number | null; adjustedGoalsForPerMatch: number | null; adjustedGoalsAgainstPerMatch: number | null; rawGoalsForPerMatch: number | null; rawGoalsAgainstPerMatch: number | null } | null;
  awayAttackSummary: { contributionsDigest: string; played: number; catalogueOpponentN: number; basePriorOpponentN: number; unavailableOpponentN: number; meanAttackAdjustment: number | null; meanDefenseAdjustment: number | null; adjustedGoalsForPerMatch: number | null; adjustedGoalsAgainstPerMatch: number | null; rawGoalsForPerMatch: number | null; rawGoalsAgainstPerMatch: number | null } | null;
  allContributions: unknown[];
  empiricalOpponentCenter: number;
  leagueHomeRate: number | null;
  leagueAwayRate: number | null;
  evidenceSupportBucket: string;
  lowInformationFallbackUsed: boolean;
  regulationLabelSource: string;
}) {
  return {
    fixtureId: p.fixtureId,
    season: p.season,
    kickoffUtc: p.kickoffUtc,
    predictionStatus: p.predictionStatus,
    muHome: p.muHome,
    muAway: p.muAway,
    expectedTotalGoals: p.expectedTotalGoals,
    homeAttackStrength: p.homeAttackStrength,
    homeDefenseStrength: p.homeDefenseStrength,
    awayAttackStrength: p.awayAttackStrength,
    awayDefenseStrength: p.awayDefenseStrength,
    beta: p.beta,
    shrinkageK: p.shrinkageK,
    empiricalOpponentCenter: p.empiricalOpponentCenter,
    leagueHomeRate: p.leagueHomeRate,
    leagueAwayRate: p.leagueAwayRate,
    evidenceDigest: p.evidenceDigest,
    markets: p.markets,
    diagnostics: p.diagnostics,
    labelHomeGoals90: p.labelHomeGoals90,
    labelAwayGoals90: p.labelAwayGoals90,
    evidenceSupportBucket: p.evidenceSupportBucket,
    lowInformationFallbackUsed: p.lowInformationFallbackUsed,
    regulationLabelSource: p.regulationLabelSource,
    homeAttackSummary: p.homeAttackSummary
      ? {
          played: p.homeAttackSummary.played,
          contributionsDigest: p.homeAttackSummary.contributionsDigest,
          catalogueOpponentN: p.homeAttackSummary.catalogueOpponentN,
          basePriorOpponentN: p.homeAttackSummary.basePriorOpponentN,
          unavailableOpponentN: p.homeAttackSummary.unavailableOpponentN,
          meanAttackAdjustment: p.homeAttackSummary.meanAttackAdjustment,
          meanDefenseAdjustment: p.homeAttackSummary.meanDefenseAdjustment,
          rawGoalsForPerMatch: p.homeAttackSummary.rawGoalsForPerMatch,
          rawGoalsAgainstPerMatch: p.homeAttackSummary.rawGoalsAgainstPerMatch,
          adjustedGoalsForPerMatch: p.homeAttackSummary.adjustedGoalsForPerMatch,
          adjustedGoalsAgainstPerMatch:
            p.homeAttackSummary.adjustedGoalsAgainstPerMatch,
        }
      : null,
    awayAttackSummary: p.awayAttackSummary
      ? {
          played: p.awayAttackSummary.played,
          contributionsDigest: p.awayAttackSummary.contributionsDigest,
          catalogueOpponentN: p.awayAttackSummary.catalogueOpponentN,
          basePriorOpponentN: p.awayAttackSummary.basePriorOpponentN,
          unavailableOpponentN: p.awayAttackSummary.unavailableOpponentN,
          meanAttackAdjustment: p.awayAttackSummary.meanAttackAdjustment,
          meanDefenseAdjustment: p.awayAttackSummary.meanDefenseAdjustment,
          rawGoalsForPerMatch: p.awayAttackSummary.rawGoalsForPerMatch,
          rawGoalsAgainstPerMatch: p.awayAttackSummary.rawGoalsAgainstPerMatch,
          adjustedGoalsForPerMatch: p.awayAttackSummary.adjustedGoalsForPerMatch,
          adjustedGoalsAgainstPerMatch:
            p.awayAttackSummary.adjustedGoalsAgainstPerMatch,
        }
      : null,
    // Full per-match provenance for reconstructibility
    contributions: p.allContributions,
  };
}

function main() {
  const protocolPre = goalsG3Protocol(null);
  const protocolDigestPre = digestGoalsG3Protocol(protocolPre);
  console.log(
    JSON.stringify(
      {
        phase: "PROTOCOL_FROZEN",
        protocolVersion: protocolPre.protocolVersion,
        protocolDigest: protocolDigestPre,
        parentG0ProtocolDigest: GOALS_G3_PARENT_G0_PROTOCOL_DIGEST,
        parentG1ProtocolDigest: GOALS_G3_PARENT_G1_PROTOCOL_DIGEST,
        frozenShrinkageK: protocolPre.frozenShrinkageK,
        betaCandidates: protocolPre.betaCandidates,
        selectedBeta: null,
        note: "beta selection uses 2023 only; confirmatory 2024 metrics not yet computed",
      },
      null,
      2,
    ),
  );

  if (!process.argv.includes("--execute")) {
    console.log(JSON.stringify({ dryRun: true, hint: "Pass --execute" }));
    return;
  }

  const evidenceDir = path.join(
    process.cwd(),
    CALIBRATION_ARTIFACT_DIR,
    "goals",
  );
  const manifest = JSON.parse(
    readFileSync(
      path.join(evidenceDir, "goals-evidence-v1.manifest.json"),
      "utf8",
    ),
  ) as { datasetDigest: string };
  if (manifest.datasetDigest !== GOALS_G3_REQUIRED_EVIDENCE_DIGEST) {
    throw new Error("GOALS-1B digest mismatch");
  }

  const evidenceRows = readFileSync(
    path.join(evidenceDir, "goals-evidence-v1.jsonl"),
    "utf8",
  )
    .trim()
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoalsTargetEvidence);

  const goalsUniverseBySeason = new Map<
    string,
    ReturnType<typeof normalizeGoalsHistoricalUniverse>["fixtures"]
  >();
  const strengthUniverseBySeason = new Map(
    [] as [string, ReturnType<typeof goalsFixtureToStrengthUniverse>][],
  );
  const targetsById = new Map<
    string,
    ReturnType<typeof normalizeGoalsHistoricalUniverse>["fixtures"][number]
  >();

  for (const src of POPULATION_SOURCES) {
    const abs = path.join(process.cwd(), CALIBRATION_ARTIFACT_DIR, src.file);
    const rows = readFileSync(abs, "utf8")
      .trim()
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CalibrationRow)
      .filter((r) => r.season === src.season && r.competitionId === "39");
    // Match GOALS-1B order: normalize first, then league FT assumption
    // (normalize must not run after FT_ASSUMED — it would wipe labels).
    let fixtures = normalizeGoalsHistoricalUniverse(
      rows.map(calibrationRowToGoalsFixture),
    ).fixtures;
    fixtures = fixtures.map(applyLeagueFtAssumption);
    goalsUniverseBySeason.set(src.season, fixtures);
    strengthUniverseBySeason.set(
      src.season,
      goalsFixtureToStrengthUniverse(fixtures),
    );
    for (const f of fixtures) targetsById.set(f.fixtureId, f);
  }

  const runInput = {
    evidenceRows,
    evidenceDatasetDigest: manifest.datasetDigest,
    targetsById,
    goalsUniverseBySeason,
    strengthUniverseBySeason,
  };

  const result = runGoalsG3OpponentAdjusted(runInput);
  const result2 = runGoalsG3OpponentAdjusted(runInput);

  if (!result.nullReproduction2023.passes) {
    throw new Error(
      `G3 beta=0 failed to reproduce G1: muHΔ=${result.nullReproduction2023.maxAbsMuHomeDiff} muAΔ=${result.nullReproduction2023.maxAbsMuAwayDiff}`,
    );
  }

  const protocol = goalsG3Protocol(result.selectedBeta);
  const protocolDigest = digestGoalsG3Protocol(protocol);
  if (protocolDigest !== result.protocolDigest) {
    throw new Error("Protocol digest mismatch after beta freeze");
  }

  console.log(
    JSON.stringify(
      {
        phase: "SELECTED_BETA_FROZEN",
        selectedBeta: result.selectedBeta,
        empiricalOpponentCenter: result.empiricalOpponentCenter,
        protocolDigest,
        betaSelection: result.betaSelection,
        nullReproduction2023: result.nullReproduction2023,
      },
      null,
      2,
    ),
  );

  const reproducible =
    result.protocolDigest === result2.protocolDigest &&
    result.selectedBeta === result2.selectedBeta &&
    result.resultDigest === result2.resultDigest &&
    result.metrics2023.distribution?.jointScoreLogLoss ===
      result2.metrics2023.distribution?.jointScoreLogLoss &&
    result.metrics2024.distribution?.jointScoreLogLoss ===
      result2.metrics2024.distribution?.jointScoreLogLoss;

  if (!reproducible) {
    throw new Error("GOALS-1E reproducibility failed — STOP");
  }

  const outDir = path.join(evidenceDir, "g3-v1");
  mkdirSync(outDir, { recursive: true });

  const writePred = (name: string, rows: unknown[]) => {
    const text = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
    writeFileSync(path.join(outDir, name), text);
    return createHash("sha256").update(text, "utf8").digest("hex");
  };

  writeFileSync(
    path.join(outDir, "protocol.json"),
    JSON.stringify({ protocol, protocolDigest }, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "opponent-quality-audit.json"),
    JSON.stringify(result.opponentQualityAudit, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "development-selection.json"),
    JSON.stringify(result.betaSelection, null, 2) + "\n",
  );
  const dig23 = writePred(
    "predictions-2023.jsonl",
    result.predictions2023.map(slimPrediction),
  );
  const dig24 = writePred(
    "predictions-2024.jsonl",
    result.predictions2024.map(slimPrediction),
  );
  writeFileSync(
    path.join(outDir, "metrics-2023.json"),
    JSON.stringify(
      { g3: result.metrics2023, commonCoverage: result.common2023 },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "metrics-2024.json"),
    JSON.stringify(
      { g3: result.metrics2024, commonCoverage: result.common2024 },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    path.join(outDir, "calibration-2023.json"),
    JSON.stringify(result.metrics2023.calibration, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "calibration-2024.json"),
    JSON.stringify(result.metrics2024.calibration, null, 2) + "\n",
  );
  writeFileSync(
    path.join(outDir, "diagnostics.json"),
    JSON.stringify(
      {
        extremes2023: result.extremes2023,
        extremes2024: result.extremes2024,
        strata2023: result.strata2023,
        lowInfo2023: result.lowInfo2023,
        lowInfo2024: result.lowInfo2024,
        nullReproduction2023: result.nullReproduction2023,
        lowScore2023: result.metrics2023.scorelineObservedVsPredicted,
        lowScore2024: result.metrics2024.scorelineObservedVsPredicted,
        totalHistogram2023: result.metrics2023.totalHistogram,
        totalHistogram2024: result.metrics2024.totalHistogram,
        dispersion2023: result.metrics2023.dispersion,
        dispersion2024: result.metrics2024.dispersion,
        g1Dispersion2024: result.common2024.g1.dispersion,
      },
      null,
      2,
    ) + "\n",
  );

  const report = {
    protocolDigest: result.protocolDigest,
    resultDigest: result.resultDigest,
    selectedBeta: result.selectedBeta,
    empiricalOpponentCenter: result.empiricalOpponentCenter,
    reproducible,
    nullReproduction2023: result.nullReproduction2023,
    holdout2025: { predictions: 0, metrics: false, parameterChoice: false },
    predictionDigests: { "2023": dig23, "2024": dig24 },
    development2023: {
      eligibleN: result.metrics2023.eligibleN,
      jointLL: result.metrics2023.distribution?.jointScoreLogLoss,
      common: {
        n: result.common2023.commonN,
        g0Joint: result.common2023.g0.distribution?.jointScoreLogLoss,
        g1Joint: result.common2023.g1.distribution?.jointScoreLogLoss,
        g3Joint: result.common2023.g3.distribution?.jointScoreLogLoss,
        deltaG3MinusG1: result.common2023.deltaG3MinusG1,
      },
    },
    confirmatory2024: {
      eligibleN: result.metrics2024.eligibleN,
      jointLL: result.metrics2024.distribution?.jointScoreLogLoss,
      common: {
        n: result.common2024.commonN,
        g0Joint: result.common2024.g0.distribution?.jointScoreLogLoss,
        g1Joint: result.common2024.g1.distribution?.jointScoreLogLoss,
        g3Joint: result.common2024.g3.distribution?.jointScoreLogLoss,
        deltaG3MinusG1: result.common2024.deltaG3MinusG1,
        g1O25: result.common2024.g1.markets.O25,
        g3O25: result.common2024.g3.markets.O25,
        g1O05: result.common2024.g1.markets.O05,
        g3O05: result.common2024.g3.markets.O05,
        g1BTTS: result.common2024.g1.markets.BTTS_YES,
        g3BTTS: result.common2024.g3.markets.BTTS_YES,
      },
    },
  };
  writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );

  console.log(
    JSON.stringify({ phase: "EVALUATION_COMPLETE", ...report, outDir }, null, 2),
  );
}

main();
