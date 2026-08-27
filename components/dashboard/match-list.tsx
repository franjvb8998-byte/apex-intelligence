import Link from "next/link";
import { EmptyState } from "@/components/app-shell/states";
import { Badge } from "@/components/design-system/badge";
import { Card, CardHeader } from "@/components/design-system/card";
import type {
  DashboardMatchStatus,
  DashboardMatchSummary,
} from "@/lib/dashboard/types";
import {
  fixtureIdFromMatch,
  matchCenterHref,
  matchesFixtureId,
} from "@/lib/match-center/fixture-id";

function statusTone(
  status: DashboardMatchStatus,
): "accent" | "warning" | "neutral" | "info" {
  switch (status) {
    case "live":
      return "accent";
    case "scheduled":
      return "info";
    case "finished":
      return "neutral";
    default:
      return "warning";
  }
}

function statusLabel(status: DashboardMatchStatus): string {
  switch (status) {
    case "live":
      return "En vivo";
    case "scheduled":
      return "Programado";
    case "finished":
      return "Finalizado";
    case "postponed":
      return "Aplazado";
    case "cancelled":
      return "Cancelado";
    default:
      return "—";
  }
}

function formatKickoff(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreLine(match: DashboardMatchSummary): string {
  if (match.score.home == null && match.score.away == null) return "vs";
  return `${match.score.home ?? "—"} – ${match.score.away ?? "—"}`;
}

type MatchListSectionProps = {
  title: string;
  description: string;
  matches: DashboardMatchSummary[];
  emptyLabel: string;
  selectedFixtureId?: string | null;
};

export function DashboardMatchList({
  title,
  description,
  matches,
  emptyLabel,
  selectedFixtureId,
}: MatchListSectionProps) {
  return (
    <Card padding="md">
      <CardHeader title={title} description={description} />
      {matches.length === 0 ? (
        <EmptyState title="Sin partidos" description={emptyLabel} />
      ) : (
        <ul className="divide-y divide-[var(--apex-border)]">
          {matches.map((match) => {
            const fixtureId = fixtureIdFromMatch(match);
            const href = fixtureId ? matchCenterHref(fixtureId) : null;
            const selected = matchesFixtureId(match, selectedFixtureId);
            return (
              <li
                key={match.id}
                className={
                  selected
                    ? "rounded-[var(--apex-radius-md)] bg-[var(--apex-accent-muted)]/40 py-3 first:pt-3 last:pb-3"
                    : "py-3 first:pt-0 last:pb-0"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--apex-fg)]">
                      {match.homeTeam.name}{" "}
                      <span className="text-[var(--apex-fg-subtle)]">
                        {scoreLine(match)}
                      </span>{" "}
                      {match.awayTeam.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">
                      {match.leagueName ?? "Liga"} · {formatKickoff(match.kickoffAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(match.status)}>
                      {statusLabel(match.status)}
                    </Badge>
                    {href && (
                      <Link
                        href={href}
                        prefetch={false}
                        className="apex-focusable relative z-10 rounded-[var(--apex-radius-md)] px-2 py-1 text-xs text-[var(--apex-accent)] hover:text-[var(--apex-accent-hover)]"
                      >
                        Ver
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
