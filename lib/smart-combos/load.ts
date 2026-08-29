import { cache } from "react";
import { getApexOpportunities } from "@/lib/apex-opportunities/load";
import { loadUnlessQuota } from "@/lib/repositories";
import { buildDailySmartCombos } from "@/lib/smart-combos/daily";
import { legsFromOpportunities, uniqueLeagues } from "@/lib/smart-combos/legs";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ComboLeg, DailySmartCombosBoard } from "@/lib/smart-combos/types";

export type SmartCombosDeskLoad = {
  analyzed: ApexOpportunity[];
  legs: ComboLeg[];
  leagues: string[];
  generatedAt: string;
  daily: DailySmartCombosBoard;
  quotaExhausted: boolean;
};

export const loadSmartCombosDesk = cache(
  async (): Promise<SmartCombosDeskLoad> => {
    const loaded = await loadUnlessQuota(() => getApexOpportunities());
    if (!loaded.ok) {
      const generatedAt = new Date().toISOString();
      return {
        analyzed: [],
        legs: [],
        leagues: [],
        generatedAt,
        daily: {
          generatedAt,
          items: [],
          unavailable: [
            {
              kind: "conservative",
              reason:
                "API-Football quota is exhausted. The combo desk stays open with an empty scan.",
            },
          ],
        },
        quotaExhausted: true,
      };
    }
    const analyzed = loaded.data.analyzed;
    return {
      analyzed,
      legs: legsFromOpportunities(analyzed),
      leagues: uniqueLeagues(analyzed),
      generatedAt: loaded.data.generatedAt,
      daily: buildDailySmartCombos(analyzed, loaded.data.generatedAt),
      quotaExhausted: false,
    };
  },
);
