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
  awayName: string;
  awayShort: string;
  source: "mock" | "intelligence-core";
};

const statusLabel = {
  scheduled: "Programado",
  live: "En vivo",
  finished: "Finalizado",
} as const;

export function MatchHeader({
  leagueName,
  kickoffAt,
  status,
  homeName,
  homeShort,
  awayName,
  awayShort,
  source,
}: MatchHeaderProps) {
  return (
    <header className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[#00D4AA]">{leagueName}</span>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">{formatKickoff(kickoffAt)}</span>
        <span className="rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-0.5 text-xs text-slate-300">
          {statusLabel[status]}
        </span>
        {source === "mock" && (
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">
            Datos simulados
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between sm:gap-8">
        <TeamBlock name={homeName} shortName={homeShort} align="start" />
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-3xl font-bold tracking-widest text-slate-500 sm:text-4xl">
            VS
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Análisis APEX
          </span>
        </div>
        <TeamBlock name={awayName} shortName={awayShort} align="end" />
      </div>
    </header>
  );
}

function TeamBlock({
  name,
  shortName,
  align,
}: {
  name: string;
  shortName: string;
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
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80 text-lg font-bold text-[#00D4AA]">
        {shortName}
      </div>
      <h2 className="text-xl font-semibold text-white sm:text-2xl">{name}</h2>
    </div>
  );
}
