import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIFECYCLE_CRON_SECRET_ENV } from "@/lib/prematch-lifecycle/config";

const runPrematchLifecycle = vi.fn();

vi.mock("@/lib/prematch-lifecycle/coordinator", () => ({
  runPrematchLifecycle: (...args: unknown[]) => runPrematchLifecycle(...args),
}));

describe("POST /api/internal/prematch-lifecycle", () => {
  beforeEach(() => {
    runPrematchLifecycle.mockReset();
    runPrematchLifecycle.mockResolvedValue({
      startedAtUtc: "2033-05-31T23:30:00.000Z",
      completedAtUtc: "2033-05-31T23:30:01.000Z",
      configuredLeagueCount: 0,
      leagueAllowlistInvalid: false,
      discoveredFixtureCount: 0,
      eligibleT120Count: 0,
      alreadyTicketedCount: 0,
      newTicketAttempts: 0,
      newTicketsCreated: 0,
      newTicketsIdempotent: 0,
      oddsRequests: 0,
      peComputations: 0,
      ticketListPages: 0,
      finalizationCandidates: 0,
      finalizationBatchRequests: 0,
      evidenceCreated: 0,
      evidenceIdempotent: 0,
      evaluationsCreated: 0,
      evaluationsIdempotent: 0,
      voidTerminalCount: 0,
      invalidFixtureIdCount: 0,
      skippedCount: 0,
      errorCount: 0,
    });
    process.env[LIFECYCLE_CRON_SECRET_ENV] = "test-cron-secret";
  });

  it("returns 401 and performs zero coordinator work without a bearer secret", async () => {
    const { POST } = await import("@/app/api/internal/prematch-lifecycle/route");
    const response = await POST(
      new Request("http://apex.local/api/internal/prematch-lifecycle", {
        method: "POST",
      }),
    );
    expect(response.status).toBe(401);
    expect(runPrematchLifecycle).not.toHaveBeenCalled();
    const body = (await response.json()) as { error?: { message?: string } };
    expect(JSON.stringify(body)).not.toMatch(/test-cron-secret/);
  });

  it("returns 401 for an incorrect secret", async () => {
    const { POST } = await import("@/app/api/internal/prematch-lifecycle/route");
    const response = await POST(
      new Request("http://apex.local/api/internal/prematch-lifecycle", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    expect(response.status).toBe(401);
    expect(runPrematchLifecycle).not.toHaveBeenCalled();
  });

  it("does not treat a user session cookie as authorization", async () => {
    const { POST } = await import("@/app/api/internal/prematch-lifecycle/route");
    const response = await POST(
      new Request("http://apex.local/api/internal/prematch-lifecycle", {
        method: "POST",
        headers: { cookie: "sb-access-token=session" },
      }),
    );
    expect(response.status).toBe(401);
    expect(runPrematchLifecycle).not.toHaveBeenCalled();
  });

  it("runs the coordinator only after a matching bearer secret", async () => {
    const { POST } = await import("@/app/api/internal/prematch-lifecycle/route");
    const response = await POST(
      new Request("http://apex.local/api/internal/prematch-lifecycle", {
        method: "POST",
        headers: { Authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(runPrematchLifecycle).toHaveBeenCalledTimes(1);
    const body = (await response.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
