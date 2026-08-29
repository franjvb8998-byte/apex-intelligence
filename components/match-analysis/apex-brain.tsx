"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Badge, Card, CardHeader, ScoreGauge } from "@/components/design-system";
import { cx } from "@/components/design-system/utils";
import type { ApexTone } from "@/components/design-system/tokens";
import { buildApexBrainBriefing } from "@/lib/apex-brain";
import type { BrainPoint, BrainRecommendationKind } from "@/lib/apex-brain";
import type { ApexDecision } from "@/lib/decision-engine/types";
import type { ApexScoring, ScoringTier } from "@/lib/scoring-engine/types";

type ApexBrainProps = {
  decision: ApexDecision;
  scoring: ApexScoring;
};

export type BrainHeadline = {
  kind: "bet" | "watch" | "skip";
  label: "BET" | "WATCH" | "SKIP";
  emoji: string;
  tone: ApexTone;
};

const HEADLINE: Record<ApexDecision["verdict"]["kind"], BrainHeadline> = {
  elite_pick: { kind: "bet", label: "BET", emoji: "🟢", tone: "accent" },
  strong_bet: { kind: "bet", label: "BET", emoji: "🟢", tone: "accent" },
  lean_bet: { kind: "bet", label: "BET", emoji: "🟢", tone: "accent" },
  pass: { kind: "watch", label: "WATCH", emoji: "🟡", tone: "warning" },
  avoid: { kind: "skip", label: "SKIP", emoji: "🔴", tone: "danger" },
};

const riskTone: Record<ApexDecision["risk"]["band"], ApexTone> = {
  low: "accent",
  medium: "warning",
  high: "danger",
};

const recTone: Record<BrainRecommendationKind, ApexTone> = {
  strong_bet: "accent",
  bet: "accent",
  lean_bet: "warning",
  watch: "warning",
  skip: "danger",
};

const headlineColor: Record<BrainHeadline["kind"], string> = {
  bet: "text-[var(--apex-accent)]",
  watch: "text-[var(--apex-warning)]",
  skip: "text-[var(--apex-danger)]",
};

const HEADLINE_FROM_TIER: Record<ScoringTier, BrainHeadline> = {
  Elite: { kind: "bet", label: "BET", emoji: "🟢", tone: "accent" },
  "Strong Bet": { kind: "bet", label: "BET", emoji: "🟢", tone: "accent" },
  "Value Bet": { kind: "bet", label: "BET", emoji: "🟢", tone: "accent" },
  Watch: { kind: "watch", label: "WATCH", emoji: "🟡", tone: "warning" },
  Avoid: { kind: "skip", label: "SKIP", emoji: "🔴", tone: "danger" },
};

export function brainHeadlineFromVerdict(
  kind: ApexDecision["verdict"]["kind"],
): BrainHeadline {
  return HEADLINE[kind];
}

export function brainHeadlineFromTier(tier: ScoringTier): BrainHeadline {
  return HEADLINE_FROM_TIER[tier];
}

function formatSignedPct(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

function formatKelly(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/d";
  return `${value.toFixed(1)}%`;
}

/**
 * Flagship Match Analysis presentation. Scoring Engine v2 for score and
 * recommendation; Decision Engine for stake and Kelly.
 */
export function ApexBrain({ decision, scoring }: ApexBrainProps) {
  const reduceMotion = useReducedMotion();
  const briefing = buildApexBrainBriefing(decision, scoring);
  const headline = brainHeadlineFromTier(scoring.recommendation.tier);
  const confidencePct = Math.min(100, Math.max(0, Math.round(decision.confidence.value)));
  const valueTone: ApexTone = decision.value.positiveEdge
    ? "accent"
    : decision.value.negativeEdge
      ? "danger"
      : "neutral";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="space-y-4"
    >
      <section
        aria-label="APEX Brain"
        className="overflow-hidden rounded-[var(--apex-radius-2xl)] border border-[var(--apex-accent-border)] bg-[linear-gradient(165deg,rgba(0,212,170,0.12)_0%,transparent_38%),linear-gradient(180deg,#0b1220,#070b14)] shadow-[var(--apex-shadow-sm)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--apex-border)] px-5 py-4 sm:px-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[var(--apex-accent)]">
              🧠 APEX Brain
            </p>
            <p className="mt-1 text-xs text-[var(--apex-fg-subtle)]">
              {decision.selectionLabel} · {scoring.recommendation.tier}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={riskTone[decision.risk.band]} size="md">
              {decision.risk.band.toUpperCase()}
            </Badge>
            <Badge tone={valueTone} size="md">
              {formatSignedPct(decision.value.expectedValue)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="flex flex-col items-center text-center">
            <p
              className={cx(
                "font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--apex-fg-subtle)]",
              )}
            >
              Headline verdict
            </p>
            <p
              className={cx(
                "mt-2 text-5xl font-semibold tracking-tight sm:text-6xl",
                headlineColor[headline.kind],
              )}
            >
              <span aria-hidden className="mr-2 text-4xl sm:text-5xl">
                {headline.emoji}
              </span>
              {headline.label}
            </p>
            <div className="mt-6">
              <ScoreGauge
                value={scoring.overall}
                label="APEX SCORE"
                size="lg"
                caption={`${Math.round(scoring.overall)} / 100`}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <div>
              <div className="flex items-end justify-between gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--apex-fg-subtle)]">
                  Confidence
                </p>
                <p className="font-mono text-3xl tabular-nums text-[var(--apex-fg)] sm:text-4xl">
                  {confidencePct}
                  <span className="ml-1 text-base text-[var(--apex-fg-subtle)]">
                    / 100
                  </span>
                </p>
              </div>
              <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">
                {decision.confidence.caption}
              </p>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-800"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={confidencePct}
                aria-label="Confidence"
              >
                <div
                  className={cx(
                    "h-full rounded-full transition-[width] duration-[var(--apex-duration-bar)] ease-[var(--apex-ease-out)]",
                    decision.confidence.band === "high"
                      ? "bg-[var(--apex-accent)]"
                      : decision.confidence.band === "medium"
                        ? "bg-[var(--apex-warning)]"
                        : "bg-[var(--apex-danger)]",
                  )}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric
                label="Risk"
                value={decision.risk.band.toUpperCase()}
                hint={`${decision.risk.score} / 100`}
                tone={riskTone[decision.risk.band]}
              />
              <Metric
                label="Value"
                value={formatSignedPct(decision.value.expectedValue)}
                hint="Expected value"
                tone={valueTone}
              />
              <Metric
                label="Kelly"
                value={formatKelly(decision.sizing.kellyPct)}
                hint="¼ Kelly"
              />
              <Metric
                label="Recommended Stake"
                value={decision.sizing.stakeLabel}
                hint="Snapped bankroll %"
              />
            </dl>
          </div>
        </div>
      </section>

      <Card padding="lg" className="bg-[#070b14]" aria-label="Executive Summary">
        <CardHeader title="Executive Summary" />
        <p className="max-w-3xl text-base leading-relaxed text-[var(--apex-fg)] sm:text-lg">
          {briefing.executiveSummary}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <PointCard
          title="Strength Analysis"
          empty="No published strengths on this board."
          points={briefing.strengths}
          mark="✓"
          markClass="text-[var(--apex-accent)]"
        />
        <PointCard
          title="Risk Analysis"
          empty="No published risks on this board."
          points={briefing.risks}
          mark="⚠"
          markClass="text-[var(--apex-warning)]"
        />
      </div>

      <Card padding="lg" className="bg-[#070b14]" aria-label="Why APEX recommends this">
        <CardHeader title="Why APEX recommends this" />
        <p className="max-w-3xl text-base leading-relaxed text-[var(--apex-fg)]">
          {briefing.why}
        </p>
      </Card>

      <Card
        padding="lg"
        className="border-[var(--apex-accent-border)] bg-[#070b14]"
        aria-label="Recommendation"
      >
        <CardHeader title="Recommendation" />
        <p
          className={cx(
            "text-4xl font-semibold tracking-tight sm:text-5xl",
            briefing.recommendation.kind === "skip"
              ? "text-[var(--apex-danger)]"
              : briefing.recommendation.kind === "watch" ||
                  briefing.recommendation.kind === "lean_bet"
                ? "text-[var(--apex-warning)]"
                : "text-[var(--apex-accent)]",
          )}
        >
          {briefing.recommendation.label}
        </p>
        <div className="mt-3">
          <Badge tone={recTone[briefing.recommendation.kind]} size="md">
            {scoring.recommendation.tier}
          </Badge>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--apex-fg-muted)] sm:text-base">
          {briefing.recommendation.explanation}
        </p>
      </Card>

      <Card padding="lg" className="bg-[#070b14]" aria-label="Confidence Explanation">
        <CardHeader title="Confidence Explanation" />
        <p className="max-w-3xl text-base leading-relaxed text-[var(--apex-fg)]">
          {briefing.confidenceExplanation}
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <PointCard
          title="Advantages"
          empty="No leftover published advantages."
          points={briefing.advantages}
          mark="+"
          markClass="text-[var(--apex-accent)]"
        />
        <PointCard
          title="Disadvantages"
          empty="No leftover published disadvantages."
          points={briefing.disadvantages}
          mark="−"
          markClass="text-[var(--apex-danger)]"
        />
      </div>

      <Card padding="lg" className="bg-[#070b14]" aria-label="APEX Verdict">
        <CardHeader title="APEX Verdict" />
        <p className="max-w-3xl text-base leading-relaxed text-[var(--apex-fg)] sm:text-lg">
          {briefing.verdict}
        </p>
      </Card>
    </motion.div>
  );
}

function PointCard({
  title,
  empty,
  points,
  mark,
  markClass,
}: {
  title: string;
  empty: string;
  points: BrainPoint[];
  mark: string;
  markClass: string;
}) {
  return (
    <Card padding="lg" className="bg-[#070b14]" aria-label={title}>
      <CardHeader title={title} />
      {points.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {points.map((row) => (
            <li key={row.id} className="flex gap-3 text-sm sm:text-base">
              <span className={cx("mt-0.5", markClass)} aria-hidden>
                {mark}
              </span>
              <span>
                <span className="font-medium text-[var(--apex-fg)]">{row.title}</span>
                <span className="mt-0.5 block text-sm text-[var(--apex-fg-muted)]">
                  {row.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: ApexTone;
}) {
  const valueClass: Record<ApexTone, string> = {
    neutral: "text-[var(--apex-fg)]",
    accent: "text-[var(--apex-accent)]",
    success: "text-[var(--apex-accent)]",
    warning: "text-[var(--apex-warning)]",
    danger: "text-[var(--apex-danger)]",
    info: "text-[var(--apex-info)]",
  };

  return (
    <div className="rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-black/25 px-3 py-3 sm:px-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd
        className={cx(
          "mt-1 font-mono text-xl font-semibold tabular-nums sm:text-2xl",
          valueClass[tone],
        )}
      >
        {value}
      </dd>
      {hint ? (
        <p className="mt-0.5 text-[11px] text-[var(--apex-fg-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
}
