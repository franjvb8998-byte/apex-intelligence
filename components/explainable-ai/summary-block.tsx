import { Badge, Card, CardHeader } from "@/components/design-system";

type SummaryBlockProps = {
  summary: string;
  predictedLabel: string;
  method?: "rules";
};

export function SummaryBlock({
  summary,
  predictedLabel,
  method = "rules",
}: SummaryBlockProps) {
  return (
    <Card>
      <CardHeader
        title="Explicación resumida"
        description={predictedLabel}
        action={<Badge tone="info">Explainable AI · {method}</Badge>}
      />
      <p className="text-sm leading-relaxed text-[var(--apex-fg-muted)]">
        {summary}
      </p>
    </Card>
  );
}
