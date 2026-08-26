import { ExplainablePredictionPanel } from "@/components/explainable-ai";
import { Badge, Card, CardHeader } from "@/components/design-system";
import type { CopilotExplainableCardData } from "@/lib/copilot";

type ExplainableCardProps = {
  data: CopilotExplainableCardData;
};

export function ExplainableCard({ data }: ExplainableCardProps) {
  return (
    <Card
      padding="sm"
      className="mt-3 border-[var(--apex-accent-border)] bg-[var(--apex-surface-muted)]/50"
    >
      <CardHeader
        className="mb-3"
        title="Explainable AI"
        description={data.matchLabel}
        action={<Badge tone="info">rules</Badge>}
      />
      <ExplainablePredictionPanel data={data.explainable} compact />
    </Card>
  );
}
