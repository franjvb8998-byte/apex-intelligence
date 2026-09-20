import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  matchCenterHeaderDescriptionKey,
  matchCenterHeaderPhaseKey,
} from "@/lib/match-center/header-copy";
import en from "@/messages/en.json";
import es from "@/messages/es.json";

const RICH_CLAIM = /probability|EV|markets|catalogue context/i;
const LIVE_LITE_FORBIDDEN = /decision dashboard with probability/i;

describe("Match Center header copy routing", () => {
  it("keeps rich prematch wording when Live Lite is off", () => {
    expect(matchCenterHeaderDescriptionKey(false, "preview")).toBe(
      "headerDescription",
    );
    expect(matchCenterHeaderDescriptionKey(false, "live")).toBe(
      "headerDescription",
    );
    expect(matchCenterHeaderDescriptionKey(false, "post")).toBe(
      "headerDescription",
    );
    expect(matchCenterHeaderPhaseKey(false, "live")).toBe("headerLive");
    expect(en.matchCenter.headerDescription).toMatch(RICH_CLAIM);
    expect(es.matchCenter.headerDescription).toMatch(/probabilidad|EV|mercados/i);
  });

  it("uses honest Live Lite keys that do not claim PE, EV, or markets are loaded", () => {
    expect(matchCenterHeaderPhaseKey(true, "live")).toBe("headerLiveLite");
    expect(matchCenterHeaderDescriptionKey(true, "live")).toBe(
      "headerDescriptionLiveLiteLive",
    );
    expect(matchCenterHeaderDescriptionKey(true, "preview")).toBe(
      "headerDescriptionLiveLitePreview",
    );
    expect(matchCenterHeaderDescriptionKey(true, "post")).toBe(
      "headerDescriptionLiveLitePost",
    );

    const liveEn = en.matchCenter.headerDescriptionLiveLiteLive;
    const liveEs = es.matchCenter.headerDescriptionLiveLiteLive;
    expect(liveEn).not.toMatch(LIVE_LITE_FORBIDDEN);
    expect(liveEs).not.toMatch(LIVE_LITE_FORBIDDEN);
    expect(liveEn).toMatch(/APEX Vision/i);
    expect(liveEn).toMatch(/score/i);
    expect(liveEn).toMatch(/schematic/i);
    expect(liveEn).toMatch(/not exact/i);
    expect(liveEn).toMatch(/not loaded/i);
    expect(liveEs).toMatch(/APEX Vision/i);
    expect(liveEs).toMatch(/esquemático/i);

    for (const key of [
      "headerDescriptionLiveLiteLive",
      "headerDescriptionLiveLitePreview",
      "headerDescriptionLiveLitePost",
    ] as const) {
      expect(en.matchCenter[key]).not.toMatch(LIVE_LITE_FORBIDDEN);
      expect(es.matchCenter[key]).not.toMatch(LIVE_LITE_FORBIDDEN);
      expect(en.matchCenter[key].toLowerCase()).not.toContain(
        "currently available",
      );
    }
  });

  it("header component interpolates the routed Live Lite key", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/match-center/match-center-header.tsx"),
      "utf8",
    );
    expect(src).toContain("matchCenterHeaderDescriptionKey");
    expect(src).toContain("matchCenterHeaderPhaseKey");
    expect(src).toContain("liveLite");
  });
});
