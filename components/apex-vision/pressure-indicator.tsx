"use client";

import { motion } from "framer-motion";
import { Badge, Card, CardHeader } from "@/components/design-system";
import type { VisionSide } from "@/lib/apex-vision/types";

type PressureIndicatorProps = {
  value: number;
  side: VisionSide;
  homeLabel: string;
  awayLabel: string;
};

export function PressureIndicator({
  value,
  side,
  homeLabel,
  awayLabel,
}: PressureIndicatorProps) {
  const team = side === "home" ? homeLabel : awayLabel;

  return (
    <Card padding="sm">
      <CardHeader
        title="Presión"
        action={
          <Badge tone={side === "home" ? "accent" : "info"}>
            {team}
          </Badge>
        }
        className="mb-3"
      />
      <div
        className="h-2.5 overflow-hidden rounded-[var(--apex-radius-full)] bg-slate-800"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-label={`Presión de ${team}`}
      >
        <motion.div
          className={
            side === "home"
              ? "h-full rounded-[var(--apex-radius-full)] bg-[var(--apex-accent)]"
              : "h-full rounded-[var(--apex-radius-full)] bg-sky-400"
          }
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
      </div>
      <p className="mt-2 font-mono text-sm tabular-nums text-white">
        {Math.round(value)}%
      </p>
    </Card>
  );
}
