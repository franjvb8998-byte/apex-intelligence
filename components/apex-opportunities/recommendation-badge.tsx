import { Badge } from "@/components/design-system";
import type { ApexTone } from "@/components/design-system/tokens";
import { discoveryRecommendation } from "@/lib/apex-opportunities/discovery";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

const REC_TONE: Record<
  ReturnType<typeof discoveryRecommendation>,
  { tone: ApexTone; mark: string }
> = {
  "STRONG BET": { tone: "success", mark: "🟢" },
  BET: { tone: "success", mark: "🟢" },
  "LEAN BET": { tone: "accent", mark: "🟢" },
  WATCH: { tone: "warning", mark: "🟡" },
  SKIP: { tone: "danger", mark: "🔴" },
};

export function RecommendationBadge({ row }: { row: ApexOpportunity }) {
  const label = discoveryRecommendation(row);
  const { tone, mark } = REC_TONE[label];
  return (
    <Badge tone={tone} size="md" className="font-mono tracking-[0.12em]">
      <span aria-hidden className="mr-1.5">
        {mark}
      </span>
      {label}
    </Badge>
  );
}
