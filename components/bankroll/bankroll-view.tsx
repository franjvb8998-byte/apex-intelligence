"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ProductLinkRow } from "@/components/app-shell/product-link-row";
import { AddBetModal } from "@/components/bankroll/add-bet-modal";
import { BetHistoryTable } from "@/components/bankroll/bet-history-table";
import { BankrollCharts } from "@/components/bankroll/charts";
import { BankrollKpiGrid } from "@/components/bankroll/kpi-grid";
import { BankrollSettingsBar } from "@/components/bankroll/settings-bar";
import { buildBankrollData } from "@/lib/bankroll/calculate";
import { useAddBetForm } from "@/lib/bankroll/use-add-bet-form";
import { useBankrollSettings } from "@/lib/bankroll/use-bankroll-settings";
import type { BankrollBetDraft, BankrollData, BankrollFixture } from "@/lib/bankroll/types";
import { matchesFixtureId } from "@/lib/match-center/fixture-id";

type BankrollViewProps = {
  initial: BankrollData;
  fixtures: BankrollFixture[];
  initialFixtureId?: string | null;
};

export function BankrollView({
  initial,
  fixtures,
  initialFixtureId = null,
}: BankrollViewProps) {
  const t = useTranslations("bankroll");
  const { settings, setCurrency, setUnitValue } = useBankrollSettings();
  const [drafts, setDrafts] = useState<BankrollBetDraft[]>(
    initial.bets.map(({ profit: _profit, ...draft }) => draft),
  );
  const [open, setOpen] = useState(false);
  const openedFromQuery = useRef(false);
  const addBet = useAddBetForm({
    unitValue: settings.unitValue,
    currency: settings.currency,
    fixtures,
  });

  useEffect(() => {
    if (openedFromQuery.current || !initialFixtureId) return;
    const fixture = fixtures.find((item) =>
      matchesFixtureId(item, initialFixtureId),
    );
    if (!fixture) return;
    openedFromQuery.current = true;
    addBet.selectFixture(fixture);
    setOpen(true);
  }, [addBet.selectFixture, fixtures, initialFixtureId]);

  const data = useMemo(
    () =>
      buildBankrollData(
        initial.initialBankroll,
        drafts,
        new Date(),
        settings.currency,
      ),
    [drafts, initial.initialBankroll, settings.currency],
  );

  function openModal() {
    addBet.reset();
    setOpen(true);
  }

  function submitBet() {
    const next = addBet.toDraft();
    if (!next) return;
    setDrafts((current) => [next, ...current]);
    setOpen(false);
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--apex-accent)]">{t("eyebrow")}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--apex-fg)] sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--apex-fg-muted)]">
            {t("description")} {t("unitHint")}
          </p>
          <div className="mt-3">
            <ProductLinkRow
              links={[
                { href: "/portfolio", label: "Portfolio" },
                { href: "/opportunities", label: "APEX Opportunities" },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={openModal}
              className="apex-focusable rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-4 py-2 text-sm font-medium text-[var(--apex-fg-inverse)] transition-colors hover:bg-[var(--apex-accent-hover)]"
            >
              {t("addBet")}
            </button>
          </div>
          <BankrollSettingsBar
            settings={settings}
            onCurrencyChange={setCurrency}
            onUnitValueChange={setUnitValue}
          />
        </div>
      </div>

      <BankrollKpiGrid metrics={data.metrics} currency={settings.currency} />
      <BankrollCharts
        evolution={data.evolution}
        monthlyProfit={data.monthlyProfit}
        bets={data.bets}
        currency={settings.currency}
      />
      <BetHistoryTable bets={data.bets} currency={settings.currency} />

      <AddBetModal
        open={open}
        value={addBet.form}
        fixtures={fixtures}
        unitValue={settings.unitValue}
        currency={settings.currency}
        preview={addBet.preview}
        valid={addBet.valid}
        onChange={addBet.setForm}
        onSelectFixture={addBet.selectFixture}
        onMarketChange={addBet.setMarket}
        onStakeUnits={addBet.setStakeUnits}
        onClose={() => setOpen(false)}
        onSubmit={submitBet}
        error={addBet.error}
      />
    </div>
  );
}
