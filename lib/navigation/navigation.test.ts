import { describe, expect, it } from "vitest";
import {
  ALL_NAV,
  PRIMARY_NAV,
  breadcrumbsForPath,
  buildCommandItems,
  titleKeyForPath,
} from "@/lib/navigation";
import { PRODUCT_NOTIFICATIONS } from "@/lib/navigation/notifications";

describe("Release 0.1 navigation", () => {
  it("exposes primary product links", () => {
    expect(PRIMARY_NAV[0]?.href).toBe("/scanner");
    expect(PRIMARY_NAV.some((n) => n.href === "/feed")).toBe(true);
    expect(PRIMARY_NAV.some((n) => n.id === "scanner")).toBe(true);
    expect(PRIMARY_NAV.some((n) => n.href === "/dashboard")).toBe(true);
    expect(PRIMARY_NAV.some((n) => n.href === "/copilot")).toBe(true);
    expect(PRIMARY_NAV.some((n) => n.href === "/match-center")).toBe(true);
    expect(ALL_NAV.length).toBeGreaterThanOrEqual(5);
  });

  it("builds breadcrumb and title keys", () => {
    expect(breadcrumbsForPath("/dashboard")).toEqual([{ key: "dashboard" }]);
    expect(breadcrumbsForPath("/match-center").at(-1)?.key).toBe("matchCenterTm");
    expect(breadcrumbsForPath("/match-center/1635059")).toEqual([
      { key: "dashboard", href: "/dashboard" },
      { key: "matchCenterTm", href: "/match-center" },
      { key: "match" },
    ]);
    expect(titleKeyForPath("/match-center/1635059")).toBe("match-center");
    expect(PRIMARY_NAV.some((n) => n.href === "/bankroll")).toBe(true);
    expect(titleKeyForPath("/scanner")).toBe("scanner");
    expect(breadcrumbsForPath("/scanner")).toEqual([{ key: "scanner" }]);
    expect(titleKeyForPath("/opportunities")).toBe("scanner");
    expect(breadcrumbsForPath("/opportunities").at(-1)?.key).toBe("scanner");
    expect(titleKeyForPath("/bankroll")).toBe("bankroll");
    expect(breadcrumbsForPath("/bankroll")).toEqual([
      { key: "dashboard", href: "/dashboard" },
      { key: "bankroll" },
    ]);
    expect(titleKeyForPath("/feed")).toBe("feed");
    expect(breadcrumbsForPath("/feed")).toEqual([{ key: "feed" }]);
    expect(titleKeyForPath("/portfolio")).toBe("portfolio");
    expect(titleKeyForPath("/lab")).toBe("lab");
    expect(PRIMARY_NAV.some((n) => n.href === "/lab")).toBe(true);
    expect(PRIMARY_NAV.some((n) => n.href === "/smart-combos")).toBe(true);
    expect(titleKeyForPath("/smart-combos")).toBe("smart-combos");
  });

  it("builds command palette items", () => {
    const items = buildCommandItems();
    expect(items.some((i) => i.href === "/scanner")).toBe(true);
    expect(items.some((i) => i.href === "/feed")).toBe(true);
    expect(items.some((i) => i.href === "/lab")).toBe(true);
    expect(items.some((i) => i.href === "/smart-combos")).toBe(true);
    expect(items.some((i) => i.href === "/bankroll")).toBe(true);
    expect(items.some((i) => i.group === "actions")).toBe(true);
  });

  it("does not seed product notifications", () => {
    expect(PRODUCT_NOTIFICATIONS).toEqual([]);
  });
});
