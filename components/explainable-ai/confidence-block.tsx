import { Card, CardHeader, ConfidenceIndicator } from "@/components/design-system";
import type { ConfidenceScore } from "@/lib/intelligence/types";

type ConfidenceBlockProps = {
  confidence: ConfidenceScore;
};

export function ConfidenceBlock({ confidence }: ConfidenceBlockProps) {
  return (
    <Card padding="sm">
      <CardHeader
        className="mb-3"
        title="Nivel de confianza"
        description={`Banda ${confidence.band}`}
      />
      <ConfidenceIndicator
        value={confidence.value}
        band={confidence.band}
        className="w-full"
      />
    </Card>
  );
}
