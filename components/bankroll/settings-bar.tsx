"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BANKROLL_CURRENCIES,
  currencyFractionDigits,
  currencyLabel,
  type BankrollCurrency,
} from "@/lib/bankroll/currency";
import { formatDecimalField, parseDecimal } from "@/lib/bankroll/form";
import { useMoneyFormatter } from "@/lib/bankroll/use-money-formatter";
import type { BankrollSettings } from "@/lib/bankroll/settings";

const fieldClass =
  "apex-focusable h-10 rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-slate-950/50 px-2.5 text-sm text-[var(--apex-fg)] outline-none transition-colors focus:border-[var(--apex-accent-border)]";

type BankrollSettingsBarProps = {
  settings: BankrollSettings;
  onCurrencyChange: (currency: BankrollCurrency) => void;
  onUnitValueChange: (unitValue: number) => void;
};

export function BankrollSettingsBar({
  settings,
  onCurrencyChange,
  onUnitValueChange,
}: BankrollSettingsBarProps) {
  const t = useTranslations("bankroll");
  const { money } = useMoneyFormatter(settings.currency);
  const digits = currencyFractionDigits(settings.currency);
  const [unitDraft, setUnitDraft] = useState(() =>
    formatDecimalField(String(settings.unitValue), digits),
  );

  useEffect(() => {
    setUnitDraft(formatDecimalField(String(settings.unitValue), digits));
  }, [digits, settings.unitValue]);

  function commitUnit(raw: string) {
    const next = parseDecimal(raw);
    if (!Number.isFinite(next) || next <= 0) {
      setUnitDraft(formatDecimalField(String(settings.unitValue), digits));
      return;
    }
    const formatted = formatDecimalField(String(next), digits);
    setUnitDraft(formatted);
    onUnitValueChange(Number(formatted));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="block text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
          {t("currency")}
        </span>
        <select
          value={settings.currency}
          onChange={(event) =>
            onCurrencyChange(event.target.value as BankrollCurrency)
          }
          className={`${fieldClass} min-w-[11rem]`}
        >
          {BANKROLL_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {currencyLabel(code)}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1">
        <span className="block text-[11px] uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
          1u
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={unitDraft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) =>
            setUnitDraft(event.target.value.replace(/[^\d.,]/g, ""))
          }
          onBlur={(event) => commitUnit(event.target.value)}
          className={`${fieldClass} w-28 font-mono tabular-nums`}
          aria-label={t("unitValueAria")}
        />
      </label>
      <p className="pb-2 text-xs text-[var(--apex-fg-muted)]">
        1u = {money(settings.unitValue)}
      </p>
    </div>
  );
}
