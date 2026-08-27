import { Badge, Card, CardHeader } from "@/components/design-system";
import type { MatchCenterPreviewDashboard } from "@/lib/match-center/types";

const actionLabel = {
  bet: "Apostar",
  pass: "Pasar",
  watch: "Observar",
  reduce_stake: "Reducir stake",
  other: "Otra",
} as const;

const actionTone = {
  bet: "accent" as const,
  pass: "warning" as const,
  watch: "info" as const,
  reduce_stake: "warning" as const,
  other: "neutral" as const,
};

type RecommendationCardProps = {
  dashboard: MatchCenterPreviewDashboard;
};

export function RecommendationCard({ dashboard }: RecommendationCardProps) {
  const { recommendation, valueBet } = dashboard;
  return (
    <Card>
      <CardHeader
        title="Recomendación final"
        description={actionLabel[recommendation.action]}
        action={
          <Badge tone={actionTone[recommendation.action]}>
            {recommendation.priority}
          </Badge>
        }
      />
      <p className="text-base font-semibold text-[var(--apex-fg)]">
        {recommendation.title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {recommendation.rationale}
      </p>
      {valueBet ? (
        <p className="mt-4 text-sm text-[var(--apex-fg-muted)]">
          Value: {valueBet.market.toUpperCase()} · {valueBet.selection} · edge{" "}
          <span className="text-[var(--apex-accent)]">
            {(valueBet.edge * 100).toFixed(1)} pp
          </span>
          {valueBet.decimalOdds != null && (
            <>
              {" "}
              · cuota {valueBet.decimalOdds.toFixed(2)}
            </>
          )}
        </p>
      ) : (
        <p className="mt-4 text-sm text-[var(--apex-fg-subtle)]">
          Sin value bet por encima del umbral de edge.
        </p>
      )}
    </Card>
  );
}
