import { cache } from "react";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { getMockBankroll } from "@/lib/bankroll";
import { loadBankrollFixtures } from "@/lib/bankroll/load-fixtures";
import type { BankrollData, BankrollFixture } from "@/lib/bankroll/types";
import { loadDashboardWorkspace } from "@/lib/dashboard";
import type { DashboardData } from "@/lib/dashboard/types";
import { loadUnlessQuota } from "@/lib/repositories";
import {
  fixtureIdFromMatch,
  matchAnalysisHref,
} from "@/lib/match-center/fixture-id";
import type { MatchCenterAbsence } from "@/lib/match-center/types";
import { buildPortfolioReport } from "@/lib/portfolio/build";
import type { PortfolioReport } from "@/lib/portfolio/types";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

export type FeedMarketLoad =
  | {
      ok: true;
      analyzed: ApexOpportunity[];
      generatedAt: string;
    }
  | { ok: false; quota: boolean };

export type FeedDeskLoad = {
  dashboard: DashboardData;
  injuries: MatchCenterAbsence[];
  suspensions: MatchCenterAbsence[];
  featuredHref: string | null;
  featuredLabel: string | null;
  quotaExhausted: boolean;
};

export type FeedBookLoad = {
  data: BankrollData;
  fixtures: BankrollFixture[];
  report: PortfolioReport;
};

export const loadFeedMarket = cache(async (): Promise<FeedMarketLoad> => {
  const loaded = await loadUnlessQuota(() => getApexOpportunities());
  if (!loaded.ok) return { ok: false, quota: true };
  return {
    ok: true,
    analyzed: loaded.data.analyzed,
    generatedAt: loaded.data.generatedAt,
  };
});

export const loadFeedDesk = cache(async (): Promise<FeedDeskLoad> => {
  const { dashboard, matchCenter, quotaExhausted } =
    await loadDashboardWorkspace();
  const preview = matchCenter?.preview.dashboard;
  const featuredId = matchCenter
    ? fixtureIdFromMatch({
        id: matchCenter.match.matchId,
        externalId: matchCenter.match.externalId,
      })
    : dashboard.featuredMatchId
      ? fixtureIdFromMatch({
          id: dashboard.featuredMatchId,
          externalId: dashboard.featuredMatchId,
        })
      : null;
  return {
    dashboard,
    injuries: preview?.injuries ?? [],
    suspensions: preview?.suspensions ?? [],
    featuredHref: featuredId ? matchAnalysisHref(featuredId) : "/match-center",
    featuredLabel: matchCenter
      ? `${matchCenter.match.homeTeam.shortName} vs ${matchCenter.match.awayTeam.shortName}`
      : null,
    quotaExhausted,
  };
});

export const loadFeedBook = cache(async (): Promise<FeedBookLoad> => {
  const data = getMockBankroll();
  let fixtures: BankrollFixture[] = [];
  try {
    fixtures = await loadBankrollFixtures();
  } catch {
    fixtures = [];
  }
  const market = await loadFeedMarket();
  return {
    data,
    fixtures,
    report: buildPortfolioReport(
      data,
      fixtures,
      market.ok ? market.analyzed : [],
    ),
  };
});
