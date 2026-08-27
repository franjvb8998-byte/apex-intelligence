import { describe, expect, it } from "vitest";
import {
  BANKROLL_CURRENCIES,
  DEFAULT_CURRENCY,
  currencyFractionDigits,
  formatMoney,
  formatSignedMoney,
  isBankrollCurrency,
} from "@/lib/bankroll/currency";
import { parseBankrollSettings } from "@/lib/bankroll/settings";

describe("currency formatter", () => {
  it("defaults to HNL and lists ISO codes", () => {
    expect(DEFAULT_CURRENCY).toBe("HNL");
    expect(BANKROLL_CURRENCIES[0]).toBe("HNL");
    expect(isBankrollCurrency("EUR")).toBe(true);
    expect(isBankrollCurrency("XXX")).toBe(false);
  });

  it("formats with Intl.NumberFormat and never a hardcoded symbol table", () => {
    const hnl = formatMoney(100, "HNL");
    const usd = formatMoney(100, "USD");
    expect(hnl).toBe(
      new Intl.NumberFormat("es", { style: "currency", currency: "HNL" }).format(
        100,
      ),
    );
    expect(usd).not.toBe(hnl);
    expect(formatSignedMoney(25, "EUR")).toBe(
      new Intl.NumberFormat("es", {
        style: "currency",
        currency: "EUR",
        signDisplay: "exceptZero",
      }).format(25),
    );
  });

  it("uses 0 fraction digits for JPY", () => {
    expect(currencyFractionDigits("JPY")).toBe(0);
  });
});

describe("parseBankrollSettings", () => {
  it("falls back to 100 HNL", () => {
    expect(parseBankrollSettings(null)).toEqual({
      currency: "HNL",
      unitValue: 100,
    });
    expect(parseBankrollSettings({ currency: "USD", unitValue: 25 })).toEqual({
      currency: "USD",
      unitValue: 25,
    });
    expect(parseBankrollSettings({ currency: "NOPE", unitValue: -1 })).toEqual({
      currency: "HNL",
      unitValue: 100,
    });
  });
});
