import { Badge, Card, CardHeader, ScoreGauge } from "@/components/design-system";
import type { ExplanationQualityScore } from "@/lib/explainable-ai/types";

type QualityScoreProps = {
  quality: ExplanationQualityScore;
};

const bandTone = {
  low: "danger" as const,
  medium: "warning" as const,
  high: "success" as const,
};

export function QualityScore({ quality }: QualityScoreProps) {
  return (
    <Card padding="sm">
      <CardHeader
        className="mb-3"
        title="Score de calidad"
        description={quality.label}
        action={<Badge tone={bandTone[quality.band]}>{quality.band}</Badge>}
      />
      <ScoreGauge
        value={quality.value}
        label="Calidad"
        caption="Explicación"
        size="md"
      />
      <ul className="mt-4 space-y-2">
        {quality.components.map((c) => (
          <li
            key={c.key}
            className="flex items-center justify-between gap-2 text-xs text-[var(--apex-fg-muted)]"
          >
            <span>{c.label}</span>
            <span className="font-mono tabular-nums text-[var(--apex-fg)]">
              {c.value}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
