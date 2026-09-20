"use client";

import { useTranslations } from "next-intl";
import { Badge, Card, CardHeader, cx } from "@/components/design-system";
import {
  cardToneFromDetail,
  type MatchCenterLiveViewEvent,
} from "@/lib/apex-vision/live/view";

type ProviderLiveTimelineProps = {
  events: MatchCenterLiveViewEvent[];
  homeShort: string;
  awayShort: string;
};

function classLabel(
  event: MatchCenterLiveViewEvent,
  t: ReturnType<typeof useTranslations<"vision">>,
): string {
  if (event.eventClass === "GOAL") return t("eventGoal");
  if (event.eventClass === "SUBSTITUTION") return t("eventSub");
  if (event.eventClass === "VAR") return t("eventVar");
  if (event.eventClass === "CARD") {
    const tone = cardToneFromDetail(event.detail);
    if (tone === "red") return t("eventRed");
    if (tone === "yellow") return t("eventYellow");
    return t("eventCard");
  }
  return event.type || t("eventOther");
}

function classTone(
  event: MatchCenterLiveViewEvent,
): "accent" | "warning" | "danger" | "info" | "neutral" {
  if (event.eventClass === "GOAL") return "accent";
  if (event.eventClass === "CARD") {
    return cardToneFromDetail(event.detail) === "red" ? "danger" : "warning";
  }
  if (event.eventClass === "VAR") return "info";
  return "neutral";
}

export function ProviderLiveTimeline({
  events,
  homeShort,
  awayShort,
}: ProviderLiveTimelineProps) {
  const t = useTranslations("vision");
  const reversed = [...events].reverse();

  return (
    <Card>
      <CardHeader
        title={t("observedTimeline")}
        description={t("observedTimelineDescription")}
      />
      {reversed.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">{t("noEvents")}</p>
      ) : (
        <ol className="max-h-[40rem] overflow-y-auto pr-1" aria-label={t("observedTimeline")}>
          {reversed.map((event, index) => {
            const sideLabel =
              event.side === "home"
                ? homeShort
                : event.side === "away"
                  ? awayShort
                  : event.teamName ?? "—";
            const minute =
              event.minute == null
                ? "—"
                : event.extra
                  ? `${event.minute}+${event.extra}`
                  : String(event.minute);
            return (
              <li key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
                <div className="flex w-10 shrink-0 flex-col items-center">
                  <span
                    className={cx(
                      "z-10 mt-2 h-3 w-3 rounded-full border-2 border-[var(--apex-bg)]",
                      index === 0 ? "bg-[var(--apex-accent)]" : "bg-slate-500",
                    )}
                    aria-hidden
                  />
                  <span className="mt-1 w-px flex-1 bg-[var(--apex-border)]" aria-hidden />
                </div>
                <article
                  className={cx(
                    "min-w-0 flex-1 rounded-[var(--apex-radius-xl)] border bg-slate-950/35 p-4",
                    event.eventClass === "GOAL" && "border-amber-400/50",
                    event.eventClass === "CARD" &&
                      cardToneFromDetail(event.detail) === "red" &&
                      "border-red-500/50",
                    event.eventClass === "VAR" && "border-violet-400/40",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="neutral">{minute}&apos;</Badge>
                    <Badge tone={event.side === "away" ? "info" : "accent"}>
                      {sideLabel}
                    </Badge>
                    <Badge tone={classTone(event)}>{classLabel(event, t)}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">
                    {event.playerName ?? event.detail}
                  </p>
                  {event.assistName ? (
                    <p className="mt-1 text-xs text-[var(--apex-fg-subtle)]">
                      {t("assist")}: {event.assistName}
                    </p>
                  ) : null}
                  {event.comments ? (
                    <p className="mt-1 text-xs text-[var(--apex-fg-muted)]">
                      {event.comments}
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
