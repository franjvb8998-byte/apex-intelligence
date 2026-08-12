"use client";

import { useId, useState } from "react";
import type { MatchAnalysisExplanation } from "@/lib/match-analysis/types";

type ExplanationPanelProps = {
  explanation: MatchAnalysisExplanation;
  modelVersion: string;
};

export function ExplanationPanel({
  explanation,
  modelVersion,
}: ExplanationPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-800/30"
      >
        <div>
          <h3 className="text-sm font-medium uppercase tracking-wider text-slate-400">
            Explicación APEX
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {explanation.summary}
          </p>
        </div>
        <span
          className={`shrink-0 text-[#00D4AA] transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      <div
        id={panelId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-slate-800 px-6 py-5">
            <p className="text-sm leading-relaxed text-slate-400">
              {explanation.narrative}
            </p>
            {explanation.caveats.length > 0 && (
              <ul className="space-y-2">
                {explanation.caveats.map((caveat) => (
                  <li
                    key={caveat}
                    className="text-xs leading-relaxed text-slate-500"
                  >
                    • {caveat}
                  </li>
                ))}
              </ul>
            )}
            <p className="font-mono text-[11px] text-slate-600">
              model: {modelVersion}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
