import {
  Badge,
  Card,
  CardHeader,
  ConfidenceIndicator,
  MarketChip,
  ProbabilityBars,
  Timeline,
  type TimelineItem,
} from "@/components/design-system";
import { ExplanationPanel } from "@/components/design-system";
import type { MatchCenterPostData } from "@/lib/match-center/types";

const outcomeLabel = {
  home: "Victoria local",
  draw: "Empate",
  away: "Victoria visitante",
} as const;

type PostPhaseProps = {
  data: MatchCenterPostData;
  homeShort: string;
  awayShort: string;
};

/**
 * Post Match cards — typed for Learning Engine swap (`source`).
 */
export function PostPhase({ data, homeShort, awayShort }: PostPhaseProps) {
  const timelineItems: TimelineItem[] = [
    {
      id: "pre",
      timeLabel: "Pre",
      title: `Predicción: ${outcomeLabel[data.preMatch.predictedOutcome]}`,
      description: `Modelo ${data.preMatch.modelVersion}`,
      tone: "info",
    },
    {
      id: "ft",
      timeLabel: "FT",
      title: `Resultado: ${data.finalScore.home}–${data.finalScore.away} (${outcomeLabel[data.actualOutcome]})`,
      description: data.outcomeHit ? "Outcome acertado" : "Outcome fallido",
      tone: data.outcomeHit ? "success" : "danger",
    },
    ...data.notes.map((note) => ({
      id: note.id,
      title: note.title,
      description: note.detail,
      tone:
        note.severity === "high"
          ? ("danger" as const)
          : note.severity === "medium"
            ? ("warning" as const)
            : ("neutral" as const),
    })),
  ];

  return (
    <div className="space-y-6" role="tabpanel" aria-labelledby="match-center-tab-post">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">Post Match</Badge>
        {data.source === "mock" && (
          <Badge tone="warning">Learning simulado</Badge>
        )}
        {data.source === "data-platform" && (
          <Badge>API-Football</Badge>
        )}
        <Badge tone={data.outcomeHit ? "accent" : "danger"}>
          {data.outcomeHit ? "Hit" : "Miss"}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title="Resultado vs predicción"
              description="Cierre del ciclo de decisión"
              action={
                <span className="font-mono text-2xl font-bold tabular-nums text-white">
                  {data.finalScore.home} – {data.finalScore.away}
                </span>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/40 px-4 py-3">
                <p className="text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                  Predicción
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {outcomeLabel[data.preMatch.predictedOutcome]}
                </p>
              </div>
              <div className="rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/40 px-4 py-3">
                <p className="text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                  Resultado
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {outcomeLabel[data.actualOutcome]}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <ProbabilityBars
                aria-label="Probabilidades pre-partido"
                items={[
                  {
                    id: "home",
                    label: homeShort,
                    value: data.preMatch.oneXTwo.home,
                  },
                  {
                    id: "draw",
                    label: "Empate",
                    value: data.preMatch.oneXTwo.draw,
                  },
                  {
                    id: "away",
                    label: awayShort,
                    value: data.preMatch.oneXTwo.away,
                  },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Veredicto de mercados"
              description="Listo para mapear desde Learning Engine"
            />
            <div className="grid gap-2 sm:grid-cols-3">
              {data.markets.map((market) => (
                <MarketChip
                  key={market.id}
                  interactive={false}
                  selected={market.hit}
                  label={market.label}
                  value={market.hit ? "Hit" : "Miss"}
                  hint={`${market.selection} · ${Math.round(market.preMatchProbability * 100)}%`}
                />
              ))}
            </div>
          </Card>

          <ExplanationPanel
            title="Aprendizaje"
            summary={data.learningSummary}
            defaultOpen
          >
            <ul className="space-y-3">
              {data.recommendations.map((rec) => (
                <li
                  key={rec.id}
                  className="rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/40 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        rec.priority === "high"
                          ? "danger"
                          : rec.priority === "medium"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {rec.priority}
                    </Badge>
                    <p className="text-sm font-medium text-white">{rec.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">
                    {rec.detail}
                  </p>
                </li>
              ))}
            </ul>
          </ExplanationPanel>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Métricas de cierre" />
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Brier"
                value={data.metrics.brierScore.toFixed(3)}
              />
              <Metric
                label="Error outcome"
                value={data.metrics.outcomeError.toFixed(3)}
              />
            </div>
            <ConfidenceIndicator
              className="mt-4"
              value={data.preMatch.confidence.value}
              band={data.preMatch.confidence.band}
              label="Confianza pre-partido"
            />
          </Card>

          <Card>
            <CardHeader title="Cronología del ciclo" />
            <Timeline items={timelineItems} aria-label="Ciclo post-partido" />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/40 px-4 py-3">
      <p className="text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--apex-accent)]">
        {value}
      </p>
    </div>
  );
}
