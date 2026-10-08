/**
 * PE-4I.18 — CLI: offline feature presence / redundancy / collinearity audit.
 * Zero provider / HTTP / Supabase. No fitting / labels-as-predictors / odds/EV.
 */

import {
  digestPe4I18Protocol,
  pe4I18Protocol,
} from "@/lib/debug/calibration/pe4-as-of-t-features/pe4i18-protocol";
import { runPe4I18StructureAudit } from "@/lib/debug/calibration/pe4-as-of-t-features/structure-audit-run";

async function main(): Promise<void> {
  try {
    const result = await runPe4I18StructureAudit({ writeArtifacts: true });
    const summary = {
      phase: "PE-4I.18",
      protocol: pe4I18Protocol(),
      protocolDigest: digestPe4I18Protocol(),
      providerCallsMade: result.providerCallsMade,
      noFeatureVsOutcomeStats: result.noFeatureVsOutcomeStats,
      datasetIdentity: result.datasetIdentity,
      candidateFeatureCount: result.candidateFeatureCount,
      identifiersExcludedCount: result.identifiersExcluded.length,
      presenceSummary: result.presenceAudit.summary,
      varianceCounts: result.constantNearConstantAudit.countsByClass,
      constantExamples: result.constantNearConstantAudit.constantExamples,
      nearConstantExamples:
        result.constantNearConstantAudit.nearConstantExamples,
      exactRedundancyByReason: result.exactRedundancyAudit.byReason,
      exactKeyPairs: result.exactRedundancyAudit.keyPairs.slice(0, 15),
      correlationBandCounts: result.correlationAudit.bandCounts,
      topExtremePairs: result.correlationAudit.topExtremePairs.slice(0, 15),
      windowRedundancySummary: result.windowRedundancyAudit.summary,
      venueModeDepths: result.venueModeAudit.depths,
      featureFamilyMatrix: result.featureFamilyMatrix.families,
      opponentStrengthStatus:
        result.featureFamilyMatrix.opponentStrengthStatus,
      xgHeterogeneity: {
        anyXgPresentShare: result.xgHeterogeneity.anyXgPresentShare,
        note: result.xgHeterogeneity.note,
      },
      sparseHistoryOverall: result.sparseHistoryAudit.overall,
      targetLabelFirewall: result.targetLabelFirewall,
      holdout2025Firewall: result.holdout2025Firewall,
      reproducibility: result.reproducibility,
      auditDigest: result.auditDigest,
      artifactDirRelative: result.artifactDirRelative,
      artifactsWritten: result.artifactsWritten,
      note: "Structural presence/redundancy/collinearity only — does NOT prove predictive value, select windows, or unseal 2025.",
    };
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          phase: "PE-4I.18",
          error: err instanceof Error ? err.message : String(err),
          providerCallsMade: 0,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}

void main();
