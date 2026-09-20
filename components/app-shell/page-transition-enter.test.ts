import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pageTransitionEnterInitial } from "@/components/app-shell/page-transition-enter";

describe("pageTransitionEnterInitial", () => {
  it("SSR and first client paint share animate styles (initial false)", () => {
    expect(
      pageTransitionEnterInitial({
        allowEnterAnimation: false,
        reduceMotion: null,
      }),
    ).toBe(false);
    expect(
      pageTransitionEnterInitial({
        allowEnterAnimation: false,
        reduceMotion: false,
      }),
    ).toBe(false);
    expect(
      pageTransitionEnterInitial({
        allowEnterAnimation: false,
        reduceMotion: true,
      }),
    ).toBe(false);
  });

  it("after hydration, only non-reduced-motion client navigations offset", () => {
    expect(
      pageTransitionEnterInitial({
        allowEnterAnimation: true,
        reduceMotion: false,
      }),
    ).toEqual({ opacity: 0, y: 8 });
    expect(
      pageTransitionEnterInitial({
        allowEnterAnimation: true,
        reduceMotion: true,
      }),
    ).toBe(false);
    expect(
      pageTransitionEnterInitial({
        allowEnterAnimation: true,
        reduceMotion: null,
      }),
    ).toBe(false);
  });

  it("PageTransition never selects the offset initial from reduceMotion during render", () => {
    const src = readFileSync(
      path.join(process.cwd(), "components/app-shell/page-transition.tsx"),
      "utf8",
    );
    expect(src).toContain("pageTransitionEnterInitial");
    expect(src).toContain("allowEnterAnimation: false");
    expect(src).not.toContain("reduceMotion === false ? { opacity: 0, y: 8 }");
  });
});
