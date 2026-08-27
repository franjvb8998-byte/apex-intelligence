import { Badge } from "@/components/design-system";
import { TeamLogo } from "@/components/design-system/team-logo";

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

type MatchHeaderProps = {
  leagueName: string;
  kickoffAt: string;
  status: "scheduled" | "live" | "finished";
  homeName: string;
  homeShort: string;
  homeLogoUrl?: string | null;
  awayName: string;
  awayShort: string;
  awayLogoUrl?: string | null;
  source: "mock" | "intelligence-core" | "data-platform";
};

const statusLabel = {
  scheduled: "Programado",
  live: "En vivo",
  finished: "Finalizado",
} as const;

const statusTone = {
  scheduled: "info",
  live: "danger",
  finished: "neutral",
} as const;

export function MatchHeader({
  leagueName,
  kickoffAt,
  status,
  homeName,
  homeShort,
  homeLogoUrl,
  awayName,
  awayShort,
  awayLogoUrl,
  source,
}: MatchHeaderProps) {
  return (
    <header className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[var(--apex-accent)]">{leagueName}</span>
        <span className="text-[var(--apex-fg-subtle)]">·</span>
        <span className="text-[var(--apex-fg-muted)]">{formatKickoff(kickoffAt)}</span>
        <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
        {source === "data-platform" && <Badge>API-Football</Badge>}
        {source === "intelligence-core" && <Badge>Probability Engine</Badge>}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:gap-8">
        <TeamBlock
          name={homeName}
          shortName={homeShort}
          logoUrl={homeLogoUrl}
          align="start"
        />
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-3xl font-bold tracking-widest text-[var(--apex-fg-subtle)] sm:text-4xl">
            VS
          </span>
          <span className="text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
            Análisis APEX
          </span>
        </div>
        <TeamBlock
          name={awayName}
          shortName={awayShort}
          logoUrl={awayLogoUrl}
          align="end"
        />
      </div>
    </header>
  );
}

function TeamBlock({
  name,
  shortName,
  logoUrl,
  align,
}: {
  name: string;
  shortName: string;
  logoUrl?: string | null;
  align: "start" | "end";
}) {
  const alignClass =
    align === "start"
      ? "sm:items-start sm:text-left"
      : "sm:items-end sm:text-right";

  return (
    <div
      className={`flex flex-1 flex-col items-center gap-3 text-center ${alignClass}`}
    >
      <TeamLogo src={logoUrl} name={name} shortName={shortName} size="lg" />
      <h2 className="text-xl font-semibold text-[var(--apex-fg)] sm:text-2xl">
        {name}
      </h2>
    </div>
  );
}
