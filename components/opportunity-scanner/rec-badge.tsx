"use client";

import { Badge } from "@/components/design-system";
import type { ApexTone } from "@/components/design-system/tokens";
import {
  scannerRecommendation,
  type ScannerRecommendation,
} from "@/lib/opportunity-scanner/recommend";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";

const TONE: Record<ScannerRecommendation, ApexTone> = {
  Elite: "accent",
  "Strong Bet": "success",
  "Value Bet": "accent",
  Watch: "warning",
  Avoid: "danger",
};

export function ScannerRecBadge({ row }: { row: ApexOpportunity }) {
  const label = scannerRecommendation(row);
  return (
    <Badge tone={TONE[label]} size="sm" className="font-mono tracking-[0.08em]">
      {label}
    </Badge>
  );
}
