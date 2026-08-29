"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import { summarizeHeadToHead } from "@/lib/match-center/prematch";
import type { MatchCenterH2HMeeting } from "@/lib/match-center/types";

function formatDate(iso: string, locale: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleDateString(locale, {
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
  const t = useTranslations("matchCenter");
  const common = useTranslations("common");
  const locale = useLocale();
  const summary = summarizeHeadToHead(meetings);
  return (
    <Card>
      <CardHeader
        title={t("h2hTitle")}
        description={t("h2hDescription")}
      />
      {meetings.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          {t("noH2h")}
        </p>
      ) : (
        <div className="space-y-4">
          {summary && (
            <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
              <SummaryStat label={t("homeWins")} value={String(summary.homeWins)} />
              <SummaryStat label={t("draws")} value={String(summary.draws)} />
              <SummaryStat label={t("awayWins")} value={String(summary.awayWins)} />
              <SummaryStat label="BTTS" value={pct(summary.bttsPct) ?? "—"} />
              <SummaryStat
                label={common("over25")}
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
                  {formatDate(meeting.kickoffAt, locale)}
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
