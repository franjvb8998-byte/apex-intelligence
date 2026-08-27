"use client";

import { useCallback, useMemo, useState } from "react";
import { betPreview, createBetId } from "@/lib/bankroll/calculate";
import {
  currencyFractionDigits,
  type BankrollCurrency,
} from "@/lib/bankroll/currency";
import {
  emptyAddBetForm,
  formatDecimalField,
  isAddBetValid,
  parseDecimal,
  stakeForUnits,
  type AddBetFormValue,
} from "@/lib/bankroll/form";
import { matchLabel } from "@/lib/bankroll/match-search";
import type { BankrollBetDraft, BankrollFixture } from "@/lib/bankroll/types";
import { fixtureIdFromMatch } from "@/lib/match-center/fixture-id";

function applySuggestedOdds(
  form: AddBetFormValue,
  fixture: BankrollFixture | undefined,
  market: string,
): AddBetFormValue {
  const suggested = fixture?.suggestedOdds[market];
  if (suggested == null) return { ...form, market };
  return {
    ...form,
    market,
    odds: formatDecimalField(String(suggested), 2),
  };
}

export function useAddBetForm(options: {
  unitValue: number;
  currency: BankrollCurrency;
  fixtures: BankrollFixture[];
}) {
  const { unitValue, currency, fixtures } = options;
  const [form, setForm] = useState<AddBetFormValue>(() =>
    emptyAddBetForm(unitValue, currency),
  );
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => fixtures.find((item) => fixtureIdFromMatch(item) === form.fixtureId),
    [fixtures, form.fixtureId],
  );

  const preview = useMemo(() => {
    const odds = parseDecimal(form.odds);
    const stake = parseDecimal(form.stake);
    return betPreview(odds, stake);
  }, [form.odds, form.stake]);

  const valid = isAddBetValid(form);
  const digits = currencyFractionDigits(currency);

  const reset = useCallback(() => {
    setForm(emptyAddBetForm(unitValue, currency));
    setError(null);
  }, [currency, unitValue]);

  const selectFixture = useCallback(
    (fixture: BankrollFixture) => {
      setForm((current) =>
        applySuggestedOdds(
          {
            ...current,
            fixtureId: fixtureIdFromMatch(fixture) ?? fixture.id,
            match: matchLabel(fixture),
          },
          fixture,
          current.market,
        ),
      );
    },
    [],
  );

  const setMarket = useCallback(
    (market: string) => {
      setForm((current) => applySuggestedOdds(current, selected, market));
    },
    [selected],
  );

  const setStakeUnits = useCallback(
    (units: number) => {
      setForm((current) => ({
        ...current,
        stake: stakeForUnits(unitValue, units).toFixed(digits),
      }));
    },
    [digits, unitValue],
  );

  function toDraft(): BankrollBetDraft | null {
    if (!isAddBetValid(form)) {
      setError("Completa partido, mercado, cuota y stake.");
      return null;
    }
    return {
      id: createBetId(),
      placedAt: new Date().toISOString(),
      match: form.match.trim(),
      market: form.market,
      odds: parseDecimal(form.odds),
      stake: parseDecimal(form.stake),
      result: form.result,
    };
  }

  return {
    form,
    setForm,
    error,
    setError,
    valid,
    preview,
    selected,
    reset,
    selectFixture,
    setMarket,
    setStakeUnits,
    toDraft,
  };
}
