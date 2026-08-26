import { describe, expect, it } from "vitest";
import {
  ALL_NAV,
  PRIMARY_NAV,
  breadcrumbsForPath,
  buildCommandItems,
  titleForPath,
} from "@/lib/navigation";
import { MOCK_NOTIFICATIONS } from "@/lib/navigation/notifications";

describe("Release 0.1 navigation", () => {
  it("exposes primary product links", () => {
    expect(PRIMARY_NAV.some((n) => n.href === "/dashboard")).toBe(true);
    expect(PRIMARY_NAV.some((n) => n.href === "/copilot")).toBe(true);
    expect(PRIMARY_NAV.some((n) => n.href === "/match-center")).toBe(true);
    expect(ALL_NAV.length).toBeGreaterThanOrEqual(5);
  });

  it("builds breadcrumbs and titles", () => {
    expect(breadcrumbsForPath("/dashboard")).toEqual([{ label: "Dashboard" }]);
    expect(breadcrumbsForPath("/match-center").at(-1)?.label).toContain(
      "Match Center",
    );
    expect(titleForPath("/copilot")).toBe("Copilot");
  });

  it("builds command palette items", () => {
    const items = buildCommandItems();
    expect(items.some((i) => i.href === "/dashboard")).toBe(true);
    expect(items.some((i) => i.group === "Acciones")).toBe(true);
  });

  it("has mock notifications", () => {
    expect(MOCK_NOTIFICATIONS.length).toBeGreaterThan(0);
  });
});
