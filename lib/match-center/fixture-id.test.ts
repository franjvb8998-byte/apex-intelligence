import { describe, expect, it } from "vitest";
import {
  firstSearchParam,
  fixtureIdFromMatch,
  matchAnalysisHref,
  matchCenterHref,
  matchesFixtureId,
  vendorFixtureId,
} from "@/lib/match-center/fixture-id";

describe("vendorFixtureId", () => {
  it("keeps numeric API-Football ids", () => {
    expect(vendorFixtureId("1635059")).toBe("1635059");
  });

  it("extracts the tail of an Apex id", () => {
    expect(vendorFixtureId("apex:api-football:match:1635059")).toBe("1635059");
  });

  it("returns null for empty values", () => {
    expect(vendorFixtureId("")).toBeNull();
    expect(vendorFixtureId(undefined)).toBeNull();
  });
});

describe("matchCenterHref", () => {
  it("builds a path-based Match Center URL", () => {
    expect(matchCenterHref("1635059")).toBe("/match-center/1635059");
    expect(matchCenterHref("apex:api-football:match:99")).toBe(
      "/match-center/99",
    );
  });
});

describe("matchAnalysisHref", () => {
  it("builds a path-based Match Analysis URL", () => {
    expect(matchAnalysisHref("1635059")).toBe("/match-analysis/1635059");
  });
});

describe("fixtureIdFromMatch", () => {
  it("prefers externalId over the Apex id", () => {
    expect(
      fixtureIdFromMatch({
        id: "apex:api-football:match:1",
        externalId: "99",
      }),
    ).toBe("99");
  });
});

describe("matchesFixtureId", () => {
  it("matches either Apex or vendor id", () => {
    const match = {
      id: "apex:api-football:match:1635059",
      externalId: "1635059",
    };
    expect(matchesFixtureId(match, "1635059")).toBe(true);
    expect(matchesFixtureId(match, "apex:api-football:match:1635059")).toBe(
      true,
    );
    expect(matchesFixtureId(match, "1")).toBe(false);
  });
});

describe("firstSearchParam", () => {
  it("reads fixture or matchId query values", () => {
    expect(firstSearchParam("137")).toBe("137");
    expect(firstSearchParam(["137", "2"])).toBe("137");
    expect(firstSearchParam("  ")).toBeUndefined();
  });
});
