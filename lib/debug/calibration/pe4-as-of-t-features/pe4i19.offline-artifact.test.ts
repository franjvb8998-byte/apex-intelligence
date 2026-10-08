import { describe, expect, it } from "vitest";

describe("PE-4I.19 offline artifact materialization", () => {
  it("materializes the local corpus without provider or production wiring", async () => {
    const { PE4I19_OFFLINE_REPORT: report } = await import(
      "@/lib/debug/calibration/run-pe4i19-strength-catalogue"
    );
    expect(report.providerCallsMade).toBe(0);
    expect(report.productionWiring).toBe(false);
    expect(report.catalogueRowCount).toBeGreaterThan(0);
    expect(report.strengthKeyCount).toBeGreaterThan(0);
    expect(report.strengthKeyCount).toBeLessThanOrEqual(report.catalogueRowCount * 2);
    expect(report.conflictedStrengthKeyCount).toBeGreaterThanOrEqual(0);
    expect(report.catalogueDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(report.rowsFileDigest).toMatch(/^[a-f0-9]{64}$/);
  }, 30_000);
});
