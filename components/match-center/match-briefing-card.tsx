import { Card, CardHeader } from "@/components/design-system";
import type { MatchCenterMeta } from "@/lib/match-center/types";

function formatKickoff(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(new Date(ms));
  } catch {
    return iso;
  }
}

function venueLabel(match: MatchCenterMeta): string | null {
  const name = match.venue?.name?.trim() || null;
  const city = match.venue?.city?.trim() || null;
  if (name && city) return `${name} · ${city}`;
  return name ?? city;
}

function formatAttendance(value: number): string {
  return new Intl.NumberFormat("es-ES").format(value);
}

type Row = { label: string; value: string };

type MatchBriefingCardProps = {
  match: MatchCenterMeta;
};

export function MatchBriefingCard({ match }: MatchBriefingCardProps) {
  const rows: Row[] = [
    { label: "Saque inicial", value: formatKickoff(match.kickoffAt) },
  ];
  const venue = venueLabel(match);
  if (venue) rows.push({ label: "Estadio", value: venue });
  if (match.referee) rows.push({ label: "Árbitro", value: match.referee });
  if (match.attendance != null) {
    rows.push({ label: "Asistencia", value: formatAttendance(match.attendance) });
  }
  if (match.weather) rows.push({ label: "Clima", value: match.weather });

  return (
    <Card>
      <CardHeader
        title="Ficha del partido"
        description="Contexto del fixture cuando el proveedor lo publica"
      />
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/40 px-3 py-3"
          >
            <dt className="text-[10px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
              {row.label}
            </dt>
            <dd
              className="mt-1 text-sm text-[var(--apex-fg)]"
              suppressHydrationWarning={row.label === "Saque inicial"}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
