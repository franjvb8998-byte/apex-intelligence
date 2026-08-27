/**
 * Persisted Bankroll display settings (currency + 1u). Amounts stay numeric.
 */

import {
  DEFAULT_CURRENCY,
  isBankrollCurrency,
  type BankrollCurrency,
} from "@/lib/bankroll/currency";

export const DEFAULT_UNIT_VALUE = 100;

export const BANKROLL_SETTINGS_STORAGE_KEY = "apex.bankroll.settings.v1";

export type BankrollSettings = {
  currency: BankrollCurrency;
  /** Numeric size of 1u in the selected currency (default 100 HNL). */
  unitValue: number;
};

export const DEFAULT_BANKROLL_SETTINGS: BankrollSettings = {
  currency: DEFAULT_CURRENCY,
  unitValue: DEFAULT_UNIT_VALUE,
};

export function parseBankrollSettings(raw: unknown): BankrollSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_BANKROLL_SETTINGS;
  const record = raw as Record<string, unknown>;
  const currency =
    typeof record.currency === "string" && isBankrollCurrency(record.currency)
      ? record.currency
      : DEFAULT_CURRENCY;
  const unitValue =
    typeof record.unitValue === "number" &&
    Number.isFinite(record.unitValue) &&
    record.unitValue > 0
      ? record.unitValue
      : DEFAULT_UNIT_VALUE;
  return { currency, unitValue };
}

export function readBankrollSettings(): BankrollSettings {
  if (typeof window === "undefined") return DEFAULT_BANKROLL_SETTINGS;
  try {
    const raw = window.localStorage.getItem(BANKROLL_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_BANKROLL_SETTINGS;
    return parseBankrollSettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_BANKROLL_SETTINGS;
  }
}

export function writeBankrollSettings(settings: BankrollSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BANKROLL_SETTINGS_STORAGE_KEY,
    JSON.stringify(settings),
  );
}
