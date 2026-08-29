import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DashboardMatchList } from "@/components/dashboard";
import { MatchCenterView } from "@/components/match-center/match-center-view";
import type { DashboardMatchSummary } from "@/lib/dashboard/types";
import type { MatchCenterData } from "@/lib/match-center/types";

type MatchCenterListProps = {
  matches: DashboardMatchSummary[];
};

/**
 * `/match-center` — fixture catalogue only (no Preview / Live / Post).
 */
export async function MatchCenterList({ matches }: MatchCenterListProps) {
  const t = await getTranslations("matchCenter");
  return (
    <DashboardMatchList
      title={t("listTitle")}
      description={t("listDescription")}
      matches={matches}
      emptyLabel={t("emptyFixtures")}
    />
  );
}

type MatchCenterDetailProps = {
  data: MatchCenterData;
};

/**
 * `/match-center/[fixtureId]` — selected match only (no fixture list).
 */
export async function MatchCenterDetail({ data }: MatchCenterDetailProps) {
  const t = await getTranslations("common");
  return (
    <div className="w-full space-y-6">
      <Link
        href="/match-center"
        className="apex-focusable inline-flex items-center text-sm text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
      >
        {t("backToMatches")}
      </Link>
      <MatchCenterView key={data.match.matchId} data={data} />
    </div>
  );
}
