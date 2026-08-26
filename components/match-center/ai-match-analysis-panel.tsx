import {
  Badge,
  Card,
  CardHeader,
  ConfidenceIndicator,
} from "@/components/design-system";
import { ExplanationPanel as DsExplanationPanel } from "@/components/design-system";
import { ExplainablePredictionPanel } from "@/components/explainable-ai";
import type { MatchAnalysis } from "@/lib/match-analysis/analysis-types";

const riskTone = {
  low: "accent" as const,
  medium: "warning" as const,
  high: "danger" as const,
};

const actionLabel = {
  bet: "Apostar",
  pass: "Pasar",
  watch: "Observar",
  reduce_stake: "Reducir stake",
  other: "Otra",
} as const;

type AiMatchAnalysisPanelProps = {
  analysis: MatchAnalysis;
};

/**
 * AI Match Analysis panel — Design System only.
 * Displays Sprint 8 MatchAnalysis + Sprint 10 Explainable AI (rules, no OpenAI).
 */
export function AiMatchAnalysisPanel({ analysis }: AiMatchAnalysisPanelProps) {
  const { prediction, confidence, riskLevel, expectedGoals, recommendation } =
    analysis;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">AI Match Analysis</Badge>
        <Badge>PE · {prediction.modelVersion}</Badge>
        <Badge tone="info">Reasoning · rules</Badge>
        <Badge tone={riskTone[riskLevel]}>Risk {riskLevel}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title="Prediction"
              description={prediction.label}
              action={
                <Badge tone="accent">
                  {Math.round(prediction.oneXTwo[prediction.outcome] * 100)}%
                </Badge>
              }
            />
            <p className="text-sm text-[var(--apex-fg-muted)]">
              1X2{" "}
              {Math.round(prediction.oneXTwo.home * 100)}/
              {Math.round(prediction.oneXTwo.draw * 100)}/
              {Math.round(prediction.oneXTwo.away * 100)}
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Tactical Summary"
              description={analysis.recentForm.summary}
            />
            <ul className="space-y-3">
              {analysis.tacticalFactors.map((factor) => (
                <li key={factor.id}>
                  <p className="text-sm font-medium text-[var(--apex-fg)]">
                    {factor.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--apex-fg-muted)]">
                    {factor.detail}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Key Factors" description="Fortalezas y debilidades" />
            <div className="grid gap-4 sm:grid-cols-2">
              <FactorColumn title="Strengths" items={analysis.strengths} />
              <FactorColumn title="Weaknesses" items={analysis.weaknesses} />
            </div>
          </Card>

          <DsExplanationPanel
            title="Explainability"
            summary={analysis.explainability.summary}
            footnotes={analysis.explainability.caveats}
            defaultOpen
          >
            <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
              {analysis.explainability.narrative}
            </p>
          </DsExplanationPanel>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Confidence" description={`Banda ${confidence.band}`} />
            <ConfidenceIndicator
              value={confidence.value}
              band={confidence.band}
              className="w-full"
            />
          </Card>

          <Card>
            <CardHeader title="Expected Goals" description="λ home / away / total" />
            <dl className="grid grid-cols-3 gap-3 text-center">
              <XgStat label="Home" value={expectedGoals.home} />
              <XgStat label="Away" value={expectedGoals.away} />
              <XgStat label="Total" value={expectedGoals.total} />
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Recommendation"
              description={actionLabel[recommendation.action]}
              action={<Badge tone="accent">{recommendation.priority}</Badge>}
            />
            <p className="text-sm font-medium text-[var(--apex-fg)]">
              {recommendation.title}
            </p>
            <p className="mt-2 text-xs text-[var(--apex-fg-muted)]">
              {recommendation.rationale}
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Value Bet"
              description={
                analysis.valueBet
                  ? `${analysis.valueBet.market} · ${analysis.valueBet.selection}`
                  : "Sin edge claro"
              }
            />
            {analysis.valueBet ? (
              <div className="space-y-2 text-sm text-[var(--apex-fg-muted)]">
                <p>
                  Modelo{" "}
                  <span className="text-[var(--apex-fg)]">
                    {(analysis.valueBet.modelProbability * 100).toFixed(0)}%
                  </span>
                  {analysis.valueBet.impliedProbability != null && (
                    <>
                      {" "}
                      · Implícita{" "}
                      {(analysis.valueBet.impliedProbability * 100).toFixed(0)}%
                    </>
                  )}
                </p>
                <p>
                  Edge{" "}
                  <span className="text-[var(--apex-accent)]">
                    {(analysis.valueBet.edge * 100).toFixed(1)} pp
                  </span>
                </p>
                {analysis.valueBet.explanation && (
                  <p className="text-xs">{analysis.valueBet.explanation}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--apex-fg-muted)]">
                No hay value bet con umbral de edge suficiente.
              </p>
            )}
          </Card>

          {(analysis.keyPlayers.length > 0 || analysis.injuries.length > 0) && (
            <Card>
              <CardHeader title="Plantilla" description="Key players / injuries" />
              {analysis.keyPlayers.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {analysis.keyPlayers.map((p) => (
                    <li
                      key={p.id}
                      className="text-xs text-[var(--apex-fg-muted)]"
                    >
                      {p.shirtNumber != null ? `#${p.shirtNumber} ` : ""}
                      {p.name} · {p.position}
                    </li>
                  ))}
                </ul>
              )}
              {analysis.injuries.length === 0 ? (
                <p className="text-xs text-[var(--apex-fg-subtle)]">
                  Sin lesiones reportadas en el catálogo.
                </p>
              ) : (
                <ul className="space-y-1">
                  {analysis.injuries.map((inj) => (
                    <li key={inj.id} className="text-xs text-[var(--apex-warning)]">
                      {inj.playerName}: {inj.detail}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      <ExplainablePredictionPanel data={analysis.explainable} />
    </div>
  );
}

function FactorColumn({
  title,
  items,
}: {
  title: string;
  items: MatchAnalysis["strengths"];
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <p className="text-sm text-[var(--apex-fg)]">{item.label}</p>
            <p className="text-xs text-[var(--apex-fg-muted)]">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function XgStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-[var(--apex-fg)]">
        {value.toFixed(2)}
      </dd>
    </div>
  );
}
