"use client";

import { motion } from "framer-motion";
import { Card, CardHeader, cx } from "@/components/design-system";

type MomentumBarProps = {
  /** -100 … +100 */
  value: number;
  homeLabel: string;
  awayLabel: string;
};

export function MomentumBar({ value, homeLabel, awayLabel }: MomentumBarProps) {
  const normalized = (value + 100) / 2; // 0–100
  const homeLead = value >= 0;

  return (
    <Card padding="sm">
      <CardHeader title="Momentum" className="mb-3" />
      <div className="mb-2 flex justify-between text-xs">
        <span className={cx(homeLead ? "text-[var(--apex-accent)]" : "text-[var(--apex-fg-muted)]")}>
          {homeLabel}
        </span>
        <span className={cx(!homeLead ? "text-sky-400" : "text-[var(--apex-fg-muted)]")}>
          {awayLabel}
        </span>
      </div>
      <div
        className="relative h-3 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800"
        role="meter"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-label="Momentum del partido"
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-[var(--apex-radius-full)] bg-gradient-to-r from-[var(--apex-accent)] to-sky-400"
          animate={{ width: `${normalized}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
        />
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/40" aria-hidden />
      </div>
      <p className="mt-2 text-center font-mono text-xs tabular-nums text-[var(--apex-fg-subtle)]">
        {value > 0 ? "+" : ""}
        {Math.round(value)}
      </p>
    </Card>
  );
}
