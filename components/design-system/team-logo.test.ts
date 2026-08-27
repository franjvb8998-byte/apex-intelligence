import { describe, expect, it } from "vitest";
import { teamLogoSrc } from "@/components/design-system/team-logo";

describe("teamLogoSrc", () => {
  it("keeps http(s) API-Football crest URLs", () => {
    expect(
      teamLogoSrc("https://media.api-sports.io/football/teams/42.png"),
    ).toBe("https://media.api-sports.io/football/teams/42.png");
  });

  it("rejects empty or non-http values", () => {
    expect(teamLogoSrc(null)).toBeNull();
    expect(teamLogoSrc("")).toBeNull();
    expect(teamLogoSrc("  ")).toBeNull();
    expect(teamLogoSrc("/local/crest.png")).toBeNull();
  });
});
