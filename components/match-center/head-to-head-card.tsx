import { Card, CardHeader } from "@/components/design-system";
import { summarizeHeadToHead } from "@/lib/match-center/prematch";
import type { MatchCenterH2HMeeting } from "@/lib/match-center/types";

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pct(value: number | null): string | null {
  if (value == null) return null;
  return `${Math.round(value * 100)}%`;
}

type HeadToHeadCardProps = {
  meetings: MatchCenterH2HMeeting[];
};

export function HeadToHeadCard({ meetings }: HeadToHeadCardProps) {
  const summary = summarizeHeadToHead(meetings);
  return (
    <Card>
      <CardHeader
        title="Head-to-head"
        description="Últimos 5 enfrentamientos del proveedor"
      />
      {meetings.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Sin historial H2H en el catálogo para estos equipos.
        </p>
      ) : (
        <div className="space-y-4">
          {summary && (
            <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              <SummaryStat label="Local" value={String(summary.homeWins)} />
              <SummaryStat label="Empates" value={String(summary.draws)} />
              <SummaryStat label="Visit." value={String(summary.awayWins)} />
              <SummaryStat label="BTTS" value={pct(summary.bttsPct) ?? "—"} />
              <SummaryStat
                label="Over 2.5"
                value={pct(summary.over25Pct) ?? "—"}
              />
            </dl>
          )}
          <ul className="divide-y divide-[var(--apex-border)]">
          {meetings.map((meeting) => (
            <li
              key={meeting.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm text-[var(--apex-fg)]">
                  {meeting.homeTeamName}{" "}
                  <span className="font-mono tabular-nums text-[var(--apex-fg-subtle)]">
                    {meeting.homeGoals ?? "—"}–{meeting.awayGoals ?? "—"}
                  </span>{" "}
                  {meeting.awayTeamName}
                </p>
                <p className="text-xs text-[var(--apex-fg-subtle)]">
                  {formatDate(meeting.kickoffAt)}
                </p>
              </div>
            </li>
          ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--apex-radius-lg)] border border-[var(--apex-border)] bg-slate-950/40 px-2 py-2">
      <dt className="text-[10px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-sm tabular-nums text-[var(--apex-fg)]">
        {value}
      </dd>
    </div>
  );
}
