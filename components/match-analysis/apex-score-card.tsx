import { getTranslations } from "next-intl/server";
import {
  Badge,
  Card,
  CardHeader,
  ConfidenceIndicator,
  ScoreGauge,
} from "@/components/design-system";
import { RatingStat } from "@/components/match-analysis/rating-stat";
import { cx } from "@/components/design-system/utils";
import type { ApexMatchRating } from "@/lib/match-rating";
import type { ConfidenceScore } from "@/lib/intelligence/types";

type ApexScoreCardProps = {
  rating: ApexMatchRating;
};

const riskTone = {
  low: "accent" as const,
  medium: "warning" as const,
  high: "danger" as const,
};

const recTone = {
  bet: "accent" as const,
  watch: "warning" as const,
  skip: "neutral" as const,
};

function formatOdds(value: number | null, na: string): string {
  return value == null || !Number.isFinite(value) ? na : value.toFixed(2);
}

function formatEv(value: number | null, na: string): string {
  if (value == null || !Number.isFinite(value)) return na;
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function evTone(value: number | null) {
  if (value == null) return "neutral" as const;
  if (value > 0.02) return "accent" as const;
  if (value < -0.02) return "danger" as const;
  return "warning" as const;
}

export async function ApexScoreCard({ rating }: ApexScoreCardProps) {
  const t = await getTranslations("matchAnalysis");
  const missing = rating.metrics.filter((row) => !row.available);
  const na = t("na");

  return (
    <Card
      padding="lg"
      className="border-[var(--apex-accent-border)] bg-[var(--apex-surface)]/90"
    >
      <CardHeader
        className="mb-6"
        title="APEX Match Rating"
        description={rating.label}
        action={
          <span className="flex flex-wrap gap-1.5">
            <Badge tone={riskTone[rating.risk]}>Risk {rating.risk}</Badge>
            <Badge tone={recTone[rating.recommendation]}>
              {rating.recommendationLabel}
            </Badge>
            <Badge>
              {t("coverage", { pct: Math.round(rating.coverage * 100) })}
            </Badge>
          </span>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <ScoreGauge
          value={rating.overall}
          label={t("overall")}
          size="lg"
          caption={rating.selectionLabel}
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <RatingStat
            label="Confidence"
            value={`${rating.confidencePct}%`}
            hint={rating.confidence.band}
            tone={
              rating.confidence.band === "high"
                ? "accent"
                : rating.confidence.band === "medium"
                  ? "warning"
                  : "danger"
            }
          />
          <RatingStat
            label="Risk"
            value={rating.risk}
            hint={t("riskHint")}
            tone={riskTone[rating.risk]}
          />
          <RatingStat
            label={t("valueRating")}
            value={
              rating.valueRating == null ? "n/d" : rating.valueRating.toFixed(1)
            }
            hint="0–10"
            tone={
              (rating.valueRating ?? 0) >= 6
                ? "accent"
                : (rating.valueRating ?? 0) >= 4
                  ? "warning"
                  : "neutral"
            }
          />
          <RatingStat
            label={t("stakeKelly")}
            value={
              rating.recommendedKelly == null
                ? "n/d"
                : `${(rating.recommendedKelly * 100).toFixed(1)}%`
            }
            hint={rating.kellyLabel}
          />
          <RatingStat
            label="Fair odds"
            value={formatOdds(rating.fairOdds, na)}
            hint={t("fairOddsHint")}
          />
          <RatingStat
            label="Expected value"
            value={formatEv(rating.expectedValue, na)}
            hint={t("evHint")}
            tone={evTone(rating.expectedValue)}
          />
          <RatingStat
            label={t("recommendation")}
            value={rating.recommendationLabel}
            hint={rating.selectionLabel}
            tone={recTone[rating.recommendation]}
          />
          <div className="sm:col-span-2 xl:col-span-1">
            <ConfidenceIndicator
              value={rating.confidence.value}
              band={rating.confidence.band}
              className="h-full"
            />
          </div>
        </div>
      </div>

      <ul className="mt-8 grid gap-3 border-t border-[var(--apex-border)] pt-6 sm:grid-cols-2">
        {rating.metrics.map((metric) => (
          <li key={metric.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
              <span className="text-[var(--apex-fg-muted)]">{metric.label}</span>
              <span className="font-mono tabular-nums text-[var(--apex-fg-subtle)]">
                {metric.available ? metric.score : "n/d"}
                <span className="ml-2 text-[10px] uppercase tracking-wider">
                  w {(metric.weight * 100).toFixed(0)}%
                </span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800">
              <div
                className={cx(
                  "h-full rounded-[var(--apex-radius-full)] transition-[width] duration-[var(--apex-duration-bar)] ease-[var(--apex-ease-out)]",
                  metric.available
                    ? "bg-[var(--apex-accent)]"
                    : "bg-slate-700",
                )}
                style={{ width: `${metric.available ? metric.score : 0}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] leading-snug text-[var(--apex-fg-subtle)]">
              {metric.note}
            </p>
          </li>
        ))}
      </ul>

      {missing.length > 0 ? (
        <p className="mt-4 text-[11px] text-[var(--apex-fg-subtle)]">
          {t("unpublishedSignals", {
            list: missing.map((row) => row.label).join(", "),
          })}
        </p>
      ) : null}
    </Card>
  );
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: ConfidenceScore;
}) {
  return (
    <ConfidenceIndicator
      value={confidence.value}
      band={confidence.band}
      layout="badge"
    />
  );
}
