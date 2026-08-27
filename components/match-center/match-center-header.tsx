import {
  Badge,
  Card,
} from "@/components/design-system";
import type { MatchCenterMeta, MatchCenterPhase } from "@/lib/match-center/types";

function formatKickoff(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const statusTone = {
  scheduled: "info" as const,
  live: "danger" as const,
  finished: "success" as const,
};

const statusLabel = {
  scheduled: "Programado",
  live: "En vivo",
  finished: "Finalizado",
} as const;

const phaseEyebrow: Record<MatchCenterPhase, string> = {
  preview: "Análisis pre-partido",
  live: "Seguimiento en vivo",
  post: "Cierre y aprendizaje",
};

type MatchCenterHeaderProps = {
  match: MatchCenterMeta;
  phase: MatchCenterPhase;
  sourceLabel?: string;
};

/**
 * Brand + match identity for Match Center™.
 * Presentational — data arrives via props (mock or future API).
 */
export function MatchCenterHeader({
  match,
  phase,
  sourceLabel,
}: MatchCenterHeaderProps) {
  return (
    <header className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent" size="md">
            APEX Match Center™
          </Badge>
          <Badge tone={statusTone[match.status]}>
            {statusLabel[match.status]}
          </Badge>
          {(match.source === "mock" || sourceLabel) && (
            <Badge tone="warning">{sourceLabel ?? "Datos simulados"}</Badge>
          )}
          {match.source === "data-platform" && (
            <Badge tone="info">
              Data Platform · {match.providerLabel ?? "catálogo"}
            </Badge>
          )}
        </div>

        <div>
          <p className="text-sm text-[var(--apex-fg-muted)]">
            {match.leagueName}
            <span className="mx-2 text-[var(--apex-fg-subtle)]">·</span>
            {formatKickoff(match.kickoffAt)}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {match.homeTeam.name}{" "}
            <span className="text-[var(--apex-fg-subtle)]">vs</span>{" "}
            {match.awayTeam.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--apex-fg-muted)]">
            {phaseEyebrow[phase]} — dashboard de decisión con probabilidad,
            EV, mercados y contexto del catálogo.
          </p>
        </div>
      </div>

      <Card padding="sm" className="grid grid-cols-3 items-center gap-3">
        <TeamCell
          short={match.homeTeam.shortName}
          name={match.homeTeam.name}
          align="start"
        />
        <div className="text-center">
          <p className="font-mono text-2xl font-bold tracking-[0.2em] text-[var(--apex-fg-subtle)]">
            VS
          </p>
        </div>
        <TeamCell
          short={match.awayTeam.shortName}
          name={match.awayTeam.name}
          align="end"
        />
      </Card>
    </header>
  );
}

function TeamCell({
  short,
  name,
  align,
}: {
  short: string;
  name: string;
  align: "start" | "end";
}) {
  return (
    <div
      className={
        align === "start"
          ? "flex flex-col items-start gap-1"
          : "flex flex-col items-end gap-1 text-right"
      }
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/50 font-mono text-sm font-bold text-[var(--apex-accent)]">
        {short}
      </span>
      <span className="hidden text-xs text-[var(--apex-fg-muted)] sm:block">
        {name}
      </span>
    </div>
  );
}
