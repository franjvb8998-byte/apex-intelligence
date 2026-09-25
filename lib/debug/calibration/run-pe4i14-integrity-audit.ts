/**
 * PE-4I.14 — Offline full acquisition / dataset integrity audit CLI.
 * ZERO provider / HTTP / Supabase calls.
 *
 *   npx tsx lib/debug/calibration/run-pe4i14-integrity-audit.ts
 */

import {
  pe4I14ArtifactDir,
  pe4I14LocalCachePresent,
  runPe4I14IntegrityAudit,
} from "@/lib/debug/calibration/pe4-acquisition/pe4i14-integrity-audit";
import { PE3C_C0_RECON_ACTIVATION } from "@/lib/prematch-lifecycle/pe3-activation";

function main(): void {
  if (!pe4I14LocalCachePresent()) {
    console.error(
      JSON.stringify(
        {
          error: "LOCAL_CACHE_MISSING",
          hint: "Requires stage1-i5 queue + bulk manifest under data/calibration/pe4-acquisition-v1/",
          providerCallsMade: 0,
        },
        null,
        2,
      ),
    );
    process.exit(2);
  }

  const report = runPe4I14IntegrityAudit({
    writeArtifacts: true,
    compareRuns: true,
  });

  const summary = {
    phase: report.phase,
    providerCallsMade: report.providerCallsMade,
    preflightPass: report.preflight.pass,
    PE3C_C0_RECON_ACTIVATION,
    queueDigest: report.A_queue.digest,
    queueSize: report.A_queue.size,
    cacheHits: report.preflight.statisticsCacheHits,
    uncached: report.preflight.uncached,
    joinMissing: report.D_join.missingEnvelope,
    calendar2025: report.F_calendar2025.calendar2025AmongCachedQueue,
    holdoutStatus: report.F_calendar2025.holdoutStatus,
    callLineageSum: report.J_callAccounting.lineageSumIncludingSmokeStats,
    callLineageCoherent: report.J_callAccounting.coherentWith1094,
    reproducibilityDigest: report.I_reproducibility.contentDigest,
    runComparedEqual: report.I_reproducibility.runComparedEqual,
    productionBoundaryPass: report.productionBoundary.pass,
    blockers: report.blockers,
    checkpointReady: report.checkpointReady,
    finalVerdict: report.finalVerdict,
    artifactDir: pe4I14ArtifactDir().replace(/\\/g, "/"),
    reportPath: report.I_reproducibility.artifactPath,
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (!report.preflight.pass || report.finalVerdict === "NOT_READY") {
    process.exit(1);
  }
}

main();
