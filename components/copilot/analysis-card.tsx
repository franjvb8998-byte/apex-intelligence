import { Badge, Card, CardHeader } from "@/components/design-system";
import type { CopilotAnalysisCardData } from "@/lib/copilot";

const riskTone = {
  low: "accent" as const,
  medium: "warning" as const,
  high: "danger" as const,
};

type AnalysisCardProps = {
  data: CopilotAnalysisCardData;
};

export function AnalysisCard({ data }: AnalysisCardProps) {
  return (
    <Card padding="sm" className="mt-3 border-[var(--apex-accent-border)] bg-[var(--apex-surface-muted)]/50">
      <CardHeader
        className="mb-3"
        title="Análisis"
        description={data.league}
        action={<Badge tone={riskTone[data.risk]}>Risk {data.risk}</Badge>}
      />
      <p className="text-sm font-medium text-[var(--apex-fg)]">{data.matchLabel}</p>
      <p className="mt-2 text-sm text-[var(--apex-fg-muted)]">{data.summary}</p>
      <ul className="mt-3 space-y-1.5">
        {data.factors.map((factor) => (
          <li
            key={factor}
            className="text-xs text-[var(--apex-fg-muted)] before:mr-2 before:text-[var(--apex-accent)] before:content-['•']"
          >
            {factor}
          </li>
        ))}
      </ul>
    </Card>
  );
}
