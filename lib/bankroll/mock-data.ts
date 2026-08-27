/**
 * Simulated My Bankroll ledger — replace with persistence later.
 */

import { buildBankrollData } from "@/lib/bankroll/calculate";
import type { BankrollBetDraft, BankrollData } from "@/lib/bankroll/types";

export const MOCK_INITIAL_BANKROLL = 1_000;

export const MOCK_BANKROLL_BETS: BankrollBetDraft[] = [
  {
    id: "bet-001",
    placedAt: "2026-03-08T15:00:00.000Z",
    match: "Arsenal vs Chelsea",
    market: "1X2 · Local",
    odds: 1.85,
    stake: 50,
    result: "won",
  },
  {
    id: "bet-002",
    placedAt: "2026-03-22T17:30:00.000Z",
    match: "Barcelona vs Girona",
    market: "Over 2.5",
    odds: 1.72,
    stake: 40,
    result: "lost",
  },
  {
    id: "bet-003",
    placedAt: "2026-04-05T14:00:00.000Z",
    match: "Real Madrid vs Athletic",
    market: "BTTS · Sí",
    odds: 1.9,
    stake: 45,
    result: "won",
  },
  {
    id: "bet-004",
    placedAt: "2026-04-19T18:45:00.000Z",
    match: "Liverpool vs Everton",
    market: "1X2 · Local",
    odds: 1.55,
    stake: 60,
    result: "won",
  },
  {
    id: "bet-005",
    placedAt: "2026-05-03T16:00:00.000Z",
    match: "Inter vs Napoli",
    market: "Under 2.5",
    odds: 2.05,
    stake: 35,
    result: "lost",
  },
  {
    id: "bet-006",
    placedAt: "2026-05-17T19:00:00.000Z",
    match: "Bayern vs Dortmund",
    market: "1X2 · Visitante",
    odds: 3.4,
    stake: 25,
    result: "lost",
  },
  {
    id: "bet-007",
    placedAt: "2026-06-07T15:30:00.000Z",
    match: "Portugal vs España",
    market: "BTTS · No",
    odds: 2.2,
    stake: 40,
    result: "void",
  },
  {
    id: "bet-008",
    placedAt: "2026-06-21T20:00:00.000Z",
    match: "Francia vs Países Bajos",
    market: "Over 2.5",
    odds: 1.95,
    stake: 50,
    result: "won",
  },
  {
    id: "bet-009",
    placedAt: "2026-07-12T16:00:00.000Z",
    match: "Manchester City vs Tottenham",
    market: "1X2 · Local",
    odds: 1.62,
    stake: 55,
    result: "won",
  },
  {
    id: "bet-010",
    placedAt: "2026-07-26T14:00:00.000Z",
    match: "Atlético vs Sevilla",
    market: "Over 2.5",
    odds: 2.1,
    stake: 30,
    result: "lost",
  },
  {
    id: "bet-011",
    placedAt: "2026-08-09T18:00:00.000Z",
    match: "Juventus vs Milan",
    market: "1X2 · Empate",
    odds: 3.25,
    stake: 20,
    result: "won",
  },
  {
    id: "bet-012",
    placedAt: "2026-08-16T15:00:00.000Z",
    match: "PSG vs Marseille",
    market: "BTTS · Sí",
    odds: 1.8,
    stake: 40,
    result: "won",
  },
  {
    id: "bet-013",
    placedAt: "2026-08-27T10:00:00.000Z",
    match: "Newcastle vs Brighton",
    market: "Under 2.5",
    odds: 2.15,
    stake: 35,
    result: "lost",
  },
  {
    id: "bet-014",
    placedAt: "2026-08-27T12:00:00.000Z",
    match: "Arsenal vs Manchester United",
    market: "1X2 · Local",
    odds: 1.7,
    stake: 50,
    result: "pending",
  },
];

export function getMockBankroll(
  now: Date = new Date("2026-08-27T16:00:00.000Z"),
): BankrollData {
  return buildBankrollData(MOCK_INITIAL_BANKROLL, MOCK_BANKROLL_BETS, now);
}
