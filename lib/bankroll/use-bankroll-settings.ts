"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_BANKROLL_SETTINGS,
  parseBankrollSettings,
  readBankrollSettings,
  writeBankrollSettings,
  type BankrollSettings,
} from "@/lib/bankroll/settings";
import type { BankrollCurrency } from "@/lib/bankroll/currency";

export function useBankrollSettings() {
  const [settings, setSettings] = useState<BankrollSettings>(
    DEFAULT_BANKROLL_SETTINGS,
  );

  useEffect(() => {
    setSettings(readBankrollSettings());
  }, []);

  const update = useCallback((patch: Partial<BankrollSettings>) => {
    setSettings((current) => {
      const next = parseBankrollSettings({ ...current, ...patch });
      writeBankrollSettings(next);
      return next;
    });
  }, []);

  const setCurrency = useCallback(
    (currency: BankrollCurrency) => update({ currency }),
    [update],
  );

  const setUnitValue = useCallback(
    (unitValue: number) => update({ unitValue }),
    [update],
  );

  return { settings, setCurrency, setUnitValue };
}
