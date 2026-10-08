/**
 * PE-4I.16 — CLI: offline ledger materialization + demo feature vectors.
 * Zero provider / HTTP / Supabase. No fitting / metrics.
 */

import { runPe4I16OfflineDemo } from "@/lib/debug/calibration/pe4-as-of-t-features/demo";
import { pe4I16LocalCachePresent } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger-materialize";
import { digestPe4I16Protocol, pe4I16Protocol } from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i16-protocol";

function main(): void {
  if (!pe4I16LocalCachePresent()) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          reason: "offline_cache_incomplete",
          detail:
            "Requires Stage-1 universe + 1094/1094 statistics cache under data/calibration/pe4-acquisition-v1/",
          providerCallsMade: 0,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const demo = runPe4I16OfflineDemo({ writeArtifacts: true, limit: 3 });
  const summary = {
    phase: "PE-4I.16",
    protocol: pe4I16Protocol(),
    protocolDigest: digestPe4I16Protocol(),
    providerCallsMade: demo.providerCallsMade,
    noMetricsComputed: demo.noMetricsComputed,
    fixtureIdsUsed: demo.fixtureIdsUsed,
    materialization: demo.materialization,
    teamPerspectiveCounts: demo.teamPerspectiveCounts,
    vectorSummaries: demo.vectors.map((v) => ({
      teamId: v.teamId,
      targetFixtureId: v.targetFixtureId,
      windowId: v.windowId,
      observationCount: v.historySelection.observationCount,
      pathAObs: v.pathA.observationCount,
      pathBAnyXg: v.pathB.anyXgPresent,
      xgMeanFor: v.pathB.expectedGoalsFor.mean,
      opponentStrength: v.opponentStrength.status,
      opponentStrengthReason:
        v.opponentStrength.status === "UNAVAILABLE"
          ? v.opponentStrength.reason
          : null,
      scheduleRest: v.scheduleRest.status,
      provenanceDigest: v.provenance.digest,
    })),
    note: demo.note,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main();
