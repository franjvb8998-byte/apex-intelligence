import { Card, CardHeader } from "@/components/design-system";
import type { MatchAnalysisInjury } from "@/lib/match-analysis/analysis-types";

type InjuriesCardProps = {
  injuries: MatchAnalysisInjury[];
};

export function InjuriesCard({ injuries }: InjuriesCardProps) {
  return (
    <Card>
      <CardHeader
        title="Lesiones"
        description="Bajas reportadas por el catálogo, si existen"
      />
      {injuries.length === 0 ? (
        <p className="text-sm text-[var(--apex-fg-muted)]">
          Sin lesiones reportadas para este partido.
        </p>
      ) : (
        <ul className="space-y-2">
          {injuries.map((injury) => (
            <li key={injury.id} className="text-sm">
              <span className="font-medium text-[var(--apex-warning)]">
                {injury.playerName}
              </span>
              <span className="text-[var(--apex-fg-muted)]">
                {" "}
                · {injury.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
