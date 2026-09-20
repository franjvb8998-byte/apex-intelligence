import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sanitizeAuthQueryParams, stripCredentialQueryParams } from "@/lib/auth/credential-query";

describe("auth credential query protection", () => {
  it("strips password and email query keys while preserving a safe redirect", () => {
    const params = new URLSearchParams(
      "email=user%40example.com&password=example-secret&redirect=%2Fscanner&password_updated=1",
    );
    expect(stripCredentialQueryParams(params)).toBe(true);
    expect(params.has("password")).toBe(false);
    expect(params.has("email")).toBe(false);
    expect(params.get("redirect")).toBe("/scanner");
    expect(params.get("password_updated")).toBe("1");
  });

  it("drops open redirects while stripping credentials", () => {
    const params = new URLSearchParams(
      "password=example-secret&redirect=https://evil.example/phish",
    );
    expect(sanitizeAuthQueryParams(params)).toBe(true);
    expect(params.has("password")).toBe(false);
    expect(params.has("redirect")).toBe(false);
  });

  it("rejects protocol-relative redirects", () => {
    const params = new URLSearchParams("redirect=//evil.example");
    expect(sanitizeAuthQueryParams(params)).toBe(true);
    expect(params.has("redirect")).toBe(false);
  });

  it("leaves ordinary login query strings unchanged", () => {
    const params = new URLSearchParams("redirect=/dashboard");
    expect(sanitizeAuthQueryParams(params)).toBe(false);
    expect(params.toString()).toBe("redirect=%2Fdashboard");
  });

  it("login form posts, prevents default, and does not POST to a page route", () => {
    const source = readFileSync("components/auth/login-form.tsx", "utf8");
    expect(source).toMatch(/<form[\s\S]*method="post"/);
    expect(source).not.toMatch(/action="\/login"/);
    expect(source).toMatch(/event\.preventDefault\(\)/);
    expect(source).toMatch(/sanitizeNextPath/);
  });
});
