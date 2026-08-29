import { getTranslations } from "next-intl/server";
import type { OutcomeProbability } from "@/lib/intelligence/types";

type Probability1x2Props = {
  probabilities: OutcomeProbability;
  homeLabel: string;
  awayLabel: string;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export async function Probability1x2({
  probabilities,
  homeLabel,
  awayLabel,
}: Probability1x2Props) {
  const t = await getTranslations("matchCenter");
  const common = await getTranslations("common");
  const rows = [
    { key: "home", label: homeLabel, value: probabilities.home },
    { key: "draw", label: common("draw"), value: probabilities.draw },
    { key: "away", label: awayLabel, value: probabilities.away },
  ] as const;

  const max = Math.max(...rows.map((r) => r.value));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-sm">
      <h3 className="text-sm font-medium uppercase tracking-wider text-slate-400">
        {t("winProbTitle")}
      </h3>
      <ul className="mt-5 space-y-4">
        {rows.map((row) => {
          const isLead = row.value === max;
          return (
            <li key={row.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span
                  className={`text-sm font-medium ${isLead ? "text-[#00D4AA]" : "text-slate-300"}`}
                >
                  {row.label}
                </span>
                <span
                  className={`font-mono text-sm tabular-nums ${isLead ? "text-[#00D4AA]" : "text-slate-400"}`}
                >
                  {pct(row.value)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${
                    isLead ? "bg-[#00D4AA]" : "bg-slate-500"
                  }`}
                  style={{ width: `${Math.max(row.value * 100, 2)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
