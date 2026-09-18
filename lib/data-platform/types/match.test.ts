import { describe, expect, it } from "vitest";
import { isTerminalApexMatchStatus } from "@/lib/data-platform/types/match";
import { mapApiFootballStatus } from "@/lib/data-platform/providers/api-football/mapper";

describe("isTerminalApexMatchStatus", () => {
  it("treats finished and cancelled as terminal", () => {
    expect(isTerminalApexMatchStatus("finished")).toBe(true);
    expect(isTerminalApexMatchStatus("cancelled")).toBe(true);
  });

  it("does not treat in-play or unresolved statuses as terminal", () => {
    expect(isTerminalApexMatchStatus("scheduled")).toBe(false);
    expect(isTerminalApexMatchStatus("live")).toBe(false);
    expect(isTerminalApexMatchStatus("postponed")).toBe(false);
    expect(isTerminalApexMatchStatus("suspended")).toBe(false);
    expect(isTerminalApexMatchStatus("unknown")).toBe(false);
  });

  it("matches vendor shorts already mapped by the canonical model", () => {
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("FT"))).toBe(true);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("AET"))).toBe(true);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("PEN"))).toBe(true);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("CANC"))).toBe(true);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("ABD"))).toBe(true);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("AWD"))).toBe(true);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("WO"))).toBe(true);

    expect(isTerminalApexMatchStatus(mapApiFootballStatus("NS"))).toBe(false);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("TBD"))).toBe(false);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("HT"))).toBe(false);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("LIVE"))).toBe(false);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("PST"))).toBe(false);
    expect(isTerminalApexMatchStatus(mapApiFootballStatus("SUSP"))).toBe(false);
  });
});
