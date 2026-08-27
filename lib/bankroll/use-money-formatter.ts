"use client";

import { useMemo } from "react";
import {
  formatMoney,
  formatSignedMoney,
  type BankrollCurrency,
} from "@/lib/bankroll/currency";

export function useMoneyFormatter(currency: BankrollCurrency) {
  return useMemo(
    () => ({
      money: (value: number) => formatMoney(value, currency),
      signed: (value: number) => formatSignedMoney(value, currency),
    }),
    [currency],
  );
}
