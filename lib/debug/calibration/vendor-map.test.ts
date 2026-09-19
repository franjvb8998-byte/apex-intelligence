/**
 * Durable extractOneXTwoOdds characterization.
 * Does not broaden matching. Zero live origin calls.
 */

import { describe, expect, it } from "vitest";
import { createRecordedApiFootballOddsResponse } from "@/lib/data-platform/providers/api-football/recorded-fixture";
import type { ApiFootballOddsResponse } from "@/lib/data-platform/providers/api-football/types";
import { extractOneXTwoOdds } from "@/lib/debug/calibration/vendor-map";

function oddsEnvelope(
  overrides: Partial<ApiFootballOddsResponse> = {},
): ApiFootballOddsResponse {
  return {
    get: "odds",
    parameters: { fixture: "1035089" },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [],
    ...overrides,
  };
}

function payloadWithBets(
  bets: Array<{ name: string; values: Array<{ value: string; odd: string }> }>,
  bookmaker = { id: 8, name: "Bet365" },
): ApiFootballOddsResponse {
  return oddsEnvelope({
    response: [
      {
        fixture: { id: 1035089 },
        bookmakers: [{ ...bookmaker, bets: bets.map((bet, index) => ({ id: index + 1, ...bet })) }],
      },
    ],
  });
}

describe("extractOneXTwoOdds", () => {
  it("extracts canonical Match Winner Home/Draw/Away", () => {
    const extracted = extractOneXTwoOdds(
      payloadWithBets([
        {
          name: "Match Winner",
          values: [
            { value: "Home", odd: "1.80" },
            { value: "Draw", odd: "3.50" },
            { value: "Away", odd: "4.20" },
          ],
        },
      ]),
    );
    expect(extracted).toEqual({
      bookmaker: "Bet365",
      homeOdds: 1.8,
      drawOdds: 3.5,
      awayOdds: 4.2,
      vendorUpdateAt: null,
    });
  });

  it("accepts different capitalization and 1/X/2 labels", () => {
    const extracted = extractOneXTwoOdds(
      payloadWithBets([
        {
          name: "MATCH WINNER",
          values: [
            { value: "1", odd: "2.10" },
            { value: "X", odd: "3.20" },
            { value: "2", odd: "3.40" },
          ],
        },
      ]),
    );
    expect(extracted?.homeOdds).toBe(2.1);
    expect(extracted?.drawOdds).toBe(3.2);
    expect(extracted?.awayOdds).toBe(3.4);
  });

  it("prefers Pinnacle after sorting bookmakers by id", () => {
    const extracted = extractOneXTwoOdds(
      oddsEnvelope({
        response: [
          {
            bookmakers: [
              {
                id: 20,
                name: "Bet365",
                bets: [
                  {
                    id: 1,
                    name: "Match Winner",
                    values: [
                      { value: "Home", odd: "1.60" },
                      { value: "Draw", odd: "4.00" },
                      { value: "Away", odd: "5.00" },
                    ],
                  },
                ],
              },
              {
                id: 4,
                name: "Pinnacle",
                bets: [
                  {
                    id: 1,
                    name: "Match Winner",
                    values: [
                      { value: "Home", odd: "1.70" },
                      { value: "Draw", odd: "4.10" },
                      { value: "Away", odd: "5.10" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect(extracted?.bookmaker).toBe("Pinnacle");
    expect(extracted?.homeOdds).toBe(1.7);
  });

  it("returns null when bookmakers are missing", () => {
    expect(
      extractOneXTwoOdds(
        oddsEnvelope({
          response: [{ fixture: { id: 1035089 }, bookmakers: [] }],
        }),
      ),
    ).toBeNull();
  });

  it("returns null when the 1X2 market is missing", () => {
    expect(
      extractOneXTwoOdds(
        payloadWithBets([
          {
            name: "Goals Over/Under",
            values: [
              { value: "Over 2.5", odd: "1.80" },
              { value: "Under 2.5", odd: "2.00" },
            ],
          },
        ]),
      ),
    ).toBeNull();
  });

  it("returns null when H/D/A is incomplete", () => {
    expect(
      extractOneXTwoOdds(
        payloadWithBets([
          {
            name: "Match Winner",
            values: [
              { value: "Home", odd: "1.80" },
              { value: "Draw", odd: "3.50" },
            ],
          },
        ]),
      ),
    ).toBeNull();
  });

  it("extracts a valid complete 1x2 market by exact name", () => {
    const extracted = extractOneXTwoOdds(
      payloadWithBets([
        {
          name: "1x2",
          values: [
            { value: "home", odd: "2.05" },
            { value: "draw", odd: "3.10" },
            { value: "away", odd: "3.80" },
          ],
        },
      ]),
    );
    expect(extracted).toMatchObject({
      homeOdds: 2.05,
      drawOdds: 3.1,
      awayOdds: 3.8,
    });
  });

  it("extracts the recorded production sample", () => {
    const extracted = extractOneXTwoOdds(createRecordedApiFootballOddsResponse());
    expect(extracted?.bookmaker).toBe("Pinnacle");
    expect(extracted?.homeOdds).toBe(1.68);
  });

  it("does not fabricate odds from an empty historical payload", () => {
    expect(
      extractOneXTwoOdds(
        oddsEnvelope({
          results: 0,
          response: [],
        }),
      ),
    ).toBeNull();
  });
});
