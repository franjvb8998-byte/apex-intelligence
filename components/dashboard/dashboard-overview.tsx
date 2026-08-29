import { getTranslations } from "next-intl/server";
import { DashboardFeaturedTeams, DashboardLeagues } from "@/components/dashboard/leagues-teams";
import { DashboardMatchList } from "@/components/dashboard/match-list";
import { DashboardSystemStatusCard } from "@/components/dashboard/system-status";
import type { DashboardData } from "@/lib/dashboard/types";

type DashboardOverviewProps = {
  data: DashboardData;
};

/**
 * Dashboard overview sections — same UI for mock and live providers.
 */
export async function DashboardOverview({ data }: DashboardOverviewProps) {
  const t = await getTranslations("dashboard");
  return (
    <div className="w-full space-y-6">
      <DashboardSystemStatusCard system={data.system} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardMatchList
          title={t("todayMatches")}
          description={t("todayMatchesDescription")}
          matches={data.todayMatches}
          emptyLabel={t("todayEmpty")}
        />
        <DashboardMatchList
          title={t("upcomingMatches")}
          description={t("upcomingMatchesDescription")}
          matches={data.upcomingMatches}
          emptyLabel={t("upcomingEmpty")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardLeagues leagues={data.leagues} />
        <DashboardFeaturedTeams teams={data.featuredTeams} />
      </div>
    </div>
  );
}
