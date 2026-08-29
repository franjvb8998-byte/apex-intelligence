"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { BetSummaryCard } from "@/components/bankroll/bet-summary-card";
import { DecimalField } from "@/components/bankroll/decimal-field";
import { MatchPicker } from "@/components/bankroll/match-picker";
import { cx } from "@/components/design-system/utils";
import {
  currencyFractionDigits,
  formatMoney,
  type BankrollCurrency,
} from "@/lib/bankroll/currency";
import {
  BANKROLL_MARKETS,
  STAKE_UNIT_MULTIPLIERS,
  parseDecimal,
  stakeForUnits,
  type AddBetFormValue,
} from "@/lib/bankroll/form";
import type { BetPreview, BankrollFixture, BetResult } from "@/lib/bankroll/types";

const RESULT_OPTIONS: BetResult[] = ["pending", "won", "lost", "void"];

function marketLabel(
  t: ReturnType<typeof useTranslations<"bankroll">>,
  market: string,
): string {
  if (market === "1X2 · Local") return t("marketHome");
  if (market === "1X2 · Empate") return t("marketDraw");
  if (market === "1X2 · Visitante") return t("marketAway");
  if (market === "BTTS · Sí") return t("marketBttsYes");
  if (market === "BTTS · No") return t("marketBttsNo");
  return market;
}

const selectClass =
  "apex-focusable h-12 w-full rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] bg-slate-950/50 px-3 text-sm text-[var(--apex-fg)] outline-none transition-colors focus:border-[var(--apex-accent-border)]";

type AddBetModalProps = {
  open: boolean;
  value: AddBetFormValue;
  fixtures: BankrollFixture[];
  unitValue: number;
  currency: BankrollCurrency;
  preview: BetPreview;
  valid: boolean;
  onChange: (value: AddBetFormValue) => void;
  onSelectFixture: (fixture: BankrollFixture) => void;
  onMarketChange: (market: string) => void;
  onStakeUnits: (units: number) => void;
  onClose: () => void;
  onSubmit: () => void;
  error?: string | null;
};

export function AddBetModal({
  open,
  value,
  fixtures,
  unitValue,
  currency,
  preview,
  valid,
  onChange,
  onSelectFixture,
  onMarketChange,
  onStakeUnits,
  onClose,
  onSubmit,
  error,
}: AddBetModalProps) {
  const t = useTranslations("bankroll");
  const common = useTranslations("common");
  const titleId = useId();
  const oddsRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();
  const stake = parseDecimal(value.stake);
  const digits = currencyFractionDigits(currency);
  const pending = value.result === "pending";

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const duration = reduceMotion ? 0 : 0.22;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center overscroll-none p-3 sm:p-4"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label={t("closeModal")}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex max-h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[var(--apex-radius-2xl)] border border-[var(--apex-border-strong)] bg-[var(--apex-bg-elevated)] shadow-[var(--apex-shadow-lg)]"
          >
            <div className="shrink-0 px-5 pb-3 pt-5 sm:px-6">
              <h2
                id={titleId}
                className="text-lg font-semibold text-[var(--apex-fg)]"
              >
                {t("addBet")}
              </h2>
              <p className="mt-1 text-sm text-[var(--apex-fg-muted)]">
                {t("addBetDescription")}
              </p>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                if (valid) onSubmit();
              }}
            >
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-1 sm:px-6">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                    {t("colMatch")}
                  </span>
                  <MatchPicker
                    fixtures={fixtures}
                    selectedId={value.fixtureId}
                    onSelect={(match) => {
                      onSelectFixture(match);
                      window.setTimeout(() => {
                        oddsRef.current?.focus();
                        oddsRef.current?.select();
                      }, 30);
                    }}
                  />
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                    {t("colMarket")}
                  </span>
                  <select
                    value={value.market}
                    onChange={(event) => onMarketChange(event.target.value)}
                    className={selectClass}
                    required
                  >
                    {BANKROLL_MARKETS.map((market) => (
                      <option key={market} value={market}>
                        {marketLabel(t, market)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <DecimalField
                    inputRef={oddsRef}
                    label={t("colOdds")}
                    value={value.odds}
                    digits={2}
                    onChange={(oddsValue) =>
                      onChange({ ...value, odds: oddsValue })
                    }
                  />
                  <DecimalField
                    label={t("colStake")}
                    value={value.stake}
                    digits={digits}
                    onChange={(stakeValue) =>
                      onChange({ ...value, stake: stakeValue })
                    }
                  />
                </div>

                <div>
                  <p className="text-xs font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                    {t("quickStake")}
                    <span className="ml-2 font-normal normal-case tracking-normal text-[var(--apex-fg-muted)]">
                      1u = {formatMoney(unitValue, currency)}
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {STAKE_UNIT_MULTIPLIERS.map((units) => {
                      const amount = stakeForUnits(unitValue, units);
                      const selected =
                        Number.isFinite(stake) &&
                        Math.abs(stake - amount) < 0.009;
                      return (
                        <button
                          key={units}
                          type="button"
                          onClick={() => onStakeUnits(units)}
                          className={cx(
                            "apex-focusable h-9 min-w-12 rounded-[var(--apex-radius-md)] border px-2.5 text-xs font-medium tabular-nums transition-colors",
                            selected
                              ? "border-[var(--apex-accent-border)] bg-[var(--apex-accent-muted)] text-[var(--apex-accent)]"
                              : "border-[var(--apex-border)] text-[var(--apex-fg-muted)] hover:border-[var(--apex-accent-border)] hover:text-[var(--apex-fg)]",
                          )}
                        >
                          {units}u
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium uppercase tracking-[var(--apex-tracking-wider)] text-[var(--apex-fg-subtle)]">
                    {t("result")}
                  </span>
                  <select
                    value={value.result}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        result: event.target.value as BetResult,
                      })
                    }
                    className={selectClass}
                  >
                    {RESULT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(
                          option === "won"
                            ? "resultWon"
                            : option === "lost"
                              ? "resultLost"
                              : option === "void"
                                ? "resultVoid"
                                : "resultPending",
                        )}
                      </option>
                    ))}
                  </select>
                </label>

                <BetSummaryCard
                  preview={preview}
                  market={value.market}
                  currency={currency}
                />

                {pending ? (
                  <p className="text-xs text-[var(--apex-fg-muted)]">
                    {t("pendingUnsettled")}
                  </p>
                ) : null}

                {error ? (
                  <p className="text-sm text-[var(--apex-danger)]" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-[var(--apex-border)] bg-[var(--apex-bg-elevated)] px-5 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="apex-focusable rounded-[var(--apex-radius-md)] border border-[var(--apex-border)] px-4 py-2 text-sm text-[var(--apex-fg-muted)] transition-colors hover:text-[var(--apex-fg)]"
                >
                  {common("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={!valid}
                  className="apex-focusable rounded-[var(--apex-radius-md)] bg-[var(--apex-accent)] px-4 py-2 text-sm font-medium text-[var(--apex-fg-inverse)] transition-opacity hover:bg-[var(--apex-accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t("saveBet")}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export { BANKROLL_MARKETS };
export type { AddBetFormValue };
