import { getTranslations } from "next-intl/server";
import { Card, CardHeader } from "@/components/design-system/card";
import { TeamLogo } from "@/components/design-system/team-logo";
import type {
  DashboardLeagueSummary,
  DashboardTeamSummary,
} from "@/lib/dashboard/types";

type DashboardLeaguesProps = {
  leagues: DashboardLeagueSummary[];
};

export async function DashboardLeagues({ leagues }: DashboardLeaguesProps) {
  const t = await getTranslations("dashboard");
  return (
    <Card padding="md" className="h-full">
      <CardHeader
        title={t("leaguesTitle")}
        description={t("leaguesDescription")}
      />
      {leagues.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("leaguesEmpty")}
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

export async function DashboardFeaturedTeams({ teams }: DashboardFeaturedTeamsProps) {
  const t = await getTranslations("dashboard");
  return (
    <Card padding="md" className="h-full">
      <CardHeader
        title={t("teamsTitle")}
        description={t("teamsDescription")}
      />
      {teams.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("teamsEmpty")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex items-center gap-3 rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-[var(--apex-surface-muted)]/40 px-3 py-2"
            >
              <TeamLogo
                src={team.crestUrl}
                name={team.name}
                shortName={team.shortName}
                size="md"
                rounded="full"
              />
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
