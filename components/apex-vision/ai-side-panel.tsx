"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Badge,
  Card,
  CardHeader,
  ConfidenceIndicator,
  MarketChip,
  ProbabilityBars,
} from "@/components/design-system";
import type { VisionLiveState, VisionRiskLevel } from "@/lib/apex-vision/types";

type AiSidePanelProps = {
  state: VisionLiveState;
};

const riskTone: Record<VisionRiskLevel, "success" | "warning" | "danger"> = {
  low: "success",
  medium: "warning",
  high: "danger",
};

export function AiSidePanel({ state }: AiSidePanelProps) {
  const t = useTranslations("vision");
  const common = useTranslations("common");
  const { markets, confidence, risk, riskLabel: riskDetail, aiInsight } = state;
  const riskLabel = {
    low: t("riskLow"),
    medium: t("riskMedium"),
    high: t("riskHigh"),
  } as const;

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <Card>
        <CardHeader
          title={t("aiPanel")}
          description={t("aiPanelDescription")}
          action={<Badge tone="accent">Vision</Badge>}
        />

        <div className="space-y-5">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
              {t("win1x2")}
            </p>
            <ProbabilityBars
              aria-label={t("winProbability")}
              items={[
                {
                  id: "home",
                  label: state.homeTeam.shortName,
                  value: markets.homeWin,
                },
                { id: "draw", label: common("draw"), value: markets.draw },
                {
                  id: "away",
                  label: state.awayTeam.shortName,
                  value: markets.awayWin,
                },
              ]}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <MarketChip
              interactive={false}
              selected={markets.over25 >= 0.5}
              label={common("over25")}
              value={`${Math.round(markets.over25 * 100)}%`}
            />
            <MarketChip
              interactive={false}
              selected={markets.btts >= 0.5}
              label="BTTS"
              value={`${Math.round(markets.btts * 100)}%`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-[var(--apex-radius-xl)] border border-[var(--apex-border)] bg-slate-950/40 px-4 py-3">
            <span className="text-sm text-[var(--apex-fg-muted)]">{t("risk")}</span>
            <Badge tone={riskTone[risk]}>{riskLabel[risk]}</Badge>
            <p className="w-full text-xs text-[var(--apex-fg-subtle)]">
              {riskDetail}
            </p>
          </div>

          <ConfidenceIndicator value={confidence} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t("aiSeeing")} />
        <AnimatePresence mode="wait">
          <motion.p
            key={aiInsight}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
            className="text-sm leading-relaxed text-slate-300"
          >
            {aiInsight}
          </motion.p>
        </AnimatePresence>
      </Card>
    </aside>
  );
}
