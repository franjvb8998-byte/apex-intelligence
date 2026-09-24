/**
 * PE-4H.1 — Team-perspective match observations from canonical fixtures.
 */

import { createHash } from "node:crypto";
import { fitModelC, predictModelC } from "@/lib/debug/calibration/pe4-expectation/model-c";
import {
  fitLowInfoFallbackPrior,
  resolveHomeOrientedExpectation,
  type StrengthEvidenceQuality,
} from "@/lib/debug/calibration/pe4-expectation/low-information";
import {
  expectedTargetPoints,
  orientToTarget,
  realizedTargetPoints,
  resultResidualPoints,
  type RealizedResult,
} from "@/lib/debug/calibration/pe4-expectation/orientation";
import type { OneXTwoProb } from "@/lib/debug/calibration/pe4-expectation/metrics";
import type { ModelCArtifact } from "@/lib/debug/calibration/pe4-expectation/model-c";
import {
  PE4_FORM_SIGNAL_EXPECTATION_MODEL_VERSION,
  PE4_FORM_SIGNAL_HOLDOUT_SEASON,
  PE4_FORM_SIGNAL_REQUIRED_DATASET_DIGEST,
} from "@/lib/debug/calibration/pe4-form/protocol";
import type { Pe4ExpectationDatasetRow } from "@/lib/prematch-decision/pe4-form-schedule/expectation/dataset-types";
import type { Pe4VenueRole } from "@/lib/prematch-decision/pe4-form-schedule/types";

export type Pe4FormTeamObservation = {
  fixtureId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  teamId: string;
  opponentTeamId: string;
  venueRole: Pe4VenueRole;
  /** Strength differential from target perspective (target − opponent). */
  strengthDifferentialTarget: number;
  expectedTargetWinProbability: number;
  expectedTargetDrawProbability: number;
  expectedTargetLossProbability: number;
  expectedTargetPoints: number;
  realizedTargetPoints: number;
  resultResidualPoints: number;
  expectationModelVersion: string;
  strengthEvidenceQuality: StrengthEvidenceQuality;
  lowInformationFallbackUsed: boolean;
};

function realizedFromGoals(
  targetGoals: number,
  opponentGoals: number,
): RealizedResult {
  if (targetGoals > opponentGoals) return "WIN";
  if (targetGoals < opponentGoals) return "LOSS";
  return "DRAW";
}

function qualityFromRow(
  row: Pe4ExpectationDatasetRow,
): StrengthEvidenceQuality {
  if (row.qualityKind === "catalogue_catalogue") return "catalogue_catalogue";
  if (row.qualityKind === "base_prior_base_prior") return "both_base_prior";
  if (
    row.qualityKind === "catalogue_base_prior" ||
    row.qualityKind === "base_prior_catalogue"
  ) {
    return "mixed_source";
  }
  return "unavailable";
}

/**
 * Fit frozen PE-4G.4 Model C on eligible 2023 catalogue/catalogue rows.
 * λ=0.01 was selected in PE-4G.4 internal folds.
 */
export function fitFrozenExpectationModelC(
  train2023Eligible: readonly Pe4ExpectationDatasetRow[],
): { model: ModelCArtifact; lowInfoPrior: OneXTwoProb } {
  const model = fitModelC({ trainRows: train2023Eligible, l2Lambda: 0.01 });
  const lowInfoPrior = fitLowInfoFallbackPrior(train2023Eligible);
  return { model, lowInfoPrior };
}

export function predictHomeOrientedWithPolicy(
  model: ModelCArtifact,
  lowInfoPrior: OneXTwoProb,
  row: Pe4ExpectationDatasetRow,
): {
  homeOriented: OneXTwoProb;
  lowInformationFallbackUsed: boolean;
  strengthEvidenceQuality: StrengthEvidenceQuality;
} {
  const raw = predictModelC(model, [row])[0]!;
  const resolved = resolveHomeOrientedExpectation({
    qualityKind: row.qualityKind,
    lowInformationBothBasePrior: row.lowInformationBothBasePrior,
    modelPrediction: raw,
    lowInfoPrior,
    modelVersion: PE4_FORM_SIGNAL_EXPECTATION_MODEL_VERSION,
  });
  return {
    homeOriented: resolved.expectedOneXTwo,
    lowInformationFallbackUsed: resolved.metadata.lowInformationFallbackUsed,
    strengthEvidenceQuality: qualityFromRow(row),
  };
}

/** One fixture → exactly two team-perspective observations. */
export function buildTeamObservationsForFixture(
  row: Pe4ExpectationDatasetRow,
  model: ModelCArtifact,
  lowInfoPrior: OneXTwoProb,
): [Pe4FormTeamObservation, Pe4FormTeamObservation] {
  if (row.season === PE4_FORM_SIGNAL_HOLDOUT_SEASON) {
    throw new Error(`Holdout season fixture ${row.fixtureId} forbidden`);
  }
  const pred = predictHomeOrientedWithPolicy(model, lowInfoPrior, row);
  const p = pred.homeOriented;

  const homeOriented = orientToTarget(p, "HOME");
  const awayOriented = orientToTarget(p, "AWAY");
  const homeEp = expectedTargetPoints(homeOriented);
  const awayEp = expectedTargetPoints(awayOriented);

  const homeRealized = realizedFromGoals(row.actualHomeGoals, row.actualAwayGoals);
  const awayRealized = realizedFromGoals(row.actualAwayGoals, row.actualHomeGoals);
  const homePts = realizedTargetPoints(homeRealized);
  const awayPts = realizedTargetPoints(awayRealized);

  const homeObs: Pe4FormTeamObservation = {
    fixtureId: row.fixtureId,
    competitionId: row.competitionId,
    season: row.season,
    kickoffUtc: row.kickoffUtc,
    teamId: row.homeTeamId,
    opponentTeamId: row.awayTeamId,
    venueRole: "HOME",
    strengthDifferentialTarget: row.strengthDifferentialHome,
    expectedTargetWinProbability: homeOriented.targetWinP,
    expectedTargetDrawProbability: homeOriented.targetDrawP,
    expectedTargetLossProbability: homeOriented.targetLossP,
    expectedTargetPoints: homeEp,
    realizedTargetPoints: homePts,
    resultResidualPoints: resultResidualPoints(homeRealized, homeEp),
    expectationModelVersion: PE4_FORM_SIGNAL_EXPECTATION_MODEL_VERSION,
    strengthEvidenceQuality: pred.strengthEvidenceQuality,
    lowInformationFallbackUsed: pred.lowInformationFallbackUsed,
  };

  const awayObs: Pe4FormTeamObservation = {
    fixtureId: row.fixtureId,
    competitionId: row.competitionId,
    season: row.season,
    kickoffUtc: row.kickoffUtc,
    teamId: row.awayTeamId,
    opponentTeamId: row.homeTeamId,
    venueRole: "AWAY",
    strengthDifferentialTarget: -row.strengthDifferentialHome,
    expectedTargetWinProbability: awayOriented.targetWinP,
    expectedTargetDrawProbability: awayOriented.targetDrawP,
    expectedTargetLossProbability: awayOriented.targetLossP,
    expectedTargetPoints: awayEp,
    realizedTargetPoints: awayPts,
    resultResidualPoints: resultResidualPoints(awayRealized, awayEp),
    expectationModelVersion: PE4_FORM_SIGNAL_EXPECTATION_MODEL_VERSION,
    strengthEvidenceQuality: pred.strengthEvidenceQuality,
    lowInformationFallbackUsed: pred.lowInformationFallbackUsed,
  };

  return [homeObs, awayObs];
}

export function buildSeasonObservations(
  seasonRows: readonly Pe4ExpectationDatasetRow[],
  model: ModelCArtifact,
  lowInfoPrior: OneXTwoProb,
): Pe4FormTeamObservation[] {
  const out: Pe4FormTeamObservation[] = [];
  for (const row of seasonRows) {
    if (row.season === PE4_FORM_SIGNAL_HOLDOUT_SEASON) {
      throw new Error("Holdout season in observation builder");
    }
    const [h, a] = buildTeamObservationsForFixture(row, model, lowInfoPrior);
    out.push(h, a);
  }
  return out;
}

export function sortTeamObservations(
  obs: readonly Pe4FormTeamObservation[],
): Pe4FormTeamObservation[] {
  return [...obs].sort((a, b) => {
    const k = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (k !== 0) return k;
    const f = a.fixtureId.localeCompare(b.fixtureId);
    if (f !== 0) return f;
    return a.venueRole.localeCompare(b.venueRole);
  });
}

export function digestObservations(
  obs: readonly Pe4FormTeamObservation[],
): string {
  const lines = sortTeamObservations(obs).map(
    (o) =>
      [
        o.fixtureId,
        o.teamId,
        o.venueRole,
        o.kickoffUtc,
        o.resultResidualPoints.toFixed(8),
        o.expectedTargetPoints.toFixed(8),
        o.realizedTargetPoints,
      ].join("|"),
  );
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

export function assertDatasetDigest(digest: string): void {
  if (digest !== PE4_FORM_SIGNAL_REQUIRED_DATASET_DIGEST) {
    throw new Error(
      `Dataset digest mismatch: ${digest} vs ${PE4_FORM_SIGNAL_REQUIRED_DATASET_DIGEST}`,
    );
  }
}
