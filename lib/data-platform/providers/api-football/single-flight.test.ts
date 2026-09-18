import { afterEach, describe, expect, it } from "vitest";
import {
  resetApiFootballSingleFlightForTests,
  singleFlightApiFootball,
} from "@/lib/data-platform/providers/api-football/single-flight";

afterEach(() => {
  resetApiFootballSingleFlightForTests();
});

describe("singleFlightApiFootball", () => {
  it("invokes the loader once for three concurrent same-key callers", async () => {
    let loads = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = async () => {
      loads += 1;
      await gate;
      return { ok: true, n: loads };
    };

    const pending = Promise.all([
      singleFlightApiFootball("af:team:42", load),
      singleFlightApiFootball("af:team:42", load),
      singleFlightApiFootball("af:team:42", load),
    ]);
    release();
    const results = await pending;

    expect(loads).toBe(1);
    expect(results).toEqual([
      { ok: true, n: 1 },
      { ok: true, n: 1 },
      { ok: true, n: 1 },
    ]);
  });

  it("does not block different keys", async () => {
    const order: string[] = [];
    let releaseA: () => void = () => undefined;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const a = singleFlightApiFootball("af:team:42", async () => {
      order.push("a-start");
      await gateA;
      order.push("a-end");
      return "a";
    });
    const b = singleFlightApiFootball("af:team:49", async () => {
      order.push("b");
      return "b";
    });

    await expect(b).resolves.toBe("b");
    expect(order).toEqual(["a-start", "b"]);
    releaseA();
    await expect(a).resolves.toBe("a");
  });

  it("shares a rejection and allows a later retry", async () => {
    const error = new Error("upstream");
    let loads = 0;
    const load = async () => {
      loads += 1;
      if (loads === 1) throw error;
      return "recovered";
    };

    const first = Promise.allSettled([
      singleFlightApiFootball("af:odds:1", load),
      singleFlightApiFootball("af:odds:1", load),
      singleFlightApiFootball("af:odds:1", load),
    ]);
    const settled = await first;
    expect(loads).toBe(1);
    expect(settled.every((row) => row.status === "rejected")).toBe(true);
    expect(
      settled.map((row) => (row.status === "rejected" ? row.reason : null)),
    ).toEqual([error, error, error]);

    await expect(singleFlightApiFootball("af:odds:1", load)).resolves.toBe(
      "recovered",
    );
    expect(loads).toBe(2);
  });

  it("does not leak a successful result onto a different key", async () => {
    await expect(
      singleFlightApiFootball("af:team:42", async () => "home"),
    ).resolves.toBe("home");
    await expect(
      singleFlightApiFootball("af:team:49", async () => "away"),
    ).resolves.toBe("away");
  });
});
