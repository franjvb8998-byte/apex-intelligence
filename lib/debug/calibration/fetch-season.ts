/**
 * Unpaged league+season fixture fetch for the debug collector.
 * Proven contract: GET /fixtures?league&season with no page.
 */

import type { ApiFootballFixturesResponse } from "@/lib/data-platform/providers/api-football/types";
import {
  assertSeasonListCompleteForCalibration,
  IncompleteSeasonListError,
} from "@/lib/debug/calibration/collector-integrity";
import { reconstructionFixtureFromVendor } from "@/lib/debug/calibration/vendor-map";
import { dedupeReconstructionFixtures } from "@/lib/debug/calibration/reconstruct";
import { assertCalibrationFixtureEnvelope } from "@/lib/debug/calibration/season-contract";
import type { ReconstructionFixture, SeasonListPaging } from "@/lib/debug/calibration/types";

export type FixtureSeasonTransport = {
  getFixtures(
    league: string,
    season: string,
  ): Promise<ApiFootballFixturesResponse>;
};

function readPaging(payload: ApiFootballFixturesResponse): SeasonListPaging {
  const paging = payload.paging;
  if (
    paging == null ||
    !Number.isFinite(paging.current) ||
    !Number.isFinite(paging.total)
  ) {
    throw new IncompleteSeasonListError(
      "Season list paging.current / paging.total is missing",
    );
  }
  return { current: paging.current, total: paging.total };
}

export async function fetchCompleteSeasonFixtures(input: {
  transport: FixtureSeasonTransport;
  leagueId: string;
  season: string;
  onOriginCall?: () => void;
}): Promise<{
  fixtures: ReconstructionFixture[];
  paging: SeasonListPaging;
  /** Always 1: one unpaged season response, not pages traversed. */
  pageCount: number;
  beforeCount: number;
  afterCount: number;
}> {
  input.onOriginCall?.();
  const payload = await input.transport.getFixtures(input.leagueId, input.season);
  assertCalibrationFixtureEnvelope(payload);
  const paging = readPaging(payload);
  assertSeasonListCompleteForCalibration(paging);
  const mapped = (payload.response ?? []).map(reconstructionFixtureFromVendor);
  const deduped = dedupeReconstructionFixtures(mapped);
  return {
    fixtures: deduped.fixtures,
    paging,
    pageCount: 1,
    beforeCount: deduped.beforeCount,
    afterCount: deduped.afterCount,
  };
}
