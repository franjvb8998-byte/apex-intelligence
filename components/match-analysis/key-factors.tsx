"use client";

import { useTranslations } from "next-intl";
import type { ExplanationFactor } from "@/lib/intelligence/types/engine";

type KeyFactorsProps = {
  factors: ExplanationFactor[];
};

const directionClass = {
  supports: "border-[#00D4AA]/30 bg-[#00D4AA]/10 text-[#00D4AA]",
  against: "border-red-500/30 bg-red-500/10 text-red-400",
  neutral: "border-slate-600 bg-slate-800/60 text-slate-300",
} as const;

export function KeyFactors({ factors }: KeyFactorsProps) {
  const t = useTranslations("matchAnalysis");
  const sorted = [...factors].sort((a, b) => b.weight - a.weight);
  const directionLabel = {
    supports: t("supports"),
    against: t("against"),
    neutral: t("neutral"),
  } as const;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
      <h3 className="text-sm font-medium uppercase tracking-wider text-slate-400">
        {t("keyFactors")}
      </h3>
      <ul className="mt-5 space-y-4">
        {sorted.map((factor) => {
          return (
            <li
              key={factor.key}
              className="rounded-xl border border-slate-800/80 bg-slate-950/30 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-white">{factor.label}</span>
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${directionClass[factor.direction]}`}
                >
                  {directionLabel[factor.direction]}
                </span>
                <span className="ml-auto font-mono text-xs tabular-nums text-slate-500">
                  {t("weight", { pct: (factor.weight * 100).toFixed(0) })}
                </span>
              </div>
              {factor.detail && (
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {factor.detail}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
