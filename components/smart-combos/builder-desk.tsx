"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ComboPanel } from "@/components/smart-combos/combo-panel";
import { buildCombo } from "@/lib/smart-combos/build";
import type { ApexOpportunity } from "@/lib/apex-opportunities/types";
import type { ComboBuildSpec, ComboRiskProfile } from "@/lib/smart-combos/types";

export function BuilderDesk({
  analyzed,
  leagues,
  onBuilt,
}: {
  analyzed: ApexOpportunity[];
  leagues: string[];
  onBuilt: (fixtureIds: string[]) => void;
}) {
  const t = useTranslations("smartCombos");
  const [legCount, setLegCount] = useState(2);
  const [oddsMin, setOddsMin] = useState("");
  const [oddsMax, setOddsMax] = useState("");
  const [league, setLeague] = useState("all");
  const [profile, setProfile] = useState<ComboRiskProfile>("balanced");
  const [message, setMessage] = useState<string | null>(null);

  const spec = useMemo((): ComboBuildSpec => {
    return {
      legCount,
      riskProfile: profile,
      leagues: league === "all" ? [] : [league],
      markets: ["1x2"],
      oddsMin: oddsMin ? Number(oddsMin) : null,
      oddsMax: oddsMax ? Number(oddsMax) : null,
    };
  }, [legCount, league, oddsMax, oddsMin, profile]);

  function generate() {
    const result = buildCombo(analyzed, spec);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setMessage(null);
    onBuilt(result.analysis.legs.map((leg) => leg.fixtureId));
  }

  return (
    <ComboPanel
      id="builder"
      eyebrow={t("builder")}
      title={t("builderTitle")}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-xs text-[var(--apex-fg-muted)]">
          Matches
          <input
            type="number"
            min={2}
            max={8}
            value={legCount}
            onChange={(event) => setLegCount(Number(event.target.value) || 2)}
            className="mt-1 w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/40 px-3 py-2 font-mono text-sm text-[var(--apex-fg)]"
          />
        </label>
        <label className="block text-xs text-[var(--apex-fg-muted)]">
          Min combined odds
          <input
            type="number"
            min={1.01}
            step="0.1"
            placeholder="optional"
            value={oddsMin}
            onChange={(event) => setOddsMin(event.target.value)}
            className="mt-1 w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/40 px-3 py-2 font-mono text-sm text-[var(--apex-fg)]"
          />
        </label>
        <label className="block text-xs text-[var(--apex-fg-muted)]">
          Max combined odds
          <input
            type="number"
            min={1.01}
            step="0.1"
            placeholder="optional"
            value={oddsMax}
            onChange={(event) => setOddsMax(event.target.value)}
            className="mt-1 w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/40 px-3 py-2 font-mono text-sm text-[var(--apex-fg)]"
          />
        </label>
        <label className="block text-xs text-[var(--apex-fg-muted)]">
          League
          <select
            value={league}
            onChange={(event) => setLeague(event.target.value)}
            className="mt-1 w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/40 px-3 py-2 text-sm text-[var(--apex-fg)]"
          >
            <option value="all">All leagues in scan</option>
            {leagues.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[var(--apex-fg-muted)]">
          Market
          <select
            disabled
            className="mt-1 w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/40 px-3 py-2 text-sm text-[var(--apex-fg-muted)]"
            value="1x2"
          >
            <option value="1x2">1X2 (Decision Engine)</option>
          </select>
        </label>
        <label className="block text-xs text-[var(--apex-fg-muted)]">
          Risk profile
          <select
            value={profile}
            onChange={(event) =>
              setProfile(event.target.value as ComboRiskProfile)
            }
            className="mt-1 w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-black/40 px-3 py-2 text-sm text-[var(--apex-fg)]"
          >
            <option value="conservative">Conservative</option>
            <option value="balanced">Value / balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        onClick={generate}
        className="apex-focusable mt-4 rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-4 py-2 text-sm font-medium text-[var(--apex-fg-inverse)] hover:bg-[var(--apex-accent-hover)]"
      >
        Generate combination
      </button>
      {message && (
        <p className="mt-3 text-sm text-[var(--apex-warning)]">{message}</p>
      )}
    </ComboPanel>
  );
}
