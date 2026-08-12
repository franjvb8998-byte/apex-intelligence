"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Badge,
  Card,
  CardHeader,
  cx,
} from "@/components/design-system";
import type {
  ProbabilityImpact,
  TimelineChangeFactor,
  VisionLiveEvent,
} from "@/lib/apex-vision/types";

type IntelligenceTimelineProps = {
  events: VisionLiveEvent[];
  homeShort: string;
  awayShort: string;
};

function formatPp(value: number): string {
  const pp = value * 100;
  const sign = pp > 0 ? "+" : "";
  return `${sign}${pp.toFixed(1)}`;
}

function ImpactRow({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const positive = value > 0.0005;
  const negative = value < -0.0005;
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--apex-fg-muted)]">{label}</span>
      <span
        className={cx(
          "font-mono tabular-nums",
          positive && "text-[var(--apex-accent)]",
          negative && "text-[var(--apex-danger)]",
          !positive && !negative && "text-[var(--apex-fg-subtle)]",
        )}
      >
        {formatPp(value)} pp
      </span>
    </div>
  );
}

function ProbabilityImpactGrid({
  impact,
  homeShort,
  awayShort,
}: {
  impact: ProbabilityImpact;
  homeShort: string;
  awayShort: string;
}) {
  return (
    <div className="grid gap-1.5 rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-slate-950/40 p-3">
      <ImpactRow label={`${homeShort} win`} value={impact.homeWin} />
      <ImpactRow label="Empate" value={impact.draw} />
      <ImpactRow label={`${awayShort} win`} value={impact.awayWin} />
      <ImpactRow label="Over 2.5" value={impact.over25} />
      <ImpactRow label="BTTS" value={impact.btts} />
    </div>
  );
}

function WhyChangedPanel({ factors }: { factors: TimelineChangeFactor[] }) {
  return (
    <ul className="space-y-2">
      {factors.map((factor) => (
        <li
          key={factor.id}
          className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-slate-950/30 px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-white">{factor.label}</span>
            <Badge
              tone={
                factor.direction === "positive"
                  ? "success"
                  : factor.direction === "negative"
                    ? "danger"
                    : "neutral"
              }
            >
              {factor.direction === "positive"
                ? "A favor"
                : factor.direction === "negative"
                  ? "En contra"
                  : "Neutral"}
            </Badge>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--apex-fg-muted)]">
            {factor.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}

function TimelineEventCard({
  event,
  homeShort,
  awayShort,
  isLatest,
}: {
  event: VisionLiveEvent;
  homeShort: string;
  awayShort: string;
  isLatest: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const momentumPositive = event.momentumDelta >= 0;

  return (
    <li className="relative flex gap-4 pb-5 last:pb-0">
      <div className="flex w-10 shrink-0 flex-col items-center">
        <span
          className={cx(
            "z-10 mt-2 h-3 w-3 rounded-full border-2 border-[var(--apex-bg)]",
            isLatest ? "bg-[var(--apex-accent)]" : "bg-slate-500",
          )}
          aria-hidden
        />
        <span className="mt-1 w-px flex-1 bg-[var(--apex-border)]" aria-hidden />
      </div>

      <article
        className={cx(
          "min-w-0 flex-1 rounded-[var(--apex-radius-xl)] border bg-slate-950/35 p-4",
          isLatest
            ? "border-[var(--apex-accent-border)]"
            : "border-[var(--apex-border)]",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{event.minute}&apos;</Badge>
          <Badge tone={event.side === "home" ? "accent" : "info"}>
            {event.side === "home" ? homeShort : awayShort}
          </Badge>
          <Badge
            tone={
              event.type === "tarjeta"
                ? "warning"
                : event.type === "disparo" || event.type === "ataque_peligroso"
                  ? "accent"
                  : "neutral"
            }
          >
            {event.label}
          </Badge>
          {isLatest && <Badge tone="success">Nuevo</Badge>}
        </div>

        <p className="mt-3 text-sm text-slate-300">{event.detail}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
              Impacto en probabilidades
            </p>
            <ProbabilityImpactGrid
              impact={event.probabilityImpact}
              homeShort={homeShort}
              awayShort={awayShort}
            />
          </div>
          <div className="space-y-3">
            <div className="rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-slate-950/40 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                Momentum
              </p>
              <p
                className={cx(
                  "mt-1 font-mono text-lg tabular-nums",
                  momentumPositive
                    ? "text-[var(--apex-accent)]"
                    : "text-[var(--apex-danger)]",
                )}
              >
                {momentumPositive ? "+" : ""}
                {event.momentumDelta.toFixed(1)}
              </p>
            </div>
            <div>
              <p className="mb-1 text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                Explicación de la IA
              </p>
              <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
                {event.aiExplanation}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="apex-focusable mt-4 inline-flex h-10 items-center rounded-[var(--apex-radius-md)] border border-[var(--apex-border-strong)] bg-slate-900/70 px-3 text-sm font-medium text-[var(--apex-accent)] transition-colors hover:border-[var(--apex-accent-border)]"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          ¿Por qué cambió?
          <span
            className={cx(
              "ml-2 transition-transform duration-[var(--apex-duration-normal)]",
              open && "rotate-180",
            )}
            aria-hidden
          >
            ▾
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={panelId}
              key="why"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28 }}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <WhyChangedPanel factors={event.whyChanged} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </article>
    </li>
  );
}

/**
 * APEX Intelligence Timeline™ — interactive chronological event stream.
 * Presentational over VisionLiveEvent; data comes from mock sim today.
 */
export function IntelligenceTimeline({
  events,
  homeShort,
  awayShort,
}: IntelligenceTimelineProps) {
  return (
    <Card>
      <CardHeader
        title="APEX Intelligence Timeline™"
        description="Registro cronológico con impacto, momentum y factores de cambio"
        action={<Badge tone="accent">Live</Badge>}
      />

      {events.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">Sin eventos aún.</p>
      ) : (
        <ol
          className="max-h-[40rem] overflow-y-auto pr-1"
          aria-label="APEX Intelligence Timeline"
        >
          {events.map((event, index) => (
            <TimelineEventCard
              key={event.id}
              event={event}
              homeShort={homeShort}
              awayShort={awayShort}
              isLatest={index === 0}
            />
          ))}
        </ol>
      )}
    </Card>
  );
}

/** @deprecated Prefer IntelligenceTimeline — kept as alias for existing imports. */
export function VisionTimeline(props: IntelligenceTimelineProps) {
  return <IntelligenceTimeline {...props} />;
}
