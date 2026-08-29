"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/design-system";
import type { MatchAnalysisVenueSplit } from "@/lib/match-analysis/analysis-types";
import type {
  MatchAnalysisLeaguePosition,
  MatchAnalysisMatchMetrics,
} from "@/lib/match-analysis/types";
import type {
  MatchCenterH2HMeeting,
  MatchCenterRecentMatch,
} from "@/lib/match-center/types";

function EmptyHint({ children }: { children: string }) {
  return <p className="text-sm text-[var(--apex-fg-muted)]">{children}</p>;
}

function resultTone(result: "W" | "D" | "L" | null): string {
  if (result === "W") return "bg-[var(--apex-accent)]";
  if (result === "L") return "bg-[var(--apex-danger)]";
  if (result === "D") return "bg-slate-500";
  return "bg-slate-700";
}

export function LeaguePositionChart({
  home,
  away,
  homeName,
  awayName,
}: {
  home: MatchAnalysisLeaguePosition | null;
  away: MatchAnalysisLeaguePosition | null;
  homeName: string;
  awayName: string;
}) {
  const t = useTranslations("matchAnalysis");
  const maxRank = Math.max(home?.rank ?? 1, away?.rank ?? 1, 20);
  const rows = [
    { id: "home", name: homeName, position: home },
    { id: "away", name: awayName, position: away },
  ];

  return (
    <Card>
      <CardHeader
        title={t("leaguePosition")}
        description={t("leaguePositionDescription")}
      />
      {!home && !away ? (
        <EmptyHint>{t("noLeagueTable")}</EmptyHint>
      ) : (
        <ul className="space-y-5" aria-label={t("leaguePositionAria")}>
          {rows.map((row) => {
            const rank = row.position?.rank ?? null;
            const width =
              rank == null ? 0 : Math.max(8, ((maxRank - rank + 1) / maxRank) * 100);
            return (
              <li key={row.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm text-[var(--apex-fg)]">{row.name}</span>
                  <span className="font-mono text-sm tabular-nums text-[var(--apex-accent)]">
                    {rank != null ? `${rank}º` : "—"}
                    {row.position ? ` · ${row.position.points} pts` : ""}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800">
                  <div
                    className="h-full rounded-[var(--apex-radius-full)] bg-[var(--apex-accent)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function RecentFormSide({
  name,
  matches,
}: {
  name: string;
  matches: MatchCenterRecentMatch[];
}) {
  const t = useTranslations("matchAnalysis");
  const maxGoals = Math.max(
    1,
    ...matches.flatMap((match) => [match.goalsFor ?? 0, match.goalsAgainst ?? 0]),
  );

  if (matches.length === 0) {
    return (
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--apex-fg)]">{name}</p>
        <EmptyHint>{t("noLast5")}</EmptyHint>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-[var(--apex-fg)]">{name}</p>
      <div
        className="flex h-28 items-end gap-2"
        role="img"
        aria-label={t("lastNAria", { count: matches.length, name })}
      >
        {matches.map((match) => {
          const gf = match.goalsFor ?? 0;
          const height = Math.max(12, (gf / maxGoals) * 100);
          return (
            <div key={match.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="font-mono text-[10px] tabular-nums text-[var(--apex-fg-subtle)]">
                {match.goalsFor ?? "—"}-{match.goalsAgainst ?? "—"}
              </span>
              <div
                className={`w-full max-w-[2rem] rounded-t-[var(--apex-radius-sm)] ${resultTone(match.result)}`}
                style={{ height: `${height}%` }}
                title={`${match.home ? t("homeAbbr") : t("awayAbbr")} vs ${match.opponentName}`}
              />
              <span className="text-[10px] font-semibold text-[var(--apex-fg-muted)]">
                {match.result ?? "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FormChart({
  homeName,
  awayName,
  home,
  away,
}: {
  homeName: string;
  awayName: string;
  home: MatchCenterRecentMatch[];
  away: MatchCenterRecentMatch[];
}) {
  const t = useTranslations("matchAnalysis");
  return (
    <Card>
      <CardHeader
        title={t("last5")}
        description={t("last5Description")}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <RecentFormSide name={homeName} matches={home} />
        <RecentFormSide name={awayName} matches={away} />
      </div>
    </Card>
  );
}

export function HeadToHeadChart({ meetings }: { meetings: MatchCenterH2HMeeting[] }) {
  const t = useTranslations("matchAnalysis");
  const maxGoals = Math.max(
    1,
    ...meetings.flatMap((meeting) => [
      meeting.homeGoals ?? 0,
      meeting.awayGoals ?? 0,
    ]),
  );

  return (
    <Card>
      <CardHeader
        title={t("h2hTitle")}
        description={t("h2hGoals")}
      />
      {meetings.length === 0 ? (
        <EmptyHint>{t("noH2h")}</EmptyHint>
      ) : (
        <ul className="space-y-4" aria-label={t("h2hAria")}>
          {meetings.map((meeting) => {
            const homeW = ((meeting.homeGoals ?? 0) / maxGoals) * 100;
            const awayW = ((meeting.awayGoals ?? 0) / maxGoals) * 100;
            return (
              <li key={meeting.id}>
                <p className="mb-1.5 truncate text-xs text-[var(--apex-fg-muted)]">
                  {meeting.homeTeamName} vs {meeting.awayTeamName}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="flex justify-end">
                    <div
                      className="h-2.5 rounded-[var(--apex-radius-full)] bg-[var(--apex-accent)]"
                      style={{ width: `${Math.max(homeW, 4)}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[var(--apex-fg)]">
                    {meeting.homeGoals ?? "—"}–{meeting.awayGoals ?? "—"}
                  </span>
                  <div>
                    <div
                      className="h-2.5 rounded-[var(--apex-radius-full)] bg-slate-400"
                      style={{ width: `${Math.max(awayW, 4)}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function GoalsChart({
  homeName,
  awayName,
  home,
  away,
}: {
  homeName: string;
  awayName: string;
  home: MatchCenterRecentMatch[];
  away: MatchCenterRecentMatch[];
}) {
  const t = useTranslations("matchAnalysis");
  const sides = [
    { name: homeName, matches: home },
    { name: awayName, matches: away },
  ];
  const max = Math.max(
    1,
    ...sides.flatMap((side) =>
      side.matches.flatMap((match) => [
        match.goalsFor ?? 0,
        match.goalsAgainst ?? 0,
      ]),
    ),
  );

  return (
    <Card>
      <CardHeader
        title={t("recentGoals")}
        description={t("recentGoalsDescription")}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        {sides.map((side) =>
          side.matches.length === 0 ? (
            <div key={side.name}>
              <p className="mb-2 text-sm font-medium text-[var(--apex-fg)]">
                {side.name}
              </p>
              <EmptyHint>{t("noRecentGoals")}</EmptyHint>
            </div>
          ) : (
            <div key={side.name}>
              <p className="mb-3 text-sm font-medium text-[var(--apex-fg)]">
                {side.name}
              </p>
              <div className="flex h-32 items-end gap-2">
                {side.matches.map((match) => (
                  <div
                    key={match.id}
                    className="flex min-w-0 flex-1 items-end justify-center gap-0.5"
                  >
                    <div
                      className="w-1/2 max-w-[0.7rem] rounded-t-[var(--apex-radius-sm)] bg-[var(--apex-accent)]"
                      style={{
                        height: `${Math.max(8, ((match.goalsFor ?? 0) / max) * 100)}%`,
                      }}
                      title={t("forGoals")}
                    />
                    <div
                      className="w-1/2 max-w-[0.7rem] rounded-t-[var(--apex-radius-sm)] bg-[var(--apex-danger)]"
                      style={{
                        height: `${Math.max(8, ((match.goalsAgainst ?? 0) / max) * 100)}%`,
                      }}
                      title={t("against")}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--apex-fg-subtle)]">
                {t("legendForAgainst")}
              </p>
            </div>
          ),
        )}
      </div>
    </Card>
  );
}

function SplitBars({
  name,
  split,
  venue,
}: {
  name: string;
  split: MatchAnalysisVenueSplit | null;
  venue: string;
}) {
  const t = useTranslations("matchAnalysis");
  if (!split || split.played === 0) {
    return (
      <div>
        <p className="mb-2 text-sm text-[var(--apex-fg)]">
          {name} · {venue}
        </p>
        <EmptyHint>{t("noVenueSplit")}</EmptyHint>
      </div>
    );
  }
  const total = Math.max(split.played, split.wins + split.draws + split.losses, 1);
  const parts = [
    { key: "W", value: split.wins, className: "bg-[var(--apex-accent)]" },
    { key: "D", value: split.draws, className: "bg-slate-500" },
    { key: "L", value: split.losses, className: "bg-[var(--apex-danger)]" },
  ];
  return (
    <div>
      <p className="mb-2 text-sm text-[var(--apex-fg)]">
        {name} · {venue}{" "}
        <span className="text-[var(--apex-fg-subtle)]">
          ({t("playedLine", {
            played: split.played,
            gf: split.goalsFor ?? "—",
            ga: split.goalsAgainst ?? "—",
          })})
        </span>
      </p>
      <div className="flex h-3 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800">
        {parts.map((part) => (
          <div
            key={part.key}
            className={part.className}
            style={{ width: `${(part.value / total) * 100}%` }}
            title={`${part.key} ${part.value}`}
          />
        ))}
      </div>
      <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--apex-fg-muted)]">
        {split.wins}V · {split.draws}E · {split.losses}D
      </p>
    </div>
  );
}

export function VenueSplitChart({
  homeName,
  awayName,
  home,
  away,
}: {
  homeName: string;
  awayName: string;
  home: {
    home: MatchAnalysisVenueSplit | null;
    away: MatchAnalysisVenueSplit | null;
  };
  away: {
    home: MatchAnalysisVenueSplit | null;
    away: MatchAnalysisVenueSplit | null;
  };
}) {
  const t = useTranslations("matchAnalysis");
  const empty =
    !home.home && !home.away && !away.home && !away.away;
  return (
    <Card>
      <CardHeader
        title={t("homeVsAway")}
        description={t("homeVsAwayDescription")}
      />
      {empty ? (
        <EmptyHint>{t("noVenueStats")}</EmptyHint>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <SplitBars name={homeName} split={home.home} venue={t("venueHome")} />
          <SplitBars name={homeName} split={home.away} venue={t("venueAway")} />
          <SplitBars name={awayName} split={away.home} venue={t("venueHome")} />
          <SplitBars name={awayName} split={away.away} venue={t("venueAway")} />
        </div>
      )}
    </Card>
  );
}

function DualMetric({
  label,
  home,
  away,
  suffix = "",
  maxHint,
}: {
  label: string;
  home: number | null;
  away: number | null;
  suffix?: string;
  maxHint?: number;
}) {
  if (home == null && away == null) return null;
  const max = Math.max(home ?? 0, away ?? 0, maxHint ?? 1, 0.01);
  const fmt = (value: number | null) =>
    value == null ? "—" : `${Number.isInteger(value) ? value : value.toFixed(2)}${suffix}`;
  return (
    <li>
      <p className="mb-1.5 text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex justify-end">
          <div
            className="h-2.5 rounded-[var(--apex-radius-full)] bg-[var(--apex-accent)]"
            style={{ width: home == null ? "0%" : `${Math.max(6, (home / max) * 100)}%` }}
          />
        </div>
        <span className="min-w-[5.5rem] text-center font-mono text-xs tabular-nums text-[var(--apex-fg)]">
          {fmt(home)} · {fmt(away)}
        </span>
        <div>
          <div
            className="h-2.5 rounded-[var(--apex-radius-full)] bg-slate-400"
            style={{ width: away == null ? "0%" : `${Math.max(6, (away / max) * 100)}%` }}
          />
        </div>
      </div>
    </li>
  );
}

export function MatchMetricsChart({
  homeName,
  awayName,
  home,
  away,
  modelXg,
}: {
  homeName: string;
  awayName: string;
  home: MatchAnalysisMatchMetrics | null;
  away: MatchAnalysisMatchMetrics | null;
  modelXg: { home: number; away: number };
}) {
  const t = useTranslations("matchAnalysis");
  const hasVendor =
    home != null ||
    away != null;
  return (
    <Card>
      <CardHeader
        title={t("possessionShotsXg")}
        description={t("vsCaption", { home: homeName, away: awayName })}
      />
      <ul className="space-y-4">
        {hasVendor ? (
          <>
            <DualMetric
              label={t("possession")}
              home={home?.possession ?? null}
              away={away?.possession ?? null}
              suffix="%"
              maxHint={100}
            />
            <DualMetric
              label={t("shots")}
              home={home?.shots ?? null}
              away={away?.shots ?? null}
            />
            <DualMetric
              label={t("shotsOnTarget")}
              home={home?.shotsOnTarget ?? null}
              away={away?.shotsOnTarget ?? null}
            />
            <DualMetric
              label={t("matchXg")}
              home={home?.expectedGoals ?? null}
              away={away?.expectedGoals ?? null}
            />
          </>
        ) : (
          <EmptyHint>
            {t("noMetrics")}
          </EmptyHint>
        )}
        <DualMetric
          label={t("modelXg")}
          home={modelXg.home}
          away={modelXg.away}
        />
      </ul>
    </Card>
  );
}
