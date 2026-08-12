import type { Metadata } from "next";
import Link from "next/link";
import { MatchAnalysisView } from "@/components/match-analysis";
import { PageShell } from "@/components/layout/page-shell";
import { getMockMatchAnalysis } from "@/lib/match-analysis";

export const metadata: Metadata = {
  title: "Match Analysis — APEX Intelligence",
  description:
    "Probabilidades 1X2, mercados, APEX Score y explicación del modelo.",
};

export default function MatchAnalysisPage() {
  // TODO(core-wire): replace with PredictionPipeline / IntelligenceApi result
  const data = getMockMatchAnalysis();

  return (
    <PageShell>
      <div className="w-full">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            <Link
              href="/dashboard"
              className="text-slate-400 transition-colors hover:text-[#00D4AA]"
            >
              Dashboard
            </Link>
            <span className="mx-2 text-slate-600">/</span>
            <span className="text-slate-300">Match Analysis</span>
          </p>
        </div>

        <MatchAnalysisView data={data} />
      </div>
    </PageShell>
  );
}
