/**
 * PE-4I.17 — SEPARATE outcome labels artifact keyed by fixtureId.
 * NEVER read during feature construction. Labels are post-emit only.
 */

import { createHash } from "node:crypto";
import type { Pe4I15HistoricalMatchLedgerRow } from "@/lib/debug/calibration/pe4-as-of-t-features/ledger";

export type Pe4I17OutcomeLabel = {
  fixtureId: string;
  kickoffUtc: string;
  competition: string;
  providerSeason: string;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
  /** Regulation outcome encoding for research labels only. */
  homeResult: "W" | "D" | "L" | null;
  awayResult: "W" | "D" | "L" | null;
};

export type Pe4I17OutcomeLabelsArtifact = {
  protocolNote: "SEPARATED_FROM_FEATURE_CONSTRUCTION_NEVER_READ_DURING_EMIT";
  labelCount: number;
  labelsByFixtureId: Record<string, Pe4I17OutcomeLabel>;
  digest: string;
};

function resultFor(
  gf: number,
  ga: number,
): "W" | "D" | "L" {
  if (gf > ga) return "W";
  if (gf < ga) return "L";
  return "D";
}

/**
 * Build labels ONLY from already-eligible DEV targets.
 * Feature builders must not import or call this during vector construction.
 */
export function buildSeparatedOutcomeLabels(
  eligibleTargets: readonly Pe4I15HistoricalMatchLedgerRow[],
): Pe4I17OutcomeLabelsArtifact {
  const labelsByFixtureId: Record<string, Pe4I17OutcomeLabel> = {};
  const sorted = [...eligibleTargets].sort((a, b) =>
    a.fixtureId.localeCompare(b.fixtureId),
  );

  for (const row of sorted) {
    const hg =
      row.home.goals.presence === "present" ? row.home.goals.value : null;
    const ag =
      row.away.goals.presence === "present" ? row.away.goals.value : null;
    labelsByFixtureId[row.fixtureId] = {
      fixtureId: row.fixtureId,
      kickoffUtc: row.kickoffUtc,
      competition: row.competition,
      providerSeason: row.providerSeason,
      status: row.status,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homeGoals: hg,
      awayGoals: ag,
      homeResult:
        hg != null && ag != null ? resultFor(hg, ag) : null,
      awayResult:
        hg != null && ag != null ? resultFor(ag, hg) : null,
    };
  }

  const digestMaterial = JSON.stringify(
    sorted.map((r) => labelsByFixtureId[r.fixtureId]),
  );
  const digest = createHash("sha256")
    .update(digestMaterial, "utf8")
    .digest("hex");

  return {
    protocolNote: "SEPARATED_FROM_FEATURE_CONSTRUCTION_NEVER_READ_DURING_EMIT",
    labelCount: sorted.length,
    labelsByFixtureId,
    digest,
  };
}

/**
 * Guard used by tests: feature construction modules must not reference
 * outcome-labels during vector emit. This helper only mutates the labels
 * artifact in memory — never feeds back into features.
 */
export function mutateSeparatedLabelGoals(
  artifact: Pe4I17OutcomeLabelsArtifact,
  fixtureId: string,
  homeGoals: number,
  awayGoals: number,
): Pe4I17OutcomeLabelsArtifact {
  const prev = artifact.labelsByFixtureId[fixtureId];
  if (!prev) return artifact;
  const nextLabel: Pe4I17OutcomeLabel = {
    ...prev,
    homeGoals,
    awayGoals,
    homeResult: resultFor(homeGoals, awayGoals),
    awayResult: resultFor(awayGoals, homeGoals),
  };
  const labelsByFixtureId = {
    ...artifact.labelsByFixtureId,
    [fixtureId]: nextLabel,
  };
  const digest = createHash("sha256")
    .update(
      JSON.stringify(
        Object.keys(labelsByFixtureId)
          .sort()
          .map((k) => labelsByFixtureId[k]),
      ),
      "utf8",
    )
    .digest("hex");
  return {
    ...artifact,
    labelsByFixtureId,
    digest,
  };
}
