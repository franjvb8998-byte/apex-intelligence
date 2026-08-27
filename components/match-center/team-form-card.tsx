import { Card, CardHeader } from "@/components/design-system";
import type { MatchCenterFormSide, MatchCenterRecentMatch } from "@/lib/match-center/types";

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function FormLetters({ form }: { form: string }) {
  return (
    <div className="flex flex-wrap gap-1" aria-label={`Forma ${form}`}>
      {form.split("").map((letter, index) => {
        const tone =
          letter === "W"
            ? "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]"
            : letter === "D"
              ? "border-[var(--apex-border)] bg-slate-800/80 text-[var(--apex-fg-muted)]"
              : letter === "L"
                ? "border-red-500/40 bg-[var(--apex-danger-muted)] text-[var(--apex-danger)]"
                : "border-[var(--apex-border)] text-[var(--apex-fg-subtle)]";
        return (
          <span
            key={`${letter}-${index}`}
            className={`flex h-7 w-7 items-center justify-center rounded-[var(--apex-radius-sm)] border text-xs font-semibold ${tone}`}
          >
            {letter}
          </span>
        );
      })}
    </div>
  );
}

function resultTone(result: MatchCenterRecentMatch["result"]): string {
  if (result === "W") return "text-[var(--apex-accent)]";
  if (result === "L") return "text-[var(--apex-danger)]";
  if (result === "D") return "text-[var(--apex-fg-muted)]";
  return "text-[var(--apex-fg-subtle)]";
}

function RecentMatches({ matches }: { matches: MatchCenterRecentMatch[] }) {
  if (matches.length === 0) {
    return (
      <p className="text-xs text-[var(--apex-fg-subtle)]">
        Sin últimos partidos en el catálogo.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {matches.map((match) => (
        <li
          key={match.id}
          className="flex items-center justify-between gap-2 text-xs"
        >
          <span className="min-w-0 truncate text-[var(--apex-fg-muted)]">
            <span className="mr-1.5 text-[var(--apex-fg-subtle)]">
              {formatDate(match.kickoffAt)}
            </span>
            {match.home ? "L" : "V"} vs {match.opponentName}
          </span>
          <span className="shrink-0 font-mono tabular-nums text-[var(--apex-fg)]">
            {match.goalsFor ?? "—"}–{match.goalsAgainst ?? "—"}
            <span className={`ml-2 font-semibold ${resultTone(match.result)}`}>
              {match.result ?? "—"}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function SideStats({ side }: { side: MatchCenterFormSide }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[var(--apex-fg)]">{side.teamName}</p>
      {side.form ? (
        <FormLetters form={side.form} />
      ) : (
        <p className="text-xs text-[var(--apex-fg-subtle)]">Sin serie de forma</p>
      )}
      <RecentMatches matches={side.recentMatches ?? []} />
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="PJ" value={side.played} />
        <Stat label="GF" value={side.goalsFor} />
        <Stat label="GC" value={side.goalsAgainst} />
      </dl>
      <p className="text-xs text-[var(--apex-fg-muted)]">
        {side.wins ?? "—"}V · {side.draws ?? "—"}E · {side.losses ?? "—"}D
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/40 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm tabular-nums text-[var(--apex-fg)]">
        {value ?? "—"}
      </dd>
    </div>
  );
}

type TeamFormCardProps = {
  home: MatchCenterFormSide | null;
  away: MatchCenterFormSide | null;
};

export function TeamFormCard({ home, away }: TeamFormCardProps) {
  const empty = !home && !away;
  return (
    <Card>
      <CardHeader
        title="Últimos 5 partidos"
        description="Forma reciente y estadísticas de temporada del catálogo"
      />
      {empty ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Sin estadísticas de equipo en el proveedor configurado.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {home && <SideStats side={home} />}
          {away && <SideStats side={away} />}
        </div>
      )}
    </Card>
  );
}
