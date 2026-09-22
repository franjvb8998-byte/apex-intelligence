import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_NEW_TICKETS_PER_RUN,
  parseLifecycleLeagueIds,
  parseMaxNewTicketsPerRun,
  readPrematchLifecycleConfig,
} from "@/lib/prematch-lifecycle/config";

describe("prematch lifecycle config", () => {
  it("parses unique numeric league ids", () => {
    expect(parseLifecycleLeagueIds("39, 140,39, 135")).toEqual({
      leagueIds: ["39", "135", "140"],
      invalid: false,
    });
  });

  it("treats missing allowlist as empty — no global capture", () => {
    expect(parseLifecycleLeagueIds(undefined)).toEqual({
      leagueIds: [],
      invalid: false,
    });
    expect(parseLifecycleLeagueIds("")).toEqual({
      leagueIds: [],
      invalid: false,
    });
    expect(parseLifecycleLeagueIds("   ")).toEqual({
      leagueIds: [],
      invalid: false,
    });
    expect(readPrematchLifecycleConfig({}).leagueIds).toEqual([]);
    expect(readPrematchLifecycleConfig({}).leagueAllowlistInvalid).toBe(false);
  });

  it("R. mixed invalid tokens fail-entire and never capture worldwide", () => {
    expect(parseLifecycleLeagueIds("39, 140,39, abc, 02, 135")).toEqual({
      leagueIds: [],
      invalid: true,
    });
    expect(parseLifecycleLeagueIds("abc")).toEqual({
      leagueIds: [],
      invalid: true,
    });
    const cfg = readPrematchLifecycleConfig({
      APEX_LIFECYCLE_LEAGUE_IDS: "39 extra",
    });
    expect(cfg.leagueIds).toEqual([]);
    expect(cfg.leagueAllowlistInvalid).toBe(true);
  });

  it("defaults max new tickets to 10 and clamps the ceiling", () => {
    expect(parseMaxNewTicketsPerRun(undefined)).toBe(
      DEFAULT_MAX_NEW_TICKETS_PER_RUN,
    );
    expect(parseMaxNewTicketsPerRun("0")).toBe(DEFAULT_MAX_NEW_TICKETS_PER_RUN);
    expect(parseMaxNewTicketsPerRun("-4")).toBe(DEFAULT_MAX_NEW_TICKETS_PER_RUN);
    expect(parseMaxNewTicketsPerRun("3")).toBe(3);
    expect(parseMaxNewTicketsPerRun("50")).toBe(50);
    expect(parseMaxNewTicketsPerRun("999")).toBe(50);
  });

  it("S. decimal max-per-run does not silently truncate", () => {
    expect(parseMaxNewTicketsPerRun("3.7")).toBe(DEFAULT_MAX_NEW_TICKETS_PER_RUN);
    expect(parseMaxNewTicketsPerRun("50.1")).toBe(
      DEFAULT_MAX_NEW_TICKETS_PER_RUN,
    );
    expect(parseMaxNewTicketsPerRun("10.9")).toBe(
      DEFAULT_MAX_NEW_TICKETS_PER_RUN,
    );
  });
});
