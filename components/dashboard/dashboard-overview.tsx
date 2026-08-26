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
export function DashboardOverview({ data }: DashboardOverviewProps) {
  return (
    <div className="w-full space-y-6">
      <DashboardSystemStatusCard system={data.system} />

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardMatchList
          title="Partidos del día"
          description="Fixtures del provider para la fecha de hoy (UTC)."
          matches={data.todayMatches}
          emptyLabel="No hay partidos programados para hoy."
        />
        <DashboardMatchList
          title="Próximos partidos"
          description="Ventana de los próximos días + partidos aún no finalizados."
          matches={data.upcomingMatches}
          emptyLabel="No hay próximos partidos en la ventana actual."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardLeagues leagues={data.leagues} />
        <DashboardFeaturedTeams teams={data.featuredTeams} />
      </div>
    </div>
  );
}
