/**
 * Immutable prospective prediction records. Scoring is a separate step.
 */

import { impliedProbabilitiesFromDecimalOdds } from "@/lib/debug/calibration/bookmaker";
import { CANDIDATE_MANIFEST_FINGERPRINT } from "@/lib/debug/calibration/prospective/candidate-config";
import { predictCandidate } from "@/lib/debug/calibration/prospective/candidate-engine";
import {
  assertEvidenceBeforeKickoff,
  assertKickoffAfterCapture,
  assertManifestFingerprint,
  assertNotUsedHistoricalSeason,
  assertUniqueFixtureCandidate,
  assertUnscoredRecord,
  evidenceWithoutOutcomes,
} from "@/lib/debug/calibration/prospective/candidate-integrity";
import type {
  ProspectiveCandidateId,
  ProspectiveEvidence,
  ProspectiveOdds,
  ProspectivePredictionRecord,
} from "@/lib/debug/calibration/prospective/candidate-types";

export type CaptureInput = {
  evidence: ProspectiveEvidence;
  capturedAt: string;
  candidateId: ProspectiveCandidateId;
  odds?: ProspectiveOdds | null;
};

export function capturePrediction(
  input: CaptureInput,
  seen: Set<string> = new Set(),
): ProspectivePredictionRecord {
  const evidence = evidenceWithoutOutcomes(input.evidence);
  assertNotUsedHistoricalSeason(evidence.season);
  assertKickoffAfterCapture(evidence.kickoff, input.capturedAt);
  assertEvidenceBeforeKickoff(evidence.evidenceAsOf, evidence.kickoff);
  assertUniqueFixtureCandidate(seen, evidence.fixtureId, input.candidateId);
  assertManifestFingerprint(CANDIDATE_MANIFEST_FINGERPRINT);

  const prediction = predictCandidate(input.candidateId, evidence);
  const impliedRaw =
    input.odds == null
      ? null
      : impliedProbabilitiesFromDecimalOdds({
          homeOdds: input.odds.home,
          drawOdds: input.odds.draw,
          awayOdds: input.odds.away,
        });
  const implied = impliedRaw?.normalized ?? null;

  const record: ProspectivePredictionRecord = {
    fixtureId: evidence.fixtureId,
    competitionId: evidence.competitionId,
    season: evidence.season,
    kickoff: evidence.kickoff,
    capturedAt: input.capturedAt,
    modelVersion: prediction.modelVersion,
    candidateId: prediction.candidateId,
    candidateVersion: prediction.candidateVersion,
    candidateFingerprint: prediction.candidateFingerprint,
    inputEvidenceCounts: {
      homePlayedBefore: evidence.homePlayedBefore,
      awayPlayedBefore: evidence.awayPlayedBefore,
    },
    homeElo: prediction.homeElo,
    awayElo: prediction.awayElo,
    eloGap: prediction.eloGap,
    lambdaHome: prediction.lambdaHome,
    lambdaAway: prediction.lambdaAway,
    probHome: prediction.oneXTwo.home,
    probDraw: prediction.oneXTwo.draw,
    probAway: prediction.oneXTwo.away,
    confidence: prediction.confidence,
    odds: input.odds ?? null,
    marketImpliedProbabilities: implied,
    resultStatus: "PENDING",
    finalHomeGoals: null,
    finalAwayGoals: null,
    scoredAt: null,
  };
  assertUnscoredRecord(record);
  seen.add(`${evidence.fixtureId}::${input.candidateId}`);
  return record;
}

export function scorePredictionRecord(input: {
  record: ProspectivePredictionRecord;
  finalHomeGoals: number;
  finalAwayGoals: number;
  scoredAt: string;
}): ProspectivePredictionRecord {
  assertNotUsedHistoricalSeason(input.record.season);
  if (input.record.resultStatus !== "PENDING") {
    throw new Error("only PENDING records can be scored");
  }
  return {
    ...input.record,
    resultStatus: "FINAL",
    finalHomeGoals: input.finalHomeGoals,
    finalAwayGoals: input.finalAwayGoals,
    scoredAt: input.scoredAt,
  };
}
