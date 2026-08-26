import { Badge, Card, CardHeader } from "@/components/design-system";
import type { ExplanationEvidence } from "@/lib/explainable-ai/types";

type EvidenceListProps = {
  evidence: ExplanationEvidence[];
};

const sourceTone = {
  "probability-engine": "accent" as const,
  "data-platform": "info" as const,
  "team-stats": "info" as const,
  timeline: "warning" as const,
  rules: "neutral" as const,
};

export function EvidenceList({ evidence }: EvidenceListProps) {
  return (
    <Card padding="sm">
      <CardHeader
        className="mb-3"
        title="Evidencias utilizadas"
        description={`${evidence.length} fuentes`}
      />
      <ul className="space-y-2.5">
        {evidence.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--apex-border)] pb-2 last:border-0 last:pb-0"
          >
            <div>
              <p className="text-sm text-[var(--apex-fg)]">{item.label}</p>
              <p className="mt-0.5 font-mono text-xs text-[var(--apex-fg-muted)]">
                {item.value}
              </p>
            </div>
            <Badge tone={sourceTone[item.source]}>{item.source}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
