/**
 * PE-4I.4 — Bulk acquisition plan CLI. Offline only. Zero provider calls.
 *
 *   npm run calibration:pe4i4-bulk-plan
 */

import {
  buildPe4I4BulkAcquisitionPlan,
} from "@/lib/debug/calibration/pe4-acquisition/bulk-plan";
import {
  PE4I2_LIVE_CONFIRM_FLAG,
  PE4I2_LIVE_EXECUTE_FLAG,
} from "@/lib/debug/calibration/pe4-acquisition/protocol";
import { refusePe4I4LiveBulkExecution } from "@/lib/debug/calibration/pe4-acquisition/stages";

function main(): void {
  if (
    process.argv.includes(PE4I2_LIVE_EXECUTE_FLAG) ||
    process.argv.includes(PE4I2_LIVE_CONFIRM_FLAG) ||
    process.argv.includes("--execute-stage1") ||
    process.argv.includes("--execute-stage2")
  ) {
    console.error(
      JSON.stringify({
        error: "PE-4I.4 CLI refuses live / stage execution flags",
        refused: refusePe4I4LiveBulkExecution(),
      }),
    );
    process.exitCode = 1;
    return;
  }

  const plan = buildPe4I4BulkAcquisitionPlan();
  console.log(
    JSON.stringify(
      {
        phase: "PE4I4_BULK_ACQUISITION_PLAN",
        planVersion: plan.planVersion,
        protocolDigest: plan.protocolDigest,
        planDigest: plan.planDigest,
        targetSeasons: plan.targetSeasons,
        uniqueClubs2023: plan.uniqueClubs2023.length,
        uniqueClubs2024: plan.uniqueClubs2024.length,
        clubSeasonUnits: plan.clubSeasonUnits.length,
        cachedScheduleUnits: plan.cachedScheduleUnits,
        missingScheduleUnits: plan.missingScheduleUnits,
        estimatedScheduleCalls: plan.estimatedScheduleCalls,
        pe4i3Cache: plan.pe4i3Cache,
        estimates: plan.estimates,
        stage1: plan.stage1,
        stage2: plan.stage2,
        recommendedScheduleBatchBudget: plan.recommendedScheduleBatchBudget,
        recommendedStatisticsBatchBudget:
          plan.recommendedStatisticsBatchBudget,
        providerDailyAllowanceContext: plan.providerDailyAllowanceContext,
        xgStatus: plan.xgStatus,
        holdoutSeason: plan.holdoutSeason,
        liveBulk: plan.liveBulk,
        providerCallsMade: plan.providerCallsMade,
        liveEnabled: plan.liveEnabled,
      },
      null,
      2,
    ),
  );
}

main();
