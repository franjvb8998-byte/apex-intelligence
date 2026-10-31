/**
 * PE-5.4C increment 5 — offline normalizer tests.
 * No provider calls, no credential reads, no sealed outcome reads.
 * Classifier checks use synthetic non-holdout fixtures only.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  normalizePe5AcquisitionResponse,
  type Pe5NormalizedObservation,
  type Pe5NormalizeReason,
} from "@/lib/debug/calibration/pe5-acquisition-boundary/normalize";
import {
  classifyPe5Evidence,
  type Pe5EvidenceInput,
} from "@/lib/debug/calibration/pe5-availability/evidence-class";

const FIXTURE = "1035037";
const OTHER = "999001";
const CAPTURED = "2024-06-01T12:00:00.000Z";
const KICKOFF = "2024-06-02T15:00:00.000Z";
const WORKER_CLOCK = "1999-01-01T00:00:00.000Z";
const SECRET = "pe54c-secret-token";
const PLAYER = "pe54c-player-token";
const TEAM = "pe54c-team-token";
const BODY_TOKEN = "pe54c-body-token";
const PHRASE = "request limit for the day";
const DAILY = "Daily Request Quota exceeded";

function readsCounter() {
  return { count: 0 };
}

function defineThrowingGetter(target: object, key: string, reads: { count: number }) {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get() {
      reads.count += 1;
      throw new Error(`${SECRET} ${PLAYER} ${BODY_TOKEN}`);
    },
  });
}

function proxyId(reads: { count: number }): object {
  return new Proxy(
    { forged: 99 },
    {
      get() {
        reads.count += 1;
        return 15;
      },
    },
  );
}

function revokedProxy(target: object = { forged: 99 }): object {
  const handle = Proxy.revocable(target, {});
  handle.revoke();
  return handle.proxy;
}

function trappingProxy<T extends object>(target: T, reads: { count: number }): T {
  return new Proxy(target, {
    get(value, key, receiver) {
      reads.count += 1;
      return Reflect.get(value, key, receiver);
    },
    ownKeys(value) {
      reads.count += 1;
      return Reflect.ownKeys(value);
    },
    getOwnPropertyDescriptor(value, key) {
      reads.count += 1;
      return Reflect.getOwnPropertyDescriptor(value, key);
    },
    getPrototypeOf(value) {
      reads.count += 1;
      return Reflect.getPrototypeOf(value);
    },
  });
}

function emptyBody(
  endpoint: "lineups" | "injuries" = "lineups",
  extra: Record<string, unknown> = {},
) {
  return {
    get: endpoint === "lineups" ? "fixtures/lineups" : "injuries",
    parameters: { fixture: FIXTURE },
    errors: [] as unknown[],
    results: 0,
    paging: { current: 1, total: 1 },
    response: [] as unknown[],
    schemaVersion: "unapproved-schema",
    ...extra,
  };
}

function bodyWith(
  rows: unknown[],
  endpoint: "lineups" | "injuries" = "lineups",
  extra: Record<string, unknown> = {},
) {
  return emptyBody(endpoint, {
    response: rows,
    results: rows.length,
    ...extra,
  });
}

function starter(id: unknown) {
  return { player: { id, name: PLAYER } };
}

function lineupRow(options: {
  starters?: unknown[];
  substitutes?: unknown[];
  fixtureId?: unknown;
  omitFixture?: boolean;
} = {}) {
  const row: Record<string, unknown> = {
    team: { id: 33, name: TEAM },
    startXI: (options.starters ?? [15]).map((id) => starter(id)),
    substitutes: (options.substitutes ?? []).map((id) => starter(id)),
  };
  if (!options.omitFixture) row.fixture = { id: options.fixtureId ?? FIXTURE };
  return row;
}

function injuryRow(id: unknown = 15, fixtureId: unknown = FIXTURE) {
  return {
    player: { id, name: PLAYER },
    team: { id: 33, name: TEAM },
    fixture: { id: fixtureId },
  };
}

function baseEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    envelopeId: "env-lineups-1",
    status: 200,
    headers: { "x-ratelimit-requests-remaining": 15 },
    endpoint: "lineups",
    fixtureId: FIXTURE,
    capturedAtUtc: CAPTURED,
    captureTimestampVerified: true,
    workerCapturedAtUtc: WORKER_CLOCK,
    fetchedAt: WORKER_CLOCK,
    body: emptyBody(),
    ...overrides,
  };
}

function lineupEnvelope(rows: unknown[], extra: Record<string, unknown> = {}) {
  return baseEnvelope({
    body: bodyWith(rows, "lineups"),
    ...extra,
  });
}

function injuryEnvelope(rows: unknown[], extra: Record<string, unknown> = {}) {
  return baseEnvelope({
    envelopeId: "env-injuries-1",
    endpoint: "injuries",
    body: bodyWith(rows, "injuries"),
    ...extra,
  });
}

function assertClosed(result: unknown) {
  const encoded = JSON.stringify(result);
  expect(encoded).not.toContain(SECRET);
  expect(encoded).not.toContain(PLAYER);
  expect(encoded).not.toContain(TEAM);
  expect(encoded).not.toContain(BODY_TOKEN);
  expect(encoded).not.toContain(WORKER_CLOCK);
  expect(encoded).not.toContain("unapproved-schema");
  expect(encoded).not.toContain("unique");
  expect(encoded).not.toContain("prospective_snapshot");
  expect(encoded).not.toContain("current_snapshot");
}

function expectReason(input: unknown, reason: Pe5NormalizeReason) {
  const result = normalizePe5AcquisitionResponse(input);
  expect(result).toEqual({ ok: false, reason });
  assertClosed(result);
  return result;
}

function expectOk(input: unknown): Pe5NormalizedObservation {
  const result = normalizePe5AcquisitionResponse(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected an observation");
  assertClosed(result);
  expect(result.observation.absenceMeansAvailable).toBe(false);
  expect(result.observation.availabilityInference).toBe("forbidden");
  expect(result.observation).not.toHaveProperty("provenance");
  expect(result.observation).not.toHaveProperty("evidenceClass");
  expect(result.observation.capturedAtUtc).not.toBe(WORKER_CLOCK);
  return result.observation;
}

function toEvidence(
  observation: Pe5NormalizedObservation,
  overrides: Partial<Pe5EvidenceInput> = {},
): Pe5EvidenceInput {
  return {
    evidenceId: observation.envelopeId,
    kind: observation.endpoint === "lineups" ? "confirmed_starting_xi" : "injury_unavailability",
    provenance: "prospective_snapshot",
    sourceFixtureId: observation.fixtureId,
    sourceKickoffUtc: KICKOFF,
    sourceProviderSeasonId: "2024",
    capturedAtUtc: observation.capturedAtUtc,
    captureTimestampVerified: observation.captureTimestampVerified,
    observation: observation.observation,
    observedValue: observation.observedValue,
    targetFixtureId: observation.fixtureId,
    targetKickoffUtc: KICKOFF,
    targetProviderSeasonId: "2024",
    ...overrides,
  };
}

describe("PE-5.4C increment 5 response normalization", () => {
  describe("HTTP status and precedence", () => {
    it.each([99, 600, 200.5, Number.NaN, "200", "500", "401", true, null])(
      "rejects non-integer or out-of-range status %s",
      (status) => {
        expectReason(
          baseEnvelope({
            status,
            headers: { "x-ratelimit-requests-remaining": 0 },
            body: emptyBody("lineups", { message: PHRASE }),
          }),
          "malformed_response",
        );
      },
    );

    it.each([401, 403])("classifies %s as unauthorized before quota text", (status) => {
      const headerReads = readsCounter();
      const bodyReads = readsCounter();
      const headers = {};
      const body = emptyBody("lineups", { message: PHRASE });
      defineThrowingGetter(headers, "x-ratelimit-requests-remaining", headerReads);
      defineThrowingGetter(body, "message", bodyReads);
      expectReason(baseEnvelope({ status, headers, body }), "unauthorized");
      expect(headerReads.count).toBe(0);
      expect(bodyReads.count).toBe(0);
    });

    it("keeps HTTP 500 ahead of an exhausted header and a daily phrase", () => {
      expectReason(
        baseEnvelope({
          status: 500,
          headers: { "x-ratelimit-requests-remaining": 0 },
          body: emptyBody("lineups", { message: `${PHRASE} ${SECRET}` }),
        }),
        "unexpected_provider_behavior",
      );
    });

    it.each([500, 599])("does not read quota fields on status %s", (status) => {
      const headerReads = readsCounter();
      const bodyReads = readsCounter();
      const headers = {};
      const body = emptyBody();
      defineThrowingGetter(headers, "X-RateLimit-Requests-Remaining", headerReads);
      defineThrowingGetter(body, "message", bodyReads);
      expectReason(baseEnvelope({ status, headers, body }), "unexpected_provider_behavior");
      expect(headerReads.count).toBe(0);
      expect(bodyReads.count).toBe(0);
    });

    it("does not invoke a status accessor", () => {
      const reads = readsCounter();
      const envelope = baseEnvelope();
      defineThrowingGetter(envelope, "status", reads);
      expectReason(envelope, "malformed_response");
      expect(reads.count).toBe(0);
    });

    it.each([
      [429, "quota_exhausted"],
      [404, "quota_exhausted"],
      [400, "quota_exhausted"],
    ] as const)("daily phrase on status %s is quota exhaustion", (status, reason) => {
      expectReason(
        baseEnvelope({
          status,
          headers: { "x-ratelimit-requests-remaining": 15 },
          body: { message: DAILY, errors: [] },
        }),
        reason,
      );
    });

    it("classifies 429 without a daily phrase as rate limited", () => {
      expectReason(
        baseEnvelope({
          status: 429,
          headers: { "x-ratelimit-requests-remaining": 15 },
          body: { message: "quota", errors: [] },
        }),
        "rate_limited",
      );
    });

    it.each([100, 204, 301, 302, 404, 418, 499])(
      "classifies status %s without a daily phrase as malformed",
      (status) => {
        expectReason(
          baseEnvelope({
            status,
            body: { message: "quota", next: `https://provider.example/${BODY_TOKEN}` },
          }),
          "malformed_response",
        );
      },
    );

    it("exhausted header stops a non-200 response before phrase inspection", () => {
      const reads = readsCounter();
      const body = { message: "quota" };
      defineThrowingGetter(body, "error", reads);
      expectReason(
        baseEnvelope({
          status: 404,
          headers: { "x-ratelimit-requests-remaining": "0" },
          body,
        }),
        "quota_exhausted",
      );
      expect(reads.count).toBe(0);
    });
  });

  describe("header parsing", () => {
    it.each([0, -0, "0", "00", "000", " 00 ", "\n0\n"])(
      "treats quota header %s as exhausted before a valid body",
      (header) => {
        expectReason(
          lineupEnvelope([lineupRow()], {
            headers: { "x-ratelimit-requests-remaining": header },
          }),
          "quota_exhausted",
        );
      },
    );

    it.each([15, "15", " 15 ", "\t15\n"])(
      "accepts positive quota header %s and continues",
      (header) => {
        const observation = expectOk(
          lineupEnvelope([lineupRow({ starters: [15], substitutes: [21] })], {
            headers: { "X-RateLimit-Requests-Remaining": header },
          }),
        );
        expect(observation.observedValue).toBe(1);
        if (observation.endpoint === "lineups") {
          expect(observation.substituteCount).toBe(1);
        }
      },
    );

    it.each([
      "0.0",
      "01",
      "-1",
      " 01 ",
      "",
      "  ",
      "nope",
      "0e0",
      "+15",
      "15.0",
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      "9007199254740993",
      true,
      null,
      {},
      [],
    ])("rejects malformed quota header %s", (header) => {
      expectReason(
        baseEnvelope({
          headers: { "x-ratelimit-requests-remaining": header },
        }),
        "malformed_response",
      );
    });

    it("does not invoke a throwing quota header accessor", () => {
      const reads = readsCounter();
      const headers = {};
      defineThrowingGetter(headers, "x-ratelimit-requests-remaining", reads);
      expectReason(baseEnvelope({ headers }), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("does not trust a quota accessor that would have returned zero", () => {
      const reads = readsCounter();
      const headers = {};
      Object.defineProperty(headers, "x-ratelimit-requests-remaining", {
        enumerable: true,
        get() {
          reads.count += 1;
          return 0;
        },
      });
      expectReason(baseEnvelope({ headers }), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("lets a malformed header win over an exhausted sibling", () => {
      const reads = readsCounter();
      const headers: Record<string, unknown> = {
        "x-ratelimit-requests-remaining": "0",
      };
      defineThrowingGetter(headers, "X-RateLimit-Requests-Remaining", reads);
      expectReason(baseEnvelope({ headers }), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("lets a recognized phrase win over a malformed quota header", () => {
      const reads = readsCounter();
      const headers = {};
      defineThrowingGetter(headers, "X-RateLimit-Requests-Remaining", reads);
      expectReason(
        baseEnvelope({
          headers,
          body: emptyBody("lineups", { message: `${PHRASE} ${SECRET}` }),
        }),
        "quota_exhausted",
      );
      expect(reads.count).toBe(0);
    });

    it("lets a recognized phrase win over a malformed header string", () => {
      expectReason(
        baseEnvelope({
          status: 429,
          headers: { "x-ratelimit-requests-remaining": "0.0" },
          body: { error: DAILY },
        }),
        "quota_exhausted",
      );
    });

    it("classifies a malformed header on 429 before rate limiting", () => {
      expectReason(
        baseEnvelope({
          status: 429,
          headers: { "x-ratelimit-requests-remaining": "01" },
          body: { message: "quota" },
        }),
        "malformed_response",
      );
    });

    it("ignores x-ratelimit-remaining and near-miss header names", () => {
      const observation = expectOk(
        baseEnvelope({
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-requests-remaining-today": "0",
            "X-RateLimit-Requests-Limit": "00",
          },
        }),
      );
      expect(observation.observation).toBe("missing");
      expect(observation.observedValue).toBeNull();
    });

    it("does not walk a proxy header map", () => {
      const reads = readsCounter();
      const headers = trappingProxy({ "x-ratelimit-requests-remaining": 0 }, reads);
      expectReason(baseEnvelope({ headers }), "malformed_response");
      expect(reads.count).toBe(0);
    });
  });

  describe("provider message parsing", () => {
    it.each([
      { message: "REQUEST LIMIT FOR THE DAY" },
      { message: "  daily request quota reached " },
      { error: `API note: ${DAILY} ${SECRET}` },
      { errors: [`${PHRASE} ${PLAYER}`] },
      { errors: { requests: DAILY } },
      { errors: { requests: [PHRASE, "other"] } },
      { message: "quota", error: PHRASE },
    ])("recognizes a daily phrase in %o", (fields) => {
      expectReason(baseEnvelope({ status: 200, body: fields }), "quota_exhausted");
    });

    it.each(["quota", "squad quota remains a coverage topic", "daily training", "upgrade your plan"])(
      "does not treat %j as daily exhaustion",
      (message) => {
        const observation = expectOk(
          baseEnvelope({ body: emptyBody("lineups", { message }) }),
        );
        expect(observation.observation).toBe("missing");
        expect(observation.observedValue).toBeNull();
      },
    );

    it.each(["quota", "daily training"])(
      "rejects a nonempty errors entry %j without calling it exhaustion",
      (entry) => {
        expectReason(
          baseEnvelope({ body: emptyBody("lineups", { errors: [entry] }) }),
          "malformed_response",
        );
      },
    );

    it("rejects an accessor on message without invoking it", () => {
      const reads = readsCounter();
      const body = { errors: [] as unknown[] };
      defineThrowingGetter(body, "message", reads);
      expectReason(baseEnvelope({ status: 429, body }), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("rejects an accessor on error without invoking it", () => {
      const reads = readsCounter();
      const body = emptyBody();
      defineThrowingGetter(body, "error", reads);
      expectReason(baseEnvelope({ body }), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("rejects an accessor on errors without invoking it", () => {
      const reads = readsCounter();
      const body = emptyBody();
      defineThrowingGetter(body, "errors", reads);
      expectReason(baseEnvelope({ status: 429, body }), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("rejects a daily phrase paired with an accessor on another field", () => {
      const laterReads = readsCounter();
      const laterBody = emptyBody("lineups", { message: PHRASE });
      defineThrowingGetter(laterBody, "errors", laterReads);
      const later = expectReason(baseEnvelope({ body: laterBody }), "malformed_response");
      expect(later).not.toHaveProperty("observation");
      expect(laterReads.count).toBe(0);

      const earlierReads = readsCounter();
      const earlierBody = emptyBody("lineups", { error: DAILY });
      defineThrowingGetter(earlierBody, "message", earlierReads);
      expectReason(baseEnvelope({ body: earlierBody }), "malformed_response");
      expect(earlierReads.count).toBe(0);
    });

    it("rejects a proxy body on 200 and 429 without invoking traps", () => {
      const successReads = readsCounter();
      const limitedReads = readsCounter();
      const success = expectReason(
        baseEnvelope({ body: trappingProxy({ message: PHRASE }, successReads) }),
        "malformed_response",
      );
      const limited = expectReason(
        baseEnvelope({
          status: 429,
          body: trappingProxy({ message: PHRASE }, limitedReads),
        }),
        "malformed_response",
      );
      expect(success).not.toHaveProperty("observation");
      expect(limited).not.toHaveProperty("observation");
      expect(successReads.count).toBe(0);
      expect(limitedReads.count).toBe(0);
    });

    it("rejects a revoked proxy body on 200 and 429", () => {
      const body = revokedProxy({ message: PHRASE });
      expectReason(baseEnvelope({ body }), "malformed_response");
      expectReason(baseEnvelope({ status: 429, body }), "malformed_response");
    });

    it("rejects an unsafe body when the quota header is also malformed", () => {
      const proxyReads = readsCounter();
      expectReason(
        baseEnvelope({
          status: 429,
          headers: { "x-ratelimit-requests-remaining": "01" },
          body: trappingProxy({ message: PHRASE }, proxyReads),
        }),
        "malformed_response",
      );
      expect(proxyReads.count).toBe(0);

      const accessorReads = readsCounter();
      const body = emptyBody("lineups", { message: PHRASE });
      defineThrowingGetter(body, "error", accessorReads);
      const result = expectReason(
        baseEnvelope({
          headers: { "x-ratelimit-requests-remaining": "0.0" },
          body,
        }),
        "malformed_response",
      );
      expect(result).not.toHaveProperty("observation");
      expect(accessorReads.count).toBe(0);
    });
  });

  describe("body and pagination", () => {
    it.each([
      { errors: undefined },
      { errors: {} },
      { errors: "quota" },
      { errors: [PLAYER] },
      { errors: { requests: "not daily" } },
    ])("rejects errors shape %o", (fields) => {
      const body = emptyBody();
      delete (body as { errors?: unknown }).errors;
      expectReason(baseEnvelope({ body: { ...body, ...fields } }), "malformed_response");
    });

    it("rejects a missing errors field", () => {
      const body = emptyBody();
      delete (body as { errors?: unknown }).errors;
      expectReason(baseEnvelope({ body }), "malformed_response");
    });

    it.each([
      { results: undefined },
      { results: "0" },
      { results: -1 },
      { results: 1.5 },
      { results: -0 },
      { response: {} },
      { response: null },
      { response: "[]" },
      { results: 1, response: [] },
      { results: 0, response: [lineupRow()] },
    ])("rejects a results or response mismatch %o", (fields) => {
      const body = emptyBody();
      expectReason(baseEnvelope({ body: { ...body, ...fields } }), "malformed_response");
    });

    it("rejects a response array subclass and a response accessor", () => {
      class RowList extends Array {}
      const rows = new RowList(1);
      rows[0] = lineupRow();
      expectReason(
        baseEnvelope({
          body: emptyBody("lineups", { response: rows, results: 1 }),
        }),
        "malformed_response",
      );

      const reads = readsCounter();
      const body = emptyBody();
      defineThrowingGetter(body, "response", reads);
      expectReason(baseEnvelope({ body }), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it.each([
      null,
      [],
      "1",
      1,
      { current: "1", total: "1" },
      { current: 1.5, total: 1 },
      { current: -1, total: 1 },
      { current: 0, total: 1 },
      { current: 1, total: 0 },
      { current: Number.NaN, total: 1 },
      { current: 1, total: Number.POSITIVE_INFINITY },
      { total: 1 },
      { current: 1 },
    ])("rejects malformed paging %j", (paging) => {
      expectReason(
        baseEnvelope({ body: emptyBody("lineups", { paging }) }),
        "malformed_response",
      );
    });

    it.each([
      { current: 2, total: 1 },
      { current: 1, total: 2 },
      { current: 2, total: 4 },
      { current: 1, total: Number.MAX_SAFE_INTEGER },
    ])("rejects another valid page %j without requesting it", (paging) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      try {
        expectReason(
          baseEnvelope({
            body: emptyBody("lineups", {
              paging: { ...paging, next: `https://provider.example/${BODY_TOKEN}` },
            }),
          }),
          "unexpected_pagination",
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("rejects paging before a bad endpoint path", () => {
      expectReason(
        baseEnvelope({
          body: emptyBody("lineups", {
            paging: { current: 2, total: 1 },
            get: "not-a-path",
          }),
        }),
        "unexpected_pagination",
      );
    });

    it("rejects nonempty errors before unexpected paging", () => {
      expectReason(
        baseEnvelope({
          body: emptyBody("lineups", {
            errors: ["not a daily phrase"],
            paging: { current: 1, total: 2 },
          }),
        }),
        "malformed_response",
      );
    });

    it("does not invoke a paging accessor or inherited counters", () => {
      const reads = readsCounter();
      const accessorPaging: Record<string, unknown> = {};
      defineThrowingGetter(accessorPaging, "current", reads);
      Object.defineProperty(accessorPaging, "total", { enumerable: true, value: 1 });
      expectReason(
        baseEnvelope({ body: emptyBody("lineups", { paging: accessorPaging }) }),
        "malformed_response",
      );
      expect(reads.count).toBe(0);

      const inherited = Object.create({ current: 1, total: 1 });
      expectReason(
        baseEnvelope({ body: emptyBody("lineups", { paging: inherited }) }),
        "malformed_response",
      );
    });

    it("does not walk a paging proxy", () => {
      const reads = readsCounter();
      expectReason(
        baseEnvelope({
          body: emptyBody("lineups", {
            paging: trappingProxy({ current: 1, total: 1 }, reads),
          }),
        }),
        "malformed_response",
      );
      expect(reads.count).toBe(0);
    });

    it("accepts a null-prototype body whose page counters are own data", () => {
      const body = Object.assign(Object.create(null), emptyBody());
      const observation = expectOk(baseEnvelope({ body }));
      expect(observation.observation).toBe("missing");
    });

    it.each([
      undefined,
      null,
      "",
      "/",
      "//fixtures/lineups",
      "fixtures/lineups/",
      "fixtures/lineups?fixture=1035037",
      "fixtures/lineups#players",
      "fixtures//lineups",
      "/fixtures/lineups/extra",
      "Fixtures/lineups",
      "injuries",
      "/injuries",
      1,
    ])("rejects lineup get path %j", (get) => {
      const body = emptyBody();
      if (get === undefined) delete (body as { get?: unknown }).get;
      else body.get = get as never;
      expectReason(baseEnvelope({ body }), "malformed_response");
    });

    it.each(["fixtures/lineups", "/fixtures/lineups"])(
      "accepts lineup path %j",
      (get) => {
        const observation = expectOk(baseEnvelope({ body: emptyBody("lineups", { get }) }));
        expect(observation.endpoint).toBe("lineups");
        expect(observation.observation).toBe("missing");
      },
    );

    it("accepts the injuries path and rejects a lineup path on that endpoint", () => {
      const observation = expectOk(
        injuryEnvelope([], { body: bodyWith([], "injuries", { get: "/injuries" }) }),
      );
      expect(observation.endpoint).toBe("injuries");
      expectReason(
        injuryEnvelope([], { body: bodyWith([], "injuries", { get: "fixtures/lineups" }) }),
        "malformed_response",
      );
    });

    it("rejects a bad get before a contradictory fixture echo", () => {
      expectReason(
        baseEnvelope({
          body: emptyBody("lineups", {
            get: "players",
            parameters: { fixture: OTHER },
          }),
        }),
        "malformed_response",
      );
    });

    it("does not invoke a get accessor", () => {
      const reads = readsCounter();
      const body = emptyBody();
      defineThrowingGetter(body, "get", reads);
      expectReason(baseEnvelope({ body }), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("rejects an inherited get and an endpoint alias", () => {
      const body = emptyBody();
      delete (body as { get?: unknown }).get;
      const inherited = Object.assign(Object.create({ get: "fixtures/lineups" }), body);
      expectReason(baseEnvelope({ body: inherited }), "malformed_response");
      expectReason(baseEnvelope({ endpoint: "fixtures/lineups" }), "malformed_response");
    });
  });

  describe("fixture identity", () => {
    it("matches a canonical string echo and a safe integer echo", () => {
      const asString = expectOk(lineupEnvelope([lineupRow()]));
      expect(asString.fixtureId).toBe(FIXTURE);
      const asNumber = expectOk(
        lineupEnvelope([lineupRow({ fixtureId: Number(FIXTURE) })], {
          body: bodyWith([lineupRow({ fixtureId: Number(FIXTURE) })], "lineups", {
            parameters: { fixture: Number(FIXTURE) },
          }),
        }),
      );
      expect(asNumber.fixtureId).toBe(FIXTURE);
      expect(asNumber.observedValue).toBe(1);
    });

    it.each(["01035037", ` ${FIXTURE} `, `${FIXTURE}\n`, "01", OTHER, ""])(
      "rejects noncanonical or contradictory echo %j",
      (fixture) => {
        expectReason(
          lineupEnvelope([lineupRow()], {
            body: bodyWith([lineupRow()], "lineups", { parameters: { fixture } }),
          }),
          "fixture_id_mismatch",
        );
      },
    );

    it("does not repair a missing parameters echo from a matching row", () => {
      const omitted = bodyWith([lineupRow()]);
      delete (omitted as { parameters?: unknown }).parameters;
      expectReason(lineupEnvelope([lineupRow()], { body: omitted }), "fixture_id_mismatch");
      expectReason(
        lineupEnvelope([lineupRow()], {
          body: bodyWith([lineupRow()], "lineups", { parameters: {} }),
        }),
        "fixture_id_mismatch",
      );
    });

    it.each([null, { id: FIXTURE }, [], true, 1.5, -5, Number.NaN])(
      "rejects invalid echo type %j",
      (fixture) => {
        expectReason(
          baseEnvelope({
            body: emptyBody("lineups", { parameters: { fixture } }),
          }),
          "malformed_response",
        );
      },
    );

    it("rejects a null parameters object and an unsafe parameters object", () => {
      expectReason(
        baseEnvelope({ body: emptyBody("lineups", { parameters: null }) }),
        "malformed_response",
      );
      const reads = readsCounter();
      expectReason(
        baseEnvelope({
          body: emptyBody("lineups", {
            parameters: trappingProxy({ fixture: FIXTURE }, reads),
          }),
        }),
        "malformed_response",
      );
      expect(reads.count).toBe(0);
    });

    it("does not invoke an echo accessor", () => {
      const reads = readsCounter();
      const parameters = {};
      defineThrowingGetter(parameters, "fixture", reads);
      expectReason(
        baseEnvelope({ body: emptyBody("lineups", { parameters }) }),
        "malformed_response",
      );
      expect(reads.count).toBe(0);
    });

    it("does not accept an inherited echo even when the value would match", () => {
      const parameters = Object.create({ fixture: FIXTURE });
      expectReason(
        baseEnvelope({ body: emptyBody("lineups", { parameters }) }),
        "malformed_response",
      );
    });

    it("rejects a noncanonical requested fixture id", () => {
      const reads = readsCounter();
      const parameters = {};
      defineThrowingGetter(parameters, "fixture", reads);
      expectReason(
        baseEnvelope({
          fixtureId: "01",
          body: emptyBody("lineups", { parameters }),
        }),
        "fixture_id_mismatch",
      );
      expect(reads.count).toBe(0);
      expectReason(baseEnvelope({ fixtureId: ` ${FIXTURE}` }), "fixture_id_mismatch");
      expectReason(baseEnvelope({ fixtureId: Number(FIXTURE) }), "fixture_id_mismatch");
    });

    it("rejects an unreadable requested fixture id", () => {
      const reads = readsCounter();
      const envelope = baseEnvelope();
      defineThrowingGetter(envelope, "fixtureId", reads);
      expectReason(envelope, "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("matches a nested fixture id and ignores a row that omits fixture", () => {
      const observation = expectOk(
        lineupEnvelope([
          lineupRow({ fixtureId: FIXTURE, starters: [11] }),
          lineupRow({ omitFixture: true, starters: [12] }),
          lineupRow({ fixtureId: Number(FIXTURE), starters: [13] }),
        ]),
      );
      expect(observation.observedValue).toBe(3);
    });

    it("rejects a contradictory nested fixture id for the whole body", () => {
      expectReason(
        lineupEnvelope([
          lineupRow({ starters: [1, 2, 3] }),
          lineupRow({ fixtureId: OTHER, starters: [4] }),
        ]),
        "fixture_id_mismatch",
      );
    });

    it("does not copy the request id into an omitted nested fixture id", () => {
      const row = lineupRow({ omitFixture: true, starters: [15, 16] });
      row.fixture = { timezone: "UTC" };
      expectReason(lineupEnvelope([row]), "identity_incomplete");
      const second = lineupRow();
      const incomplete = lineupRow({ omitFixture: true });
      incomplete.fixture = {};
      expectReason(lineupEnvelope([second, incomplete]), "identity_incomplete");
    });

    it.each([null, 1.5, -1, { value: FIXTURE }, [], true])(
      "rejects invalid nested fixture id %j",
      (id) => {
        const row = lineupRow({ omitFixture: true });
        row.fixture = { id };
        expectReason(lineupEnvelope([row]), "malformed_response");
      },
    );

    it("rejects a nested fixture accessor, inherited id, null fixture, and proxy", () => {
      const reads = readsCounter();
      const fixture = {};
      defineThrowingGetter(fixture, "id", reads);
      const accessorRow = lineupRow({ omitFixture: true });
      accessorRow.fixture = fixture;
      expectReason(lineupEnvelope([accessorRow]), "malformed_response");
      expect(reads.count).toBe(0);

      const inherited = lineupRow({ omitFixture: true });
      inherited.fixture = Object.create({ id: FIXTURE });
      expectReason(lineupEnvelope([inherited]), "malformed_response");

      const nulled = lineupRow({ omitFixture: true });
      nulled.fixture = null;
      expectReason(lineupEnvelope([nulled]), "malformed_response");

      const traps = readsCounter();
      const proxyRow = lineupRow({ omitFixture: true });
      proxyRow.fixture = trappingProxy({ id: OTHER }, traps);
      expectReason(lineupEnvelope([proxyRow]), "malformed_response");
      expect(traps.count).toBe(0);
    });
  });

  describe("row safety", () => {
    it.each([null, 15, "row", [starter(15)], true])(
      "rejects response element %j for the whole body",
      (row) => {
        expectReason(
          lineupEnvelope([lineupRow({ starters: [1, 2, 3] }), row]),
          "malformed_response",
        );
      },
    );

    it("does not count a proxy row and does not invoke its traps", () => {
      const reads = readsCounter();
      const proxy = trappingProxy(
        { player: { id: OTHER }, fixture: { id: OTHER }, startXI: [], substitutes: [] },
        reads,
      );
      expectReason(lineupEnvelope([lineupRow(), proxy]), "malformed_response");
      expect(reads.count).toBe(0);

      const { proxy: revoked, revoke } = Proxy.revocable({ player: { id: 15 } }, {});
      revoke();
      expectReason(injuryEnvelope([revoked]), "malformed_response");
    });

    it("rejects a proxy starter player id without invoking traps", () => {
      const reads = readsCounter();
      const row = lineupRow({ starters: [] });
      row.startXI = [{ player: { id: proxyId(reads), name: PLAYER } }];
      const result = expectReason(lineupEnvelope([row]), "malformed_response");
      expect(result).not.toHaveProperty("observation");
      expect(reads.count).toBe(0);
    });

    it("rejects a proxy substitute player id without invoking traps", () => {
      const reads = readsCounter();
      const row = lineupRow({ starters: [15], substitutes: [] });
      row.substitutes = [{ player: { id: proxyId(reads), name: PLAYER } }];
      const result = expectReason(lineupEnvelope([row]), "malformed_response");
      expect(result).not.toHaveProperty("observation");
      expect(reads.count).toBe(0);
    });

    it("rejects a proxy lineup team id without invoking traps", () => {
      const reads = readsCounter();
      const row = lineupRow({ starters: [15, 16] });
      row.team = { id: proxyId(reads), name: TEAM };
      const result = expectReason(lineupEnvelope([row]), "malformed_response");
      expect(result).not.toHaveProperty("observation");
      expect(reads.count).toBe(0);
    });

    it("rejects a proxy injury player id without invoking traps", () => {
      const reads = readsCounter();
      const result = expectReason(
        injuryEnvelope([
          {
            player: { id: proxyId(reads), name: PLAYER },
            team: { id: 33, name: TEAM },
            fixture: { id: FIXTURE },
          },
        ]),
        "malformed_response",
      );
      expect(result).not.toHaveProperty("observation");
      expect(reads.count).toBe(0);
    });

    it("rejects a proxy id beside canonical ids with no partial observation", () => {
      const reads = readsCounter();
      const row = lineupRow({ starters: [15, 16], substitutes: [21] });
      row.startXI = [...(row.startXI as unknown[]), { player: { id: proxyId(reads) } }];
      const result = expectReason(
        lineupEnvelope([lineupRow({ starters: [11, 12] }), row]),
        "malformed_response",
      );
      expect(result).not.toHaveProperty("observation");
      expect(reads.count).toBe(0);
    });

    it("rejects revoked proxy identifiers", () => {
      const starter = lineupRow({ starters: [] });
      starter.startXI = [{ player: { id: revokedProxy(), name: PLAYER } }];
      expectReason(
        lineupEnvelope([lineupRow({ starters: [11] }), starter]),
        "malformed_response",
      );

      const substitutes = lineupRow({ starters: [15], substitutes: [] });
      substitutes.substitutes = [{ player: { id: revokedProxy() } }];
      expectReason(lineupEnvelope([substitutes]), "malformed_response");

      const team = lineupRow({ starters: [15] });
      team.team = { id: revokedProxy(), name: TEAM };
      expectReason(lineupEnvelope([team]), "malformed_response");

      expectReason(
        injuryEnvelope([
          {
            player: { id: revokedProxy(), name: PLAYER },
            team: { id: revokedProxy(), name: TEAM },
            fixture: { id: FIXTURE },
          },
        ]),
        "malformed_response",
      );
    });

    it("rejects a proxy player and an accessor player id without invoking them", () => {
      const playerTraps = readsCounter();
      const row = lineupRow({ starters: [] });
      row.startXI = [{ player: trappingProxy({ id: 15, name: PLAYER }, playerTraps) }];
      expectReason(lineupEnvelope([row]), "malformed_response");
      expect(playerTraps.count).toBe(0);

      const idReads = readsCounter();
      const player = { name: PLAYER };
      defineThrowingGetter(player, "id", idReads);
      const accessorRow = lineupRow({ starters: [] });
      accessorRow.startXI = [{ player }];
      expectReason(lineupEnvelope([accessorRow]), "malformed_response");
      expect(idReads.count).toBe(0);
    });

    it("rejects an accessor on an injury row player id", () => {
      const reads = readsCounter();
      const player = { name: PLAYER };
      defineThrowingGetter(player, "id", reads);
      expectReason(
        injuryEnvelope([{ player, team: { id: 33 }, fixture: { id: FIXTURE } }]),
        "malformed_response",
      );
      expect(reads.count).toBe(0);
    });

    it.each([
      { startXI: null, substitutes: [] },
      { startXI: {}, substitutes: [] },
      { startXI: "11", substitutes: [] },
      { startXI: [], substitutes: null },
      { startXI: [], substitutes: {} },
      { startXI: { length: 1 }, substitutes: [] },
    ])("rejects invalid lineup containers %o", (containers) => {
      const row = lineupRow({ omitFixture: true });
      delete row.startXI;
      delete row.substitutes;
      expectReason(
        lineupEnvelope([{ ...row, ...containers, fixture: { id: FIXTURE } }]),
        "malformed_response",
      );
    });

    it("does not invoke a startXI accessor or accept an inherited list", () => {
      const reads = readsCounter();
      const row = lineupRow();
      defineThrowingGetter(row, "startXI", reads);
      expectReason(lineupEnvelope([row]), "malformed_response");
      expect(reads.count).toBe(0);

      const inherited = Object.create({
        startXI: [starter(15)],
        substitutes: [],
      });
      inherited.team = { id: 33 };
      inherited.fixture = { id: FIXTURE };
      expectReason(lineupEnvelope([inherited]), "malformed_response");
    });

    it("rejects unsafe nested entries and hosts", () => {
      const row = lineupRow({ starters: [] });
      row.startXI = [null, starter(15)];
      expectReason(lineupEnvelope([row]), "malformed_response");
      row.startXI = ["15"];
      expectReason(lineupEnvelope([row]), "malformed_response");

      const named = lineupRow();
      const nameReads = readsCounter();
      const player = { id: 15 };
      defineThrowingGetter(player, "name", nameReads);
      named.startXI = [{ player }];
      const observation = expectOk(lineupEnvelope([named]));
      expect(observation.observedValue).toBe(1);
      expect(nameReads.count).toBe(0);

      const teamReads = readsCounter();
      const teamRow = lineupRow();
      defineThrowingGetter(teamRow.team as object, "name", teamReads);
      expect(expectOk(lineupEnvelope([teamRow])).observedValue).toBe(1);
      expect(teamReads.count).toBe(0);
    });

    it("rejects a primitive, null, or array player object", () => {
      for (const player of [PLAYER, null, [], 15]) {
        const row = lineupRow({ starters: [] });
        row.startXI = [{ player }];
        expectReason(lineupEnvelope([row]), "malformed_response");
      }
    });

    it("counts only canonical player ids and keeps duplicate entries", () => {
      const observation = expectOk(
        lineupEnvelope([
          lineupRow({
            starters: [
              15,
              "16",
              "01",
              " 17 ",
              -3,
              1.5,
              "0",
              Number.MAX_SAFE_INTEGER,
              null,
              { nested: true },
              15,
              "15",
            ],
            substitutes: [21, 21, " 22 ", "09"],
          }),
        ]),
      );
      expect(observation.observation).toBe("present");
      expect(observation.observedValue).toBe(4);
      if (observation.endpoint !== "lineups") throw new Error("expected lineups");
      expect(observation.startXiCount).toBe(4);
      expect(observation.substituteCount).toBe(2);
      expect(observation).not.toHaveProperty("uniquePlayerCount");
    });

    it("aggregates canonical entries across lineup rows", () => {
      const observation = expectOk(
        lineupEnvelope([
          lineupRow({ starters: [1, 2], substitutes: [3] }),
          lineupRow({ starters: [4], substitutes: [5, "06"], fixtureId: Number(FIXTURE) }),
        ]),
      );
      expect(observation.observedValue).toBe(3);
      if (observation.endpoint !== "lineups") throw new Error("expected lineups");
      expect(observation.startXiCount).toBe(3);
      expect(observation.substituteCount).toBe(2);
    });

    it("rejects an inherited player id instead of counting it", () => {
      const player = Object.create({ id: 15 });
      player.name = PLAYER;
      const row = lineupRow({ starters: [] });
      row.startXI = [{ player }];
      expectReason(lineupEnvelope([row]), "malformed_response");
    });
  });

  describe("observation semantics", () => {
    it("stores an empty lineup as missing rather than zero", () => {
      expect(normalizePe5AcquisitionResponse(baseEnvelope())).toEqual({
        ok: true,
        observation: {
          envelopeId: "env-lineups-1",
          endpoint: "lineups",
          fixtureId: FIXTURE,
          observation: "missing",
          observedValue: null,
          startXiCount: null,
          substituteCount: null,
          absenceMeansAvailable: false,
          availabilityInference: "forbidden",
          capturedAtUtc: CAPTURED,
          captureTimestampVerified: true,
        },
      });
    });

    it("stores a nonempty lineup as returned canonical starter entries", () => {
      const result = normalizePe5AcquisitionResponse(
        lineupEnvelope([
          lineupRow({ starters: [15, "16"], substitutes: [21] }),
          lineupRow({ starters: [17], substitutes: [] }),
        ]),
      );
      expect(result).toEqual({
        ok: true,
        observation: {
          envelopeId: "env-lineups-1",
          endpoint: "lineups",
          fixtureId: FIXTURE,
          observation: "present",
          observedValue: 3,
          startXiCount: 3,
          substituteCount: 1,
          absenceMeansAvailable: false,
          availabilityInference: "forbidden",
          capturedAtUtc: CAPTURED,
          captureTimestampVerified: true,
        },
      });
    });

    it("keeps a lineup object with no canonical starters as present zero", () => {
      const observation = expectOk(
        lineupEnvelope([
          lineupRow({
            starters: ["01", " 15 ", null],
            substitutes: [],
          }),
        ]),
      );
      expect(observation.observation).toBe("present");
      expect(observation.observedValue).toBe(0);
      if (observation.endpoint !== "lineups") throw new Error("expected lineups");
      expect(observation.startXiCount).toBe(0);
      expect(observation.substituteCount).toBe(0);
    });

    it("keeps an empty starter list present even when substitutes are canonical", () => {
      const observation = expectOk(
        lineupEnvelope([lineupRow({ starters: [], substitutes: [9, "08", 9] })]),
      );
      expect(observation.observation).toBe("present");
      expect(observation.observedValue).toBe(0);
      if (observation.endpoint !== "lineups") throw new Error("expected lineups");
      expect(observation.startXiCount).toBe(0);
      expect(observation.substituteCount).toBe(2);
    });

    it("does not count a lineup entry that has no player", () => {
      const row = lineupRow({ starters: [], substitutes: [] });
      row.startXI = [{}, { player: {} }];
      const observation = expectOk(lineupEnvelope([row]));
      expect(observation.observation).toBe("present");
      expect(observation.observedValue).toBe(0);
    });

    it("stores an empty injury response as missing rather than zero", () => {
      expect(normalizePe5AcquisitionResponse(injuryEnvelope([]))).toEqual({
        ok: true,
        observation: {
          envelopeId: "env-injuries-1",
          endpoint: "injuries",
          fixtureId: FIXTURE,
          observation: "missing",
          observedValue: null,
          injuryRecordCount: null,
          absenceMeansAvailable: false,
          availabilityInference: "forbidden",
          capturedAtUtc: CAPTURED,
          captureTimestampVerified: true,
        },
      });
    });

    it("counts returned injury rows, including duplicates and unidentified rows", () => {
      const duplicate = injuryRow(15);
      const observation = expectOk(injuryEnvelope([duplicate, duplicate, injuryRow("01"), {}]));
      expect(observation.observation).toBe("present");
      expect(observation.observedValue).toBe(4);
      if (observation.endpoint !== "injuries") throw new Error("expected injuries");
      expect(observation.injuryRecordCount).toBe(4);
      expect(observation).not.toHaveProperty("startXiCount");
      expect(observation).not.toHaveProperty("uniquePlayerCount");
    });

    it("does not let nested lineup lists change an injury record count", () => {
      const row = injuryRow();
      const withLists = {
        ...row,
        startXI: [starter(1), starter(2), starter(3)],
        substitutes: [starter(4)],
      };
      const observation = expectOk(injuryEnvelope([withLists]));
      expect(observation.observedValue).toBe(1);
    });

    it("forbids availability inference on missing and present observations", () => {
      for (const input of [
        baseEnvelope(),
        lineupEnvelope([lineupRow({ starters: [], substitutes: [] })]),
        injuryEnvelope([]),
        injuryEnvelope([injuryRow(), injuryRow()]),
      ]) {
        const observation = expectOk(input);
        expect(observation.absenceMeansAvailable).toBe(false);
        expect(observation.availabilityInference).toBe("forbidden");
        if (observation.observation === "missing") {
          expect(observation.observedValue).toBeNull();
        }
      }
    });
  });

  describe("provenance and audit", () => {
    it("preserves the envelope clock and does not adopt a worker clock", () => {
      const observation = expectOk(
        lineupEnvelope([lineupRow()], {
          capturedAtUtc: CAPTURED,
          captureTimestampVerified: true,
          workerCapturedAtUtc: "2024-05-01T00:00:00.000Z",
          timestamp: "2024-05-01T00:00:00.000Z",
        }),
      );
      expect(observation.capturedAtUtc).toBe(CAPTURED);
      expect(observation.captureTimestampVerified).toBe(true);
      expect(observation).not.toHaveProperty("workerCapturedAtUtc");
      expect(observation).not.toHaveProperty("timestamp");
    });

    it("preserves an unverified clock and a null clock", () => {
      const unverified = expectOk(
        baseEnvelope({ captureTimestampVerified: false, capturedAtUtc: CAPTURED }),
      );
      expect(unverified.captureTimestampVerified).toBe(false);
      expect(unverified.capturedAtUtc).toBe(CAPTURED);

      const missingClock = expectOk(
        baseEnvelope({ capturedAtUtc: null, captureTimestampVerified: false }),
      );
      expect(missingClock.capturedAtUtc).toBeNull();
      expect(missingClock.captureTimestampVerified).toBe(false);

      const unverifiedNull = expectOk(
        baseEnvelope({ capturedAtUtc: null, captureTimestampVerified: true }),
      );
      expect(unverifiedNull.capturedAtUtc).toBeNull();
      expect(unverifiedNull.captureTimestampVerified).toBe(true);
    });

    it("preserves an empty capture string without replacing it", () => {
      const observation = expectOk(baseEnvelope({ capturedAtUtc: "" }));
      expect(observation.capturedAtUtc).toBe("");
    });

    it.each([
      ["envelope id", { envelopeId: "" }],
      ["envelope id characters", { envelopeId: `${SECRET} ${PLAYER}` }],
      ["capture type", { capturedAtUtc: 1_700_000_000_000 }],
      ["verified type", { captureTimestampVerified: "true" }],
      ["missing clock", { capturedAtUtc: undefined }],
    ] as const)("rejects an unusable %s on a success body", (_label, fields) => {
      const envelope = baseEnvelope();
      if ("capturedAtUtc" in fields && fields.capturedAtUtc === undefined) {
        delete (envelope as { capturedAtUtc?: unknown }).capturedAtUtc;
      }
      expectReason({ ...envelope, ...fields }, "malformed_response");
    });

    it("rejects a missing envelope before reading a status accessor", () => {
      for (const input of [undefined, null, 1, "env", [], FIXTURE]) {
        expectReason(input, "malformed_response");
      }
      const reads = readsCounter();
      expectReason(trappingProxy(baseEnvelope({ status: 401 }), reads), "malformed_response");
      expect(reads.count).toBe(0);
    });

    it("does not require provenance fields to classify 401", () => {
      expectReason(
        { status: 401, body: { message: `${PHRASE} ${SECRET}`, player: PLAYER } },
        "unauthorized",
      );
    });

    it("keeps failure output to a reason code when the body contains secrets", () => {
      expectReason(
        baseEnvelope({
          body: emptyBody("lineups", {
            paging: { current: 2, total: 1, next: `https://provider.example/${BODY_TOKEN}` },
            note: `${PLAYER} ${SECRET}`,
          }),
        }),
        "unexpected_pagination",
      );
    });

    it("does not attach a prospective or current label", () => {
      const observation = expectOk(lineupEnvelope([lineupRow()]));
      expect(Object.keys(observation)).not.toContain("provenance");
      expect(Object.keys(observation)).not.toContain("evidenceClass");
    });

    it("feeds the stored observation to the unchanged classifier", () => {
      const present = expectOk(lineupEnvelope([lineupRow({ starters: [15, 16] })]));
      const classified = classifyPe5Evidence(toEvidence(present));
      expect(classified).toMatchObject({
        ok: true,
        evidenceClass: "PROSPECTIVE_PREMATCH_SNAPSHOT",
        reason: "classified",
        targetPrematchEligible: true,
        laterTargetHistoryEligible: false,
        numericValue: null,
        retainedObservation: 2,
        zeroFilled: false,
      });
      expect(present.availabilityInference).toBe("forbidden");

      const presentZero = expectOk(
        lineupEnvelope([lineupRow({ starters: ["01"], substitutes: [] })]),
      );
      const zeroDecision = classifyPe5Evidence(toEvidence(presentZero));
      expect(zeroDecision.ok).toBe(true);
      expect(zeroDecision.retainedObservation).toBe(0);
      expect(zeroDecision.numericValue).toBeNull();
      expect(presentZero.availabilityInference).toBe("forbidden");

      const missing = expectOk(baseEnvelope());
      const missingDecision = classifyPe5Evidence(toEvidence(missing));
      expect(missingDecision).toMatchObject({
        ok: false,
        evidenceClass: "UNSUPPORTED_OR_UNAVAILABLE",
        reason: "missing_observation",
        retainedObservation: null,
        numericValue: null,
        targetPrematchEligible: false,
      });

      const coerced = classifyPe5Evidence(
        toEvidence(missing, { observation: "missing", observedValue: 0 }),
      );
      expect(coerced.reason).toBe("missing_coerced_to_zero");
      expect(missing.observedValue).toBeNull();
    });

    it("does not promote an unverified, null, or kickoff clock", () => {
      const unverified = expectOk(
        lineupEnvelope([lineupRow()], { captureTimestampVerified: false }),
      );
      expect(classifyPe5Evidence(toEvidence(unverified))).toMatchObject({
        ok: false,
        evidenceClass: "CURRENT_SNAPSHOT_UNPROVEN",
        reason: "capture_timestamp_unverified",
        targetPrematchEligible: false,
      });

      const absent = expectOk(
        lineupEnvelope([lineupRow()], {
          capturedAtUtc: null,
          captureTimestampVerified: true,
        }),
      );
      expect(absent.capturedAtUtc).toBeNull();
      expect(absent.captureTimestampVerified).toBe(true);
      expect(classifyPe5Evidence(toEvidence(absent)).reason).toBe(
        "missing_capture_timestamp",
      );

      const equalClock = expectOk(
        lineupEnvelope([lineupRow()], { capturedAtUtc: KICKOFF }),
      );
      expect(equalClock.capturedAtUtc).toBe(KICKOFF);
      expect(classifyPe5Evidence(toEvidence(equalClock))).toMatchObject({
        ok: false,
        reason: "capture_time_is_fixture_kickoff",
        targetPrematchEligible: false,
      });

      const current = classifyPe5Evidence(
        toEvidence(expectOk(lineupEnvelope([lineupRow()])), {
          provenance: "current_snapshot",
        }),
      );
      expect(current.evidenceClass).toBe("CURRENT_SNAPSHOT_UNPROVEN");
      expect(current.reason).toBe("ambiguous_provenance");
      expect(current.targetPrematchEligible).toBe(false);
    });

    it("ignores unknown data and does not call accessors on unread keys", () => {
      const reads = readsCounter();
      const body = bodyWith([lineupRow({ starters: [8] })]);
      defineThrowingGetter(body, "schemaVersion", reads);
      defineThrowingGetter(body, "coach", reads);
      const observation = expectOk(lineupEnvelope([], { body }));
      expect(reads.count).toBe(0);
      expect(observation.observedValue).toBe(1);
      expect(observation).not.toHaveProperty("schemaVersion");
      expect(observation).not.toHaveProperty("coach");
    });
  });

  describe("source boundary", () => {
    it("does not read a wall clock or call fetch while normalizing", () => {
      const now = vi.spyOn(Date, "now");
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      try {
        const observation = expectOk(lineupEnvelope([lineupRow()]));
        expect(observation.observedValue).toBe(1);
        expect(now).not.toHaveBeenCalled();
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        now.mockRestore();
        vi.unstubAllGlobals();
      }
    });

    it("stays inside the offline normalizer boundary", () => {
      const source = readFileSync(
        path.join(
          process.cwd(),
          "lib/debug/calibration/pe5-acquisition-boundary/normalize.ts",
        ),
        "utf8",
      );
      expect(source.match(/^import .+$/gm)).toEqual(['import { types } from "node:util";']);
      const forbidden = [
        /from\s+["']node:fs["']/,
        /from\s+["']node:http["']/,
        /from\s+["']node:https["']/,
        /from\s+["']node:net["']/,
        /from\s+["']fs["']/,
        /\bfetch\s*\(/,
        /\bimport\s*\(/,
        /createApiFootballClient/,
        /withApiFootballClientCache/,
        /API_FOOTBALL_KEY/,
        /axios/,
        /undici/,
        /api-sports\.io/,
        /writeFile|appendFile|mkdirSync|createWriteStream/,
        /child_process/,
        /process\.env/,
        /Date\.now/,
        /tryReserve/,
        /deriveOperationId/,
        /classifyPe5Evidence/,
        /probe-runner/,
        /prospective_snapshot/,
        /current_snapshot/,
        /readFileSync/,
        /globalThis/,
        /XMLHttpRequest/,
        /WebSocket/,
      ];
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    });
  });
});
