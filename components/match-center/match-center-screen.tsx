import Link from "next/link";
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
export function MatchCenterList({ matches }: MatchCenterListProps) {
  return (
    <DashboardMatchList
      title="Partidos"
      description="Fixtures de hoy (UTC). Si no hay partidos, Premier League 2025."
      matches={matches}
      emptyLabel="API-Football no devolvió fixtures para hoy ni Premier League 2025."
    />
  );
}

type MatchCenterDetailProps = {
  data: MatchCenterData;
};

/**
 * `/match-center/[fixtureId]` — selected match only (no fixture list).
 */
export function MatchCenterDetail({ data }: MatchCenterDetailProps) {
  return (
    <div className="w-full space-y-6">
      <Link
        href="/match-center"
        className="apex-focusable inline-flex items-center text-sm text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
      >
        Volver a partidos
      </Link>
      <MatchCenterView key={data.match.matchId} data={data} />
    </div>
  );
}
