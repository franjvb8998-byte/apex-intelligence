import { Card, CardHeader } from "@/components/design-system";
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

type HeadToHeadCardProps = {
  meetings: MatchCenterH2HMeeting[];
};

export function HeadToHeadCard({ meetings }: HeadToHeadCardProps) {
  return (
    <Card>
      <CardHeader
        title="Head-to-head"
        description="Últimos enfrentamientos del proveedor"
      />
      {meetings.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Sin historial H2H en el catálogo para estos equipos.
        </p>
      ) : (
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
      )}
    </Card>
  );
}
