"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Badge, Card, ScoreGauge } from "@/components/design-system";
import { RatingStat } from "@/components/match-analysis/rating-stat";
import { cx } from "@/components/design-system/utils";
import type { ApexTone } from "@/components/design-system/tokens";
import type { ApexDecision } from "@/lib/decision-engine/types";
import type { ApexScoring } from "@/lib/scoring-engine/types";

type DecisionCardProps = {
  decision: ApexDecision;
  scoring: ApexScoring;
};

const verdictTone: Record<ApexDecision["verdict"]["kind"], ApexTone> = {
  elite_pick: "accent",
  strong_bet: "accent",
  lean_bet: "warning",
  pass: "neutral",
  avoid: "danger",
};

const riskTone: Record<ApexDecision["risk"]["band"], ApexTone> = {
  low: "accent",
  medium: "warning",
  high: "danger",
};

function formatPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

function Stars({ filled }: { filled: number }) {
  return (
    <span
      className="font-mono text-xl tracking-[0.22em] text-[var(--apex-accent)] sm:text-2xl"
      aria-label={`${filled} of 5 stars`}
    >
      {"★★★★★☆☆☆☆☆".slice(5 - filled, 10 - filled)}
    </span>
  );
}

export function DecisionCard({ decision, scoring }: DecisionCardProps) {
  const reduceMotion = useReducedMotion();
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const };
  const ev = decision.value.expectedValue;
  const roi = ev;

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      aria-label="APEX Decision Card"
      className="overflow-hidden rounded-[var(--apex-radius-2xl)] border border-[var(--apex-accent-border)] bg-[linear-gradient(180deg,rgba(0,212,170,0.07),transparent_36%),#070b14] shadow-[var(--apex-shadow-sm)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--apex-border)] px-5 py-3 sm:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[var(--apex-accent)]">
            APEX Scoring Engine v2
          </p>
          <p className="mt-0.5 text-xs text-[var(--apex-fg-subtle)]">
            {decision.selectionLabel} · {scoring.engineId}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={verdictTone[decision.verdict.kind]} size="md">
            {scoring.recommendation.tier}
          </Badge>
          <Badge tone={riskTone[decision.risk.band]}>
            Risk {decision.risk.band}
          </Badge>
          {decision.value.positiveEdge ? (
            <Badge tone="accent">Positive Edge</Badge>
          ) : null}
          {decision.value.negativeEdge ? (
            <Badge tone="danger">Negative Edge</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <div className="flex flex-col items-center gap-2">
          <ScoreGauge
            value={scoring.overall}
            label="APEX Score"
            size="lg"
            caption={decision.confidence.caption}
          />
          <Stars filled={scoring.recommendation.stars} />
          <p
            className={cx(
              "text-2xl font-semibold tracking-tight",
              scoring.recommendation.tier === "Avoid"
                ? "text-[var(--apex-danger)]"
                : scoring.recommendation.tier === "Watch"
                  ? "text-[var(--apex-fg-muted)]"
                  : scoring.recommendation.tier === "Value Bet"
                    ? "text-[var(--apex-warning)]"
                    : "text-[var(--apex-accent)]",
            )}
          >
            {scoring.recommendation.tier}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RatingStat
            label="Confidence"
            value={`${decision.confidence.value}`}
            hint={decision.confidence.band}
            tone={
              decision.confidence.band === "high"
                ? "accent"
                : decision.confidence.band === "medium"
                  ? "warning"
                  : "danger"
            }
          />
          <RatingStat
            label="Risk"
            value={decision.risk.band}
            hint={`${decision.risk.score} / 100`}
            tone={riskTone[decision.risk.band]}
          />
          <RatingStat
            label="Stake"
            value={decision.sizing.stakeLabel}
            hint="Bankroll cap 5%"
          />
          <RatingStat
            label="Kelly"
            value={
              decision.sizing.kellyPct == null
                ? "n/d"
                : `${decision.sizing.kellyPct.toFixed(1)}%`
            }
            hint="¼ Kelly before snap"
          />
          <RatingStat
            label="Expected ROI"
            value={formatPct(roi)}
            hint="Same unit as EV"
            tone={
              (roi ?? 0) > 0.005 ? "accent" : (roi ?? 0) < -0.005 ? "danger" : "neutral"
            }
          />
          <RatingStat
            label="Expected Value"
            value={formatPct(ev)}
            hint="P × odds − 1"
            tone={
              decision.value.positiveEdge
                ? "accent"
                : decision.value.negativeEdge
                  ? "danger"
                  : "neutral"
            }
          />
          <RatingStat
            label="Fair Odds"
            value={
              decision.value.fairOdds == null
                ? "n/d"
                : decision.value.fairOdds.toFixed(2)
            }
            hint="1 / model P"
          />
          <RatingStat
            label="Coverage"
            value={`${Math.round(scoring.coverage * 100)}%`}
            hint="Published pillars"
          />
        </div>
      </div>

      <p className="border-t border-[var(--apex-border)] px-5 py-4 text-sm leading-relaxed text-[var(--apex-fg)] sm:px-6">
        {scoring.explanation.summary}
      </p>

      <div className="grid gap-px border-t border-[var(--apex-border)] bg-[var(--apex-border)] lg:grid-cols-2">
        <div className="bg-[#070b14] p-5 sm:p-6">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-accent)]">
            Reasons to bet
          </h3>
          {decision.reasonsFor.length === 0 ? (
            <p className="text-sm text-[var(--apex-fg-muted)]">
              No qualifying published edges.
            </p>
          ) : (
            <ul className="space-y-2">
              {decision.reasonsFor.map((row) => (
                <li key={row.id} className="text-sm text-[var(--apex-fg)]">
                  <span className="mr-2 text-[var(--apex-accent)]">✓</span>
                  <span className="font-medium">{row.title}</span>
                  <span className="mt-0.5 block pl-5 text-[12px] text-[var(--apex-fg-muted)]">
                    {row.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-[#070b14] p-5 sm:p-6">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-warning)]">
            Reasons not to bet
          </h3>
          <ul className="space-y-2">
            {decision.reasonsAgainst.map((row) => (
              <li key={row.id} className="text-sm text-[var(--apex-fg)]">
                <span className="mr-2 text-[var(--apex-warning)]">⚠</span>
                <span className="font-medium">{row.title}</span>
                <span className="mt-0.5 block pl-5 text-[12px] text-[var(--apex-fg-muted)]">
                  {row.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.section>
  );
}
