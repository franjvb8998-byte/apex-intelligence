import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MAX_NEW_TICKETS_PER_RUN,
  parseMaxNewTicketsPerRun,
} from "@/lib/prematch-lifecycle/config";
import {
  RUNNER_EXIT,
  executePrematchLifecycleRunner,
  sanitizePrematchLifecycleReport,
  validatePrematchLifecycleRunnerEnv,
} from "@/lib/prematch-lifecycle/runner";
import type { PrematchLifecycleReport } from "@/lib/prematch-lifecycle/report";
import { emptyPrematchLifecycleReport } from "@/lib/prematch-lifecycle/report";

const WORKFLOW_PATH = resolve(
  process.cwd(),
  ".github/workflows/apex-prematch-lifecycle.yml",
);
const PACKAGE_JSON_PATH = resolve(process.cwd(), "package.json");
const SCRIPT_PATH = resolve(process.cwd(), "scripts/run-prematch-lifecycle.ts");
const RUNNER_PATH = resolve(process.cwd(), "lib/prematch-lifecycle/runner.ts");

const SECRET_SERVICE_ROLE = "sr_test_secret_value_never_print_me";
const SECRET_API_KEY = "af_test_secret_value_never_print_me";

function validEnv(
  overrides: Record<string, string | undefined> = {},
): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: SECRET_SERVICE_ROLE,
    API_FOOTBALL_KEY: SECRET_API_KEY,
    APEX_LIFECYCLE_LEAGUE_IDS: "39",
    ...overrides,
  };
}

function sampleReport(
  overrides: Partial<PrematchLifecycleReport> = {},
): PrematchLifecycleReport {
  return {
    ...emptyPrematchLifecycleReport("2026-09-22T16:00:00.000Z", 1),
    completedAtUtc: "2026-09-22T16:00:02.000Z",
    discoveredFixtureCount: 10,
    eligibleT120Count: 1,
    alreadyTicketedCount: 1,
    ...overrides,
  };
}

describe("prematch lifecycle CLI runner", () => {
  it("A. invokes lifecycle exactly once / healthy idle → exit 0", async () => {
    const runLifecycle = vi.fn(async () =>
      sampleReport({
        eligibleT120Count: 0,
        alreadyTicketedCount: 0,
        discoveredFixtureCount: 3,
      }),
    );
    const stdout: string[] = [];
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle,
      writeStdout: (line) => stdout.push(line),
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OK);
    expect(runLifecycle).toHaveBeenCalledTimes(1);
    expect(stdout).toHaveLength(1);
  });

  it("B. healthy capture → exit 0", async () => {
    const runLifecycle = vi.fn(async () =>
      sampleReport({
        newTicketsCreated: 2,
        oddsRequests: 2,
        peComputations: 2,
        fatalErrorCount: 0,
      }),
    );
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OK);
  });

  it("C. idempotent already-ticketed → exit 0", async () => {
    const runLifecycle = vi.fn(async () =>
      sampleReport({
        alreadyTicketedCount: 2,
        newTicketAttempts: 0,
        oddsRequests: 0,
        peComputations: 0,
      }),
    );
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OK);
  });

  it("D. isolated fixture error (errorCount>0, fatal=0) → exit 0", async () => {
    const runLifecycle = vi.fn(async () =>
      sampleReport({
        errorCount: 2,
        fatalErrorCount: 0,
        newTicketsCreated: 1,
      }),
    );
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OK);
    expect(runLifecycle).toHaveBeenCalledTimes(1);
  });

  it("E. discovery run-level failure (fatal>0) → exit 3", async () => {
    const runLifecycle = vi.fn(async () =>
      sampleReport({
        discoveredFixtureCount: 0,
        errorCount: 2,
        fatalErrorCount: 1,
      }),
    );
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OPERATIONAL);
  });

  it("F/G. provider auth/quota fatal path via fatalErrorCount → exit 3", async () => {
    const runLifecycle = vi.fn(async () =>
      sampleReport({ errorCount: 1, fatalErrorCount: 1 }),
    );
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OPERATIONAL);
  });

  it("H. durable store run-level unavailable → exit 3", async () => {
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle: async () =>
        sampleReport({ errorCount: 3, fatalErrorCount: 3 }),
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OPERATIONAL);
  });

  it("I. ticket-list infrastructure failure → exit 3", async () => {
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle: async () =>
        sampleReport({
          ticketListPages: 0,
          errorCount: 1,
          fatalErrorCount: 1,
        }),
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OPERATIONAL);
  });

  it("J. missing config → exit 1 (service-role)", async () => {
    const runLifecycle = vi.fn(async () => sampleReport());
    const code = await executePrematchLifecycleRunner(
      validEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined }),
      { runLifecycle, writeStdout: () => undefined, writeStderr: () => undefined },
    );
    expect(code).toBe(RUNNER_EXIT.CONFIG);
    expect(runLifecycle).not.toHaveBeenCalled();
    expect(
      validatePrematchLifecycleRunnerEnv(
        validEnv({ SUPABASE_SERVICE_ROLE_KEY: "" }),
      ).ok,
    ).toBe(false);
  });

  it("missing provider key fails before lifecycle", async () => {
    const runLifecycle = vi.fn(async () => sampleReport());
    const code = await executePrematchLifecycleRunner(
      validEnv({
        API_FOOTBALL_KEY: undefined,
        APISPORTS_KEY: undefined,
        API_KEY: undefined,
      }),
      { runLifecycle, writeStdout: () => undefined, writeStderr: () => undefined },
    );
    expect(code).toBe(RUNNER_EXIT.CONFIG);
    expect(runLifecycle).not.toHaveBeenCalled();
  });

  it("missing Supabase URL fails before lifecycle", async () => {
    const runLifecycle = vi.fn(async () => sampleReport());
    const code = await executePrematchLifecycleRunner(
      validEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined }),
      { runLifecycle, writeStdout: () => undefined, writeStderr: () => undefined },
    );
    expect(code).toBe(RUNNER_EXIT.CONFIG);
    expect(runLifecycle).not.toHaveBeenCalled();
  });

  it("missing/empty league config fails closed before lifecycle", async () => {
    const runLifecycle = vi.fn(async () => sampleReport());
    for (const league of [undefined, "", "   "]) {
      const code = await executePrematchLifecycleRunner(
        validEnv({ APEX_LIFECYCLE_LEAGUE_IDS: league }),
        {
          runLifecycle,
          writeStdout: () => undefined,
          writeStderr: () => undefined,
        },
      );
      expect(code).toBe(RUNNER_EXIT.CONFIG);
    }
    expect(runLifecycle).not.toHaveBeenCalled();
  });

  it("invalid league config fails closed before lifecycle", async () => {
    const runLifecycle = vi.fn(async () => sampleReport());
    const code = await executePrematchLifecycleRunner(
      validEnv({ APEX_LIFECYCLE_LEAGUE_IDS: "39, abc" }),
      { runLifecycle, writeStdout: () => undefined, writeStderr: () => undefined },
    );
    expect(code).toBe(RUNNER_EXIT.CONFIG);
    expect(runLifecycle).not.toHaveBeenCalled();
  });

  it("cron secret is not required", async () => {
    const runLifecycle = vi.fn(async () => sampleReport());
    const env = validEnv();
    delete env.APEX_LIFECYCLE_CRON_SECRET;
    const code = await executePrematchLifecycleRunner(env, {
      runLifecycle,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.OK);
    expect(runLifecycle).toHaveBeenCalledTimes(1);
    expect(validatePrematchLifecycleRunnerEnv(env).ok).toBe(true);
  });

  it("K. uncaught → exit 2 / no retry loop", async () => {
    const runLifecycle = vi.fn(async () => {
      throw new Error("boom");
    });
    const code = await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle,
      writeStdout: () => undefined,
      writeStderr: () => undefined,
    });
    expect(code).toBe(RUNNER_EXIT.LIFECYCLE);
    expect(runLifecycle).toHaveBeenCalledTimes(1);
  });

  it("sanitized output contains report counters including fatalErrorCount", async () => {
    const stdout: string[] = [];
    await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle: async () =>
        sampleReport({
          newTicketsCreated: 2,
          oddsRequests: 2,
          peComputations: 2,
          errorCount: 0,
          fatalErrorCount: 0,
        }),
      writeStdout: (line) => stdout.push(line),
      writeStderr: () => undefined,
    });
    const summary = JSON.parse(stdout[0]!) as Record<string, unknown>;
    expect(summary.startedAtUtc).toBeTruthy();
    expect(summary.completedAtUtc).toBeTruthy();
    expect(summary.configuredLeagueCount).toBe(1);
    expect(summary.newTicketsCreated).toBe(2);
    expect(summary.oddsRequests).toBe(2);
    expect(summary.peComputations).toBe(2);
    expect(summary.errorCount).toBe(0);
    expect(summary.fatalErrorCount).toBe(0);
    expect(Object.keys(summary).sort()).toEqual(
      Object.keys(sanitizePrematchLifecycleReport(sampleReport())).sort(),
    );
  });

  it("hostile report stdout excludes ticket/selection/probability/EV/odds fields", async () => {
    const stdout: string[] = [];
    const hostile = {
      ...sampleReport(),
      ticket: { ticketId: "apex:prematch-decision:v1:1", selections: [] },
      selection: "home",
      selectionLabel: "Home",
      probability: 0.55,
      modelProbability: 0.55,
      expectedValue: 0.12,
      ev: 0.12,
      odds: 2.1,
      offeredOdds: 2.1,
      fairOdds: 1.9,
    } as unknown as PrematchLifecycleReport;
    await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle: async () => hostile,
      writeStdout: (line) => stdout.push(line),
      writeStderr: () => undefined,
    });
    const summary = JSON.parse(stdout[0]!) as Record<string, unknown>;
    for (const key of [
      "ticket",
      "selection",
      "selectionLabel",
      "probability",
      "modelProbability",
      "expectedValue",
      "ev",
      "odds",
      "offeredOdds",
      "fairOdds",
    ]) {
      expect(summary).not.toHaveProperty(key);
    }
  });

  it("output does not contain supplied secret values", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    await executePrematchLifecycleRunner(validEnv(), {
      runLifecycle: async () => sampleReport(),
      writeStdout: (line) => stdout.push(line),
      writeStderr: (line) => stderr.push(line),
    });
    const blob = [...stdout, ...stderr].join("\n");
    expect(blob).not.toContain(SECRET_SERVICE_ROLE);
    expect(blob).not.toContain(SECRET_API_KEY);

    await executePrematchLifecycleRunner(
      validEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined }),
      {
        runLifecycle: async () => sampleReport(),
        writeStdout: (line) => stdout.push(line),
        writeStderr: (line) => stderr.push(line),
      },
    );
    const errBlob = stderr.join("\n");
    expect(errBlob).not.toContain(SECRET_SERVICE_ROLE);
    expect(errBlob).not.toContain(SECRET_API_KEY);
  });

  it("accepts APISPORTS_KEY as canonical provider-key alternate", async () => {
    const runLifecycle = vi.fn(async () => sampleReport());
    const code = await executePrematchLifecycleRunner(
      validEnv({
        API_FOOTBALL_KEY: undefined,
        APISPORTS_KEY: SECRET_API_KEY,
      }),
      { runLifecycle, writeStdout: () => undefined, writeStderr: () => undefined },
    );
    expect(code).toBe(RUNNER_EXIT.OK);
    expect(runLifecycle).toHaveBeenCalledTimes(1);
  });

  it("does not invent an all-leagues fallback", () => {
    expect(
      validatePrematchLifecycleRunnerEnv(
        validEnv({ APEX_LIFECYCLE_LEAGUE_IDS: undefined }),
      ),
    ).toMatchObject({ ok: false, code: "empty_league_allowlist" });
  });

  it("workflow-shaped empty MAX_NEW_TICKETS preserves default 10", () => {
    expect(parseMaxNewTicketsPerRun("")).toBe(DEFAULT_MAX_NEW_TICKETS_PER_RUN);
    expect(parseMaxNewTicketsPerRun("   ")).toBe(
      DEFAULT_MAX_NEW_TICKETS_PER_RUN,
    );
    expect(DEFAULT_MAX_NEW_TICKETS_PER_RUN).toBe(10);
    // Runner must not reject empty MAX — only coordinator/config parses it.
    expect(
      validatePrematchLifecycleRunnerEnv(
        validEnv({ APEX_LIFECYCLE_MAX_NEW_TICKETS_PER_RUN: "" }),
      ).ok,
    ).toBe(true);
  });
});

describe("apex-prematch-lifecycle workflow contract", () => {
  const yaml = readFileSync(WORKFLOW_PATH, "utf8");
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const scriptSource = readFileSync(SCRIPT_PATH, "utf8");
  const runnerSource = readFileSync(RUNNER_PATH, "utf8");

  it("K. has workflow_dispatch", () => {
    expect(yaml).toMatch(/^\s*workflow_dispatch:\s*$/m);
  });

  it("L. has schedule", () => {
    expect(yaml).toMatch(/^\s*schedule:\s*$/m);
  });

  it("M. schedule is exactly 7,22,37,52 * * * *", () => {
    expect(yaml).toMatch(/cron:\s*["']7,22,37,52 \* \* \* \*["']/);
    expect(yaml).not.toMatch(/cron:\s*["']\*\/15/);
    expect(yaml).not.toMatch(/0,15,30,45/);
  });

  it("N. permissions contents read only", () => {
    expect(yaml).toMatch(/permissions:\s*\n\s*contents:\s*read\s*$/m);
    expect(yaml).not.toMatch(/contents:\s*write/);
    expect(yaml).not.toMatch(/packages:\s*write/);
    expect(yaml).not.toMatch(/id-token:\s*write/);
    expect(yaml).not.toMatch(/pull-requests:/);
  });

  it("O. concurrency cancel-in-progress false", () => {
    expect(yaml).toMatch(/group:\s*apex-prematch-lifecycle/);
    expect(yaml).toMatch(/cancel-in-progress:\s*false/);
  });

  it("P. timeout bounded", () => {
    expect(yaml).toMatch(/timeout-minutes:\s*10\b/);
  });

  it("Q. npm ci used", () => {
    expect(yaml).toMatch(/run:\s*npm ci\b/);
  });

  it("R. deterministic package script used", () => {
    expect(pkg.scripts?.["lifecycle:prematch"]).toBe(
      "tsx scripts/run-prematch-lifecycle.ts",
    );
    expect(pkg.devDependencies?.tsx).toBeTruthy();
    expect(yaml).toMatch(/run:\s*npm run lifecycle:prematch\b/);
    expect(yaml).not.toMatch(/npx --yes tsx/);
  });

  it("S. no pull_request trigger", () => {
    expect(yaml).not.toMatch(/^\s*pull_request\s*:/m);
    expect(yaml).not.toMatch(/^\s*pull_request_target\s*:/m);
  });

  it("T. no HTTP lifecycle route invocation", () => {
    expect(yaml).not.toMatch(/curl/);
    expect(yaml).not.toMatch(/\/api\/internal\/prematch-lifecycle/);
    expect(yaml).not.toMatch(/next (dev|start)/);
    expect(scriptSource).not.toMatch(/\/api\/internal\/prematch-lifecycle/);
    expect(scriptSource).toMatch(/executePrematchLifecycleRunner/);
  });

  it("U. secrets mapped from secrets.*", () => {
    expect(yaml).toMatch(
      /SUPABASE_SERVICE_ROLE_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SERVICE_ROLE_KEY\s*\}\}/,
    );
    expect(yaml).toMatch(
      /API_FOOTBALL_KEY:\s*\$\{\{\s*secrets\.API_FOOTBALL_KEY\s*\}\}/,
    );
  });

  it("V. non-secret config mapped from vars.*", () => {
    expect(yaml).toMatch(
      /NEXT_PUBLIC_SUPABASE_URL:\s*\$\{\{\s*vars\.NEXT_PUBLIC_SUPABASE_URL\s*\}\}/,
    );
    expect(yaml).toMatch(
      /APEX_LIFECYCLE_LEAGUE_IDS:\s*\$\{\{\s*vars\.APEX_LIFECYCLE_LEAGUE_IDS\s*\}\}/,
    );
    expect(yaml).toMatch(
      /APEX_LIFECYCLE_MAX_NEW_TICKETS_PER_RUN:\s*\$\{\{\s*vars\.APEX_LIFECYCLE_MAX_NEW_TICKETS_PER_RUN\s*\}\}/,
    );
  });

  it("W. cron secret absent", () => {
    expect(yaml).not.toMatch(/APEX_LIFECYCLE_CRON_SECRET/);
  });

  it("X. no hardcoded competition 677 in workflow/script/runner", () => {
    expect(yaml).not.toMatch(/\b677\b/);
    expect(scriptSource).not.toMatch(/\b677\b/);
    expect(runnerSource).not.toMatch(/\b677\b/);
  });

  it("uses ubuntu-latest and Node 22", () => {
    expect(yaml).toMatch(/runs-on:\s*ubuntu-latest/);
    expect(yaml).toMatch(/node-version:\s*["']22["']/);
  });

  it("manual dispatch and schedule share the same job", () => {
    const jobsSection = yaml.split(/^jobs:\s*$/m)[1] ?? "";
    const jobNames = [...jobsSection.matchAll(/^ {2}([a-z0-9_-]+):\s*$/gm)].map(
      (m) => m[1],
    );
    expect(jobNames).toEqual(["prematch-lifecycle"]);
  });

  it("does not put service-role or API key in vars", () => {
    expect(yaml).not.toMatch(/secrets\.NEXT_PUBLIC_SUPABASE_URL/);
    expect(yaml).not.toMatch(/vars\.SUPABASE_SERVICE_ROLE_KEY/);
    expect(yaml).not.toMatch(/vars\.API_FOOTBALL_KEY/);
  });
});
