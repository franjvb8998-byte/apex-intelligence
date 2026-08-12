import type { MatchAnalysisMarket } from "@/lib/match-analysis/types";

type MarketsPanelProps = {
  markets: MatchAnalysisMarket[];
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function MarketsPanel({ markets }: MarketsPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
      <h3 className="text-sm font-medium uppercase tracking-wider text-slate-400">
        Mercados principales
      </h3>
      <div className="mt-5 space-y-6">
        {markets.map((market) => (
          <div key={market.id}>
            <p className="mb-3 text-sm font-semibold text-white">
              {market.label}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {market.selections.map((selection) => {
                const top = Math.max(
                  ...market.selections.map((s) => s.probability),
                );
                const isTop = selection.probability === top;
                return (
                  <div
                    key={selection.key}
                    className={`rounded-xl border px-4 py-3 transition-colors ${
                      isTop
                        ? "border-[#00D4AA]/40 bg-[#00D4AA]/10"
                        : "border-slate-800 bg-slate-950/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-300">
                        {selection.label}
                      </span>
                      <span
                        className={`font-mono text-sm tabular-nums ${isTop ? "text-[#00D4AA]" : "text-slate-400"}`}
                      >
                        {pct(selection.probability)}
                      </span>
                    </div>
                    {selection.decimalOdds != null && (
                      <p className="mt-1 text-xs text-slate-500">
                        Cuota ref. {selection.decimalOdds.toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
