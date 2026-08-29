"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import type { MatchCenterMeta } from "@/lib/match-center/types";

function formatKickoff(iso: string, locale: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat(locale, {
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

function formatAttendance(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

type Row = { label: string; value: string };

type MatchBriefingCardProps = {
  match: MatchCenterMeta;
};

export function MatchBriefingCard({ match }: MatchBriefingCardProps) {
  const t = useTranslations("matchCenter");
  const locale = useLocale();
  const kickoffLabel = t("kickoff");
  const rows: Row[] = [
    { label: kickoffLabel, value: formatKickoff(match.kickoffAt, locale) },
  ];
  const venue = venueLabel(match);
  if (venue) rows.push({ label: t("stadium"), value: venue });
  if (match.referee) rows.push({ label: t("refereeLabel"), value: match.referee });
  if (match.attendance != null) {
    rows.push({
      label: t("attendance"),
      value: formatAttendance(match.attendance, locale),
    });
  }
  if (match.weather) rows.push({ label: t("weather"), value: match.weather });

  return (
    <Card>
      <CardHeader
        title={t("briefing")}
        description={t("briefingDescription")}
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
              suppressHydrationWarning={row.label === kickoffLabel}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
