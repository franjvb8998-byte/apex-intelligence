/**
 * PE-4I.15 — Optional dry-run export of the feature construction plan.
 * Offline only. Zero provider calls. No fitting.
 */

import {
  PE4I15_AET_PEN_CONTRACT,
  PE4I15_FEATURE_FAMILY_SPECS,
  PE4I15_OPPONENT_STRENGTH_CONTRACT,
  PE4I15_SCHEDULE_REST_CONTRACT,
  PE4I15_UNSUPPORTED_FEATURES,
  PE4I15_WINDOW_CONTRACT,
  PE4I15_XG_HETEROGENEITY_CONTRACT,
  digestPe4I15Protocol,
  pe4I15Protocol,
  windowId,
} from "@/lib/debug/calibration/pe4-as-of-t-features";

function main(): void {
  const protocol = pe4I15Protocol();
  const report = {
    phase: "PE-4I.15",
    protocol,
    protocolDigest: digestPe4I15Protocol(protocol),
    windows: PE4I15_WINDOW_CONTRACT.map((w) => ({
      id: windowId(w),
      proceeds: w.proceeds,
      justification: w.justification,
    })),
    featureFamilies: PE4I15_FEATURE_FAMILY_SPECS,
    xg: PE4I15_XG_HETEROGENEITY_CONTRACT,
    aetPen: PE4I15_AET_PEN_CONTRACT,
    scheduleRest: PE4I15_SCHEDULE_REST_CONTRACT,
    opponentStrength: PE4I15_OPPONENT_STRENGTH_CONTRACT,
    unsupported: PE4I15_UNSUPPORTED_FEATURES,
    providerCallsMade: 0,
    modelingPerformed: false,
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
