import { Card, CardHeader } from "@/components/design-system/card";
import type {
  DashboardLeagueSummary,
  DashboardTeamSummary,
} from "@/lib/dashboard/types";

type DashboardLeaguesProps = {
  leagues: DashboardLeagueSummary[];
};

export function DashboardLeagues({ leagues }: DashboardLeaguesProps) {
  return (
    <Card padding="md" className="h-full">
      <CardHeader
        title="Ligas"
        description="Derivadas del catálogo del provider activo."
      />
      {leagues.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Sin ligas en el catálogo actual.
        </p>
      ) : (
        <ul className="space-y-3">
          {leagues.map((league) => (
            <li key={league.id} className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--apex-fg)]">
                  {league.name}
                </p>
                <p className="mt-0.5 text-xs text-[var(--apex-fg-muted)]">
                  {[league.country, league.season].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type DashboardFeaturedTeamsProps = {
  teams: DashboardTeamSummary[];
};

export function DashboardFeaturedTeams({ teams }: DashboardFeaturedTeamsProps) {
  return (
    <Card padding="md" className="h-full">
      <CardHeader
        title="Equipos destacados"
        description="Equipos presentes en los partidos cargados."
      />
      {teams.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Sin equipos en el catálogo actual.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center gap-3 rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-[var(--apex-surface-muted)]/40 px-3 py-2"
            >
              {team.crestUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.crestUrl}
                  alt=""
                  className="h-8 w-8 rounded-full bg-slate-800 object-contain"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--apex-accent-muted)] text-[10px] font-semibold text-[var(--apex-accent)]">
                  {(team.shortName ?? team.name).slice(0, 3).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--apex-fg)]">
                  {team.name}
                </p>
                <p className="truncate text-xs text-[var(--apex-fg-muted)]">
                  {team.leagueName ?? "—"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
