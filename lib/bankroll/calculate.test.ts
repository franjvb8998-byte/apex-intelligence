import { describe, expect, it } from "vitest";
import {
  buildBankrollData,
  profitForBet,
} from "@/lib/bankroll/calculate";
import { getMockBankroll } from "@/lib/bankroll/mock-data";
import type { BankrollBetDraft } from "@/lib/bankroll/types";

describe("profitForBet", () => {
  it("settles wins, losses, voids and pending stakes", () => {
    expect(profitForBet(1.85, 50, "won")).toBe(42.5);
    expect(profitForBet(2.0, 40, "lost")).toBe(-40);
    expect(profitForBet(2.2, 40, "void")).toBe(0);
    expect(profitForBet(1.7, 50, "pending")).toBeNull();
  });
});

describe("buildBankrollData", () => {
  const drafts: BankrollBetDraft[] = [
    {
      id: "a",
      placedAt: "2026-08-01T12:00:00.000Z",
      match: "A vs B",
      market: "1X2 · Local",
      odds: 2,
      stake: 100,
      result: "won",
    },
    {
      id: "b",
      placedAt: "2026-08-27T12:00:00.000Z",
      match: "C vs D",
      market: "Over 2.5",
      odds: 1.8,
      stake: 50,
      result: "lost",
    },
  ];

  it("computes ROI, yield, win rate and averages", () => {
    const data = buildBankrollData(1_000, drafts, new Date("2026-08-27T16:00:00.000Z"));
    expect(data.metrics.totalProfit).toBe(50);
    expect(data.metrics.currentBankroll).toBe(1_050);
    expect(data.metrics.todayProfit).toBe(-50);
    expect(data.metrics.roi).toBeCloseTo(50 / 150);
    expect(data.metrics.yield).toBeCloseTo(50 / 150);
    expect(data.metrics.roi).toBe(data.metrics.yield);
    expect(data.metrics.stakeRisked).toBe(150);
    expect(data.metrics.winRate).toBeCloseTo(0.5);
    expect(data.metrics.averageOdds).toBeCloseTo(1.9);
    expect(data.metrics.betCount).toBe(2);
  });

  it("ignores pending bets in ROI, yield and win rate", () => {
    const withPending: BankrollBetDraft[] = [
      ...drafts,
      {
        id: "p",
        placedAt: "2026-08-27T18:00:00.000Z",
        match: "E vs F",
        market: "Over 2.5",
        odds: 1.9,
        stake: 80,
        result: "pending",
      },
    ];
    const settled = buildBankrollData(
      1_000,
      drafts,
      new Date("2026-08-27T16:00:00.000Z"),
    );
    const pending = buildBankrollData(
      1_000,
      withPending,
      new Date("2026-08-27T16:00:00.000Z"),
    );
    expect(pending.metrics.roi).toBe(settled.metrics.roi);
    expect(pending.metrics.yield).toBe(settled.metrics.yield);
    expect(pending.metrics.winRate).toBe(settled.metrics.winRate);
    expect(pending.metrics.betCount).toBe(3);
  });

  it("builds evolution and monthly profit series", () => {
    const data = buildBankrollData(1_000, drafts, new Date("2026-08-27T16:00:00.000Z"));
    expect(data.evolution[0]?.balance).toBe(1_000);
    expect(data.evolution.at(-1)?.balance).toBe(1_050);
    expect(data.monthlyProfit).toHaveLength(1);
    expect(data.monthlyProfit[0]?.month).toBe("2026-08");
    expect(data.monthlyProfit[0]?.label.toLowerCase()).toContain("ago");
    expect(data.monthlyProfit[0]?.profit).toBe(50);
  });
});

describe("getMockBankroll", () => {
  it("returns a populated mock ledger", () => {
    const data = getMockBankroll();
    expect(data.source).toBe("mock");
    expect(data.bets.length).toBeGreaterThan(8);
    expect(data.metrics.currentBankroll).not.toBe(data.metrics.initialBankroll);
    expect(data.evolution.length).toBeGreaterThan(1);
    expect(data.monthlyProfit.length).toBeGreaterThan(1);
    expect(data.bets.some((bet) => bet.result === "pending")).toBe(true);
    expect(data.metrics.todayProfit).toBe(-35);
    expect(data.currency).toBe("HNL");
  });
});
