import { cache } from "react";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { leagueOptions } from "@/lib/apex-opportunities/filters";
import { loadUnlessQuota } from "@/lib/repositories";
import { countryOptions } from "@/lib/opportunity-scanner/country";
import { teamOptions } from "@/lib/opportunity-scanner/filters";
import { buildScannerRankings } from "@/lib/opportunity-scanner/ranking";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ScannerRankingBoard } from "@/lib/opportunity-scanner/ranking";

export type OpportunityScannerLoad = {
  analyzed: ApexOpportunity[];
  generatedAt: string;
  leagues: string[];
  countries: string[];
  teams: string[];
  rankings: ScannerRankingBoard[];
  quotaExhausted: boolean;
};

export const loadOpportunityScanner = cache(
  async (): Promise<OpportunityScannerLoad> => {
    const loaded = await loadUnlessQuota(() => getApexOpportunities());
    if (!loaded.ok) {
      const generatedAt = new Date().toISOString();
      return {
        analyzed: [],
        generatedAt,
        leagues: [],
        countries: [],
        teams: [],
        rankings: buildScannerRankings([]),
        quotaExhausted: true,
      };
    }
    const analyzed = loaded.data.analyzed;
    return {
      analyzed,
      generatedAt: loaded.data.generatedAt,
      leagues: leagueOptions(analyzed),
      countries: countryOptions(analyzed),
      teams: teamOptions(analyzed),
      rankings: buildScannerRankings(analyzed),
      quotaExhausted: false,
    };
  },
);
