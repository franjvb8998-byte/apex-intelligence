/**
 * Orchestrate a leakage-safe microcollection through an injected transport.
 * Origin calls happen only after live authorization when using the live factory.
 */

import { apiFootballVendorErrorText } from "@/lib/data-platform/providers/api-football/cache-policy";
import type { ApiFootballOddsResponse } from "@/lib/data-platform/providers/api-football/types";
import { buildCalibrationRow } from "@/lib/debug/calibration/reconstruct";
import { createCollectionRunMetadata } from "@/lib/debug/calibration/collector-integrity";
import { fetchCompleteSeasonFixtures } from "@/lib/debug/calibration/fetch-season";
import type { FixtureSeasonTransport } from "@/lib/debug/calibration/fetch-season";
import { assertReconstructionHasNoFuturePriors } from "@/lib/debug/calibration/leakage";
import {
  assertLiveCollectionAuthorized,
  planMicrocollectionLogicalCalls,
} from "@/lib/debug/calibration/live-guard";
import {
  MICROCOLLECTION_CATEGORY,
  MICROCOLLECTION_FIXTURE_LIST_LOGICAL_CALLS,
  MICROCOLLECTION_LEAGUE_ID,
  MICROCOLLECTION_LEAGUE_NAME,
  MICROCOLLECTION_SEASON,
  MICROCOLLECTION_TARGET_COUNT,
  MICROCOLLECTION_VERSION,
} from "@/lib/debug/calibration/micro-shape";
import { writeCalibrationArtifacts } from "@/lib/debug/calibration/persist";
import { assertMicrocollectionTargetContract } from "@/lib/debug/calibration/season-contract";
import { selectMicrocollectionTargets } from "@/lib/debug/calibration/select-targets";
import { extractOneXTwoOdds } from "@/lib/debug/calibration/vendor-map";
import type { CalibrationRow, CollectionRunMetadata } from "@/lib/debug/calibration/types";

export type MicrocollectTransport = FixtureSeasonTransport & {
  getFixtureOdds?(fixtureId: string): Promise<ApiFootballOddsResponse>;
};

export type MicrocollectResult = {
  rows: CalibrationRow[];
  metadata: CollectionRunMetadata;
  logicalCallCount: number;
  /** Historical alias of logicalCallCount. */
  originCallCount: number;
  paths?: { datasetPath: string; metadataPath: string };
};

export class MicrocollectOddsLookupError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "MicrocollectOddsLookupError";
  }
}

async function attachOdds(
  targets: CalibrationRow[],
  transport: MicrocollectTransport,
  onLogicalCall?: () => void,
): Promise<CalibrationRow[]> {
  if (!transport.getFixtureOdds) return targets;
  const out: CalibrationRow[] = [];
  for (const row of targets) {
    onLogicalCall?.();
    let payload: ApiFootballOddsResponse;
    try {
      payload = await transport.getFixtureOdds(row.fixtureId);
    } catch (error) {
      throw new MicrocollectOddsLookupError(
        `Fixture odds lookup failed for fixture ${row.fixtureId}; aborting microcollection (provider failure is not treated as missing odds)`,
        { cause: error },
      );
    }
    const errorText = apiFootballVendorErrorText(payload);
    if (errorText) {
      throw new MicrocollectOddsLookupError(
        `Fixture odds envelope errors are non-empty for fixture ${row.fixtureId}; aborting (vendor errors are not treated as missing odds): ${errorText}`,
      );
    }
    const extracted = extractOneXTwoOdds(payload);
    out.push({
      ...row,
      bookmaker: extracted?.bookmaker ?? null,
      market: extracted ? "1x2" : null,
      homeOdds: extracted?.homeOdds ?? null,
      drawOdds: extracted?.drawOdds ?? null,
      awayOdds: extracted?.awayOdds ?? null,
      oddsObservedAt: extracted?.vendorUpdateAt ?? null,
      oddsTiming: "unknown",
    });
  }
  return out;
}

export async function collectMicrodataset(input: {
  transport: MicrocollectTransport;
  includeOdds?: boolean;
  writeArtifacts?: boolean;
  artifactDirectory?: string;
  collectionTimestamp?: string;
  expectedTargetCount?: number;
  /**
   * Intentional short run only. Live CLI does not set this.
   * Default refuses selected < expectedTargetCount (15).
   */
  allowShortfall?: boolean;
}): Promise<MicrocollectResult> {
  let logicalCallCount = 0;
  const onLogicalCall = () => {
    logicalCallCount += 1;
  };
  const expectedTargetCount =
    input.expectedTargetCount ?? MICROCOLLECTION_TARGET_COUNT;
  planMicrocollectionLogicalCalls({
    targetCount: expectedTargetCount,
    includeOdds: input.includeOdds !== false,
  });
  const season = await fetchCompleteSeasonFixtures({
    transport: input.transport,
    leagueId: MICROCOLLECTION_LEAGUE_ID,
    season: MICROCOLLECTION_SEASON,
    onOriginCall: onLogicalCall,
  });
  const selected = selectMicrocollectionTargets(
    season.fixtures,
    expectedTargetCount,
  );
  assertMicrocollectionTargetContract({
    fixtureCount: season.afterCount,
    eligibleCount: selected.eligibleCount,
    selectedCount: selected.targets.length,
    expectedTargetCount,
    allowShortfall: input.allowShortfall,
  });
  const unlabeled = selected.targets.map((target) => {
    assertReconstructionHasNoFuturePriors({
      target,
      fixtures: season.fixtures,
    });
    return buildCalibrationRow({
      target,
      fixtures: season.fixtures,
      category: MICROCOLLECTION_CATEGORY,
    });
  });
  const rows =
    input.includeOdds === false
      ? unlabeled
      : await attachOdds(unlabeled, input.transport, onLogicalCall);
  const metadata = createCollectionRunMetadata({
    selectedLeagueSeasons: [
      {
        leagueId: MICROCOLLECTION_LEAGUE_ID,
        season: MICROCOLLECTION_SEASON,
        pageCount: 1,
      },
    ],
    fixtureCountBeforeDedupe: season.beforeCount,
    fixtureCountAfterDedupe: season.afterCount,
    rows,
    collectionTimestamp: input.collectionTimestamp ?? new Date().toISOString(),
    selectionRule: selected.selectionRule,
    requestedTargetCount: expectedTargetCount,
    fixtureListLogicalCalls: MICROCOLLECTION_FIXTURE_LIST_LOGICAL_CALLS,
    oddsLogicalCalls: input.includeOdds === false ? 0 : rows.length,
    logicalCallCount,
    leagueName: MICROCOLLECTION_LEAGUE_NAME,
    collectorVersion: MICROCOLLECTION_VERSION,
  });

  let paths: MicrocollectResult["paths"];
  if (input.writeArtifacts) {
    paths = writeCalibrationArtifacts({
      rows,
      metadata,
      directory: input.artifactDirectory,
    });
  }
  return {
    rows,
    metadata,
    logicalCallCount,
    originCallCount: logicalCallCount,
    paths,
  };
}

export async function runAuthorizedMicrocollection(input: {
  env: Record<string, string | undefined>;
  argv: readonly string[];
  transport: MicrocollectTransport;
  artifactDirectory?: string;
}): Promise<MicrocollectResult> {
  assertLiveCollectionAuthorized(input.env, input.argv);
  return collectMicrodataset({
    transport: input.transport,
    includeOdds: true,
    writeArtifacts: true,
    artifactDirectory: input.artifactDirectory,
  });
}

export async function reportMicrocollectCliResult(
  run: () => Promise<MicrocollectResult>,
): Promise<void> {
  try {
    const result = await run();
    console.log(
      JSON.stringify(
        {
          rows: result.rows.length,
          logicalCallCount: result.logicalCallCount,
          originCallCount: result.originCallCount,
          callBudgetKind: result.metadata.callBudgetKind,
          datasetPath: result.paths?.datasetPath ?? null,
          metadataPath: result.paths?.metadataPath ?? null,
          oddsTiming: result.metadata.oddsTimingClassification,
        },
        null,
        2,
      ),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
