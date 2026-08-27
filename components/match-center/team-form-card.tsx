import { Card, CardHeader } from "@/components/design-system";
import type { MatchCenterFormSide } from "@/lib/match-center/types";

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

function SideStats({ side }: { side: MatchCenterFormSide }) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[var(--apex-fg)]">{side.teamName}</p>
      {side.form ? (
        <FormLetters form={side.form} />
      ) : (
        <p className="text-xs text-[var(--apex-fg-subtle)]">Sin serie de forma</p>
      )}
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
        title="Forma y estadísticas"
        description="Temporada actual del catálogo (no es un overlay simulado)"
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
