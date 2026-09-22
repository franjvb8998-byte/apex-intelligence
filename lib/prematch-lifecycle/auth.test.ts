import { describe, expect, it } from "vitest";
import {
  authorizePrematchLifecycleRequest,
  timingSafeSecretEqual,
} from "@/lib/prematch-lifecycle/auth";
import { LIFECYCLE_CRON_SECRET_ENV } from "@/lib/prematch-lifecycle/config";

function requestWith(
  headers: Record<string, string>,
): Request {
  return new Request("http://apex.local/api/internal/prematch-lifecycle", {
    method: "POST",
    headers,
  });
}

describe("prematch lifecycle cron auth", () => {
  it("compares secrets in a length-independent timing-safe way", () => {
    expect(timingSafeSecretEqual("alpha", "alpha")).toBe(true);
    expect(timingSafeSecretEqual("alpha", "beta")).toBe(false);
    expect(timingSafeSecretEqual("short", "much-longer-secret")).toBe(false);
  });

  it("fails closed when the server secret is missing", () => {
    const result = authorizePrematchLifecycleRequest(
      requestWith({ Authorization: "Bearer anything" }),
      {},
    );
    expect(result).toEqual({ ok: false, status: 401, code: "unauthorized" });
  });

  it("rejects missing or incorrect bearer tokens", () => {
    const env = { [LIFECYCLE_CRON_SECRET_ENV]: "lifecycle-secret" };
    expect(authorizePrematchLifecycleRequest(requestWith({}), env).ok).toBe(
      false,
    );
    expect(
      authorizePrematchLifecycleRequest(
        requestWith({ Authorization: "Bearer nope" }),
        env,
      ).ok,
    ).toBe(false);
    expect(
      authorizePrematchLifecycleRequest(
        requestWith({ cookie: "sb-access-token=session" }),
        env,
      ).ok,
    ).toBe(false);
  });

  it("accepts the matching bearer secret and ignores user cookies", () => {
    const env = { [LIFECYCLE_CRON_SECRET_ENV]: "lifecycle-secret" };
    const result = authorizePrematchLifecycleRequest(
      requestWith({
        Authorization: "Bearer lifecycle-secret",
        cookie: "sb-access-token=session",
      }),
      env,
    );
    expect(result).toEqual({ ok: true });
  });
});
