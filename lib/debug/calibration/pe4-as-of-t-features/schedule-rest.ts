/**
 * PE-4I.15 — Schedule / rest feature family contract (declarative).
 * No fatigue multiplier / G1 mutation.
 */

import { PE4I2_FUTURE_SCHEDULE_ANTICIPATION } from "@/lib/debug/calibration/pe4-acquisition/temporal";

export type Pe4I15ScheduleRestContract = {
  familyId: "schedule_rest";
  futureScheduleAnticipation: typeof PE4I2_FUTURE_SCHEDULE_ANTICIPATION;
  restComputedFromPastKickoffsOnly: true;
  crossCompetitionRequiredForHonestLoad: true;
  asOfTSnapshotRequiredForFutureFixtures: true;
  rollingWindowsDays: readonly [7, 14, 28];
  metricsDeclared: readonly [
    "hours_since_last_match",
    "matches_in_last_7d",
    "matches_in_last_14d",
    "matches_in_last_28d",
  ];
  missingCorpusBehavior: "FAMILY_UNAVAILABLE";
  noFatigueMultiplier: true;
  noG1Mutation: true;
};

export const PE4I15_SCHEDULE_REST_CONTRACT: Pe4I15ScheduleRestContract = {
  familyId: "schedule_rest",
  futureScheduleAnticipation: PE4I2_FUTURE_SCHEDULE_ANTICIPATION,
  restComputedFromPastKickoffsOnly: true,
  crossCompetitionRequiredForHonestLoad: true,
  asOfTSnapshotRequiredForFutureFixtures: true,
  rollingWindowsDays: [7, 14, 28],
  metricsDeclared: [
    "hours_since_last_match",
    "matches_in_last_7d",
    "matches_in_last_14d",
    "matches_in_last_28d",
  ],
  missingCorpusBehavior: "FAMILY_UNAVAILABLE",
  noFatigueMultiplier: true,
  noG1Mutation: true,
};
