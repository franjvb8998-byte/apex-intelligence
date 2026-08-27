/**
 * Add Bet form parsing, units and validation — no I/O.
 */

import { roundMoney } from "@/lib/bankroll/calculate";
import {
  currencyFractionDigits,
  DEFAULT_CURRENCY,
  type BankrollCurrency,
} from "@/lib/bankroll/currency";
import { DEFAULT_UNIT_VALUE } from "@/lib/bankroll/settings";
import type { BetResult } from "@/lib/bankroll/types";

export const BANKROLL_MARKETS = [
  "1X2 · Local",
  "1X2 · Empate",
  "1X2 · Visitante",
  "Over 2.5",
  "Under 2.5",
  "BTTS · Sí",
  "BTTS · No",
] as const;

export const STAKE_UNIT_MULTIPLIERS = [1, 2, 5, 10, 25] as const;

export type AddBetFormValue = {
  fixtureId: string;
  match: string;
  market: string;
  odds: string;
  stake: string;
  result: BetResult;
};

export function parseDecimal(raw: string): number {
  return Number.parseFloat(raw.trim().replace(",", "."));
}

export function formatDecimalField(
  raw: string,
  digits = 2,
): string {
  const value = parseDecimal(raw);
  if (!Number.isFinite(value)) return raw;
  return value.toFixed(digits);
}

export function isValidOdds(value: number): boolean {
  return Number.isFinite(value) && value > 1;
}

export function isValidStake(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function isAddBetValid(form: AddBetFormValue): boolean {
  return (
    form.fixtureId.trim().length > 0 &&
    form.match.trim().length > 0 &&
    form.market.trim().length > 0 &&
    isValidOdds(parseDecimal(form.odds)) &&
    isValidStake(parseDecimal(form.stake)) &&
    Boolean(form.result)
  );
}

export function stakeForUnits(unitValue: number, units: number): number {
  const one = Number.isFinite(unitValue) && unitValue > 0 ? unitValue : DEFAULT_UNIT_VALUE;
  return roundMoney(one * units);
}

export function emptyAddBetForm(
  unitValue: number = DEFAULT_UNIT_VALUE,
  currency: BankrollCurrency = DEFAULT_CURRENCY,
): AddBetFormValue {
  const digits = currencyFractionDigits(currency);
  return {
    fixtureId: "",
    match: "",
    market: BANKROLL_MARKETS[0],
    odds: "1.90",
    stake: stakeForUnits(unitValue, 1).toFixed(digits),
    result: "pending",
  };
}
