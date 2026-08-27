/**
 * ISO 4217 currencies for My Bankroll. Display via Intl only — never hardcode symbols.
 */

export const BANKROLL_CURRENCIES = [
  "HNL",
  "USD",
  "EUR",
  "GBP",
  "MXN",
  "COP",
  "ARS",
  "CLP",
  "PEN",
  "BRL",
  "CRC",
  "GTQ",
  "NIO",
  "DOP",
  "PYG",
  "UYU",
  "BOB",
  "CAD",
  "AUD",
  "CHF",
  "JPY",
] as const;

export type BankrollCurrency = (typeof BANKROLL_CURRENCIES)[number];

export const DEFAULT_CURRENCY: BankrollCurrency = "HNL";

const DISPLAY_LOCALE = "es";

const cache = new Map<string, Intl.NumberFormat>();

export function isBankrollCurrency(value: string): value is BankrollCurrency {
  return (BANKROLL_CURRENCIES as readonly string[]).includes(value);
}

function formatter(
  currency: BankrollCurrency,
  signed: boolean,
): Intl.NumberFormat {
  const key = `${currency}:${signed ? "signed" : "plain"}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const instance = new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency,
    signDisplay: signed ? "exceptZero" : "auto",
  });
  cache.set(key, instance);
  return instance;
}

export function currencyFractionDigits(currency: BankrollCurrency): number {
  const digits = formatter(currency, false).resolvedOptions()
    .maximumFractionDigits;
  return typeof digits === "number" ? digits : 2;
}

export function formatMoney(value: number, currency: BankrollCurrency): string {
  return formatter(currency, false).format(value);
}

export function formatSignedMoney(
  value: number,
  currency: BankrollCurrency,
): string {
  return formatter(currency, true).format(value);
}

export function currencyLabel(
  currency: BankrollCurrency,
  locale = DISPLAY_LOCALE,
): string {
  const name = new Intl.DisplayNames(locale, { type: "currency" }).of(currency);
  return name ? `${currency} · ${name}` : currency;
}
