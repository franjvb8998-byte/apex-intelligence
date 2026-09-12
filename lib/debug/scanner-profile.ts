/**
 * Sprint 2.5 — removable Opportunity Scanner instrumentation.
 *
 * Records phase timings and API/CACHE/repository counts for one scan.
 * No-ops when no session is active. Does not change return values.
 * Process-local (one scan at a time). No Node built-ins — safe for Turbopack.
 *
 * Remove: delete this file and the `measurePhase*` / `runScannerProfile` call sites.
 */

export const SCANNER_PROFILE_PHASES = [
  "authentication",
  "catalogue",
  "enrichment",
  "attachOdds",
  "decisionEngine",
  "scoring",
  "serialization",
] as const;

export type ScannerProfilePhase = (typeof SCANNER_PROFILE_PHASES)[number];

export type ScannerProfilePhaseStats = {
  elapsedMs: number;
  fixtures: number;
  apiCalls: number;
  cacheHits: number;
  repositoryCalls: number;
};

export type ScannerProfileSnapshot = {
  totalMs: number;
  fixtures: number;
  oddsAttached: number;
  apiCalls: number;
  cacheHits: number;
  repositoryCalls: number;
  quotaExhausted: boolean;
  phases: Record<ScannerProfilePhase, ScannerProfilePhaseStats>;
};

export type ScannerProfileSession = ScannerProfileSnapshot & {
  startedAt: number;
  stack: ScannerProfilePhase[];
};

const PHASE_LABELS: Record<ScannerProfilePhase, string> = {
  authentication: "Authentication",
  catalogue: "Catalogue",
  enrichment: "Enrichment",
  attachOdds: "attachOdds",
  decisionEngine: "Decision Engine",
  scoring: "Scoring",
  serialization: "Serialization",
};

const GLOBAL_SLOT = Symbol.for("apex.scannerProfile");

type ProfileGlobal = typeof globalThis & {
  [GLOBAL_SLOT]?: ScannerProfileSession | null;
};

function readSession(): ScannerProfileSession | null {
  return (globalThis as ProfileGlobal)[GLOBAL_SLOT] ?? null;
}

export function bindScannerProfile(
  session: ScannerProfileSession | null,
): void {
  writeSession(session);
}

function writeSession(session: ScannerProfileSession | null): void {
  (globalThis as ProfileGlobal)[GLOBAL_SLOT] = session;
}

function emptyPhase(): ScannerProfilePhaseStats {
  return {
    elapsedMs: 0,
    fixtures: 0,
    apiCalls: 0,
    cacheHits: 0,
    repositoryCalls: 0,
  };
}

function createSession(): ScannerProfileSession {
  return {
    startedAt: nowMs(),
    totalMs: 0,
    fixtures: 0,
    oddsAttached: 0,
    quotaExhausted: false,
    apiCalls: 0,
    cacheHits: 0,
    repositoryCalls: 0,
    stack: [],
    phases: {
      authentication: emptyPhase(),
      catalogue: emptyPhase(),
      enrichment: emptyPhase(),
      attachOdds: emptyPhase(),
      decisionEngine: emptyPhase(),
      scoring: emptyPhase(),
      serialization: emptyPhase(),
    },
  };
}

function nowMs(): number {
  return performance.now();
}

export function getScannerProfile(): ScannerProfileSession | null {
  return readSession();
}

export function scannerProfileActive(): boolean {
  return getScannerProfile() != null;
}

export function beginScannerProfile(): ScannerProfileSession {
  const existing = readSession();
  if (existing) return existing;
  const session = createSession();
  writeSession(session);
  return session;
}

export function endScannerProfile(): ScannerProfileSnapshot | null {
  const session = readSession();
  if (!session) return null;
  session.totalMs = nowMs() - session.startedAt;
  printScannerProfile(session);
  writeSession(null);
  return session;
}

export async function runScannerProfile<T>(
  fn: () => Promise<T>,
): Promise<T> {
  beginScannerProfile();
  try {
    return await fn();
  } finally {
    endScannerProfile();
  }
}

export async function measurePhase<T>(
  phase: ScannerProfilePhase,
  fn: () => Promise<T>,
  meta?: { fixtures?: number; session?: ScannerProfileSession | null },
): Promise<T> {
  const session = meta?.session ?? getScannerProfile();
  if (!session) return fn();
  if (meta?.fixtures) session.phases[phase].fixtures += meta.fixtures;
  session.stack.push(phase);
  const started = nowMs();
  try {
    return await fn();
  } finally {
    session.phases[phase].elapsedMs += nowMs() - started;
    session.stack.pop();
  }
}

export function measurePhaseSync<T>(
  phase: ScannerProfilePhase,
  fn: () => T,
  meta?: { fixtures?: number; session?: ScannerProfileSession | null },
): T {
  const session = meta?.session ?? getScannerProfile();
  if (!session) return fn();
  if (meta?.fixtures) session.phases[phase].fixtures += meta.fixtures;
  session.stack.push(phase);
  const started = nowMs();
  try {
    return fn();
  } finally {
    session.phases[phase].elapsedMs += nowMs() - started;
    session.stack.pop();
  }
}

export function noteScannerFixtures(
  phase: ScannerProfilePhase,
  count: number,
): void {
  const session = getScannerProfile();
  if (!session || count <= 0) return;
  session.phases[phase].fixtures += count;
}

export function noteScannerFixtureCount(count: number): void {
  const session = getScannerProfile();
  if (!session) return;
  session.fixtures = count;
}

export function noteScannerQuotaExhausted(): void {
  const session = getScannerProfile();
  if (!session) return;
  session.quotaExhausted = true;
}

export function noteScannerOddsAttached(count = 1): void {
  const session = getScannerProfile();
  if (!session || count <= 0) return;
  session.oddsAttached += count;
}

export function noteApiFootballCacheEvent(event: {
  source: "API" | "CACHE";
}): void {
  const session = getScannerProfile();
  if (!session) return;
  const phase = session.stack[session.stack.length - 1];
  if (event.source === "API") {
    session.apiCalls += 1;
    if (phase) session.phases[phase].apiCalls += 1;
    return;
  }
  session.cacheHits += 1;
  if (phase) session.phases[phase].cacheHits += 1;
}

export function noteScannerRepositoryCall(): void {
  const session = getScannerProfile();
  if (!session) return;
  session.repositoryCalls += 1;
  const phase = session.stack[session.stack.length - 1];
  if (phase) session.phases[phase].repositoryCalls += 1;
}

type Instrumentable = Record<string, unknown>;

function tapMethods<T extends object>(obj: T): T {
  const tapped = { ...obj } as T & Instrumentable;
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (typeof value !== "function") continue;
    const fn = value as (...args: unknown[]) => unknown;
    (tapped as Instrumentable)[key as string] = (...args: unknown[]) => {
      noteScannerRepositoryCall();
      return fn.apply(obj, args);
    };
  }
  return tapped;
}

export function instrumentRepositories<
  T extends {
    fixtures: object;
    teams: object;
    odds: object;
    standings: object;
    statistics: object;
    matchAnalysis: object;
  },
>(repos: T): T {
  if (!scannerProfileActive()) return repos;
  return {
    ...repos,
    fixtures: tapMethods(repos.fixtures),
    teams: tapMethods(repos.teams),
    odds: tapMethods(repos.odds),
    standings: tapMethods(repos.standings),
    statistics: tapMethods(repos.statistics),
    matchAnalysis: tapMethods(repos.matchAnalysis),
  };
}

function roundMs(ms: number): number {
  return Math.round(ms);
}

function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function padLabel(label: string, width = 25): string {
  const body = `${label} `;
  if (body.length >= width) return `${label} `;
  return `${body}${".".repeat(width - body.length)} `;
}

export function formatScannerProfile(snapshot: ScannerProfileSnapshot): string {
  const total = roundMs(snapshot.totalMs);
  const lines = [
    "=========================",
    "Opportunity Scanner Profile",
    "=========================",
    "",
    `Total: ${total} ms`,
    "",
  ];

  for (const phase of SCANNER_PROFILE_PHASES) {
    const stats = snapshot.phases[phase];
    const ms = roundMs(stats.elapsedMs);
    const pct = percentOf(stats.elapsedMs, snapshot.totalMs);
    lines.push(`${padLabel(PHASE_LABELS[phase])}${ms} ms (${pct}%)`);
  }

  lines.push("");
  lines.push("Phase                  ms     %  fixtures   API  CACHE  repos");
  for (const phase of SCANNER_PROFILE_PHASES) {
    const stats = snapshot.phases[phase];
    lines.push(
      [
        PHASE_LABELS[phase].padEnd(20),
        String(roundMs(stats.elapsedMs)).padStart(6),
        String(percentOf(stats.elapsedMs, snapshot.totalMs)).padStart(5),
        String(stats.fixtures).padStart(10),
        String(stats.apiCalls).padStart(5),
        String(stats.cacheHits).padStart(6),
        String(stats.repositoryCalls).padStart(7),
      ].join(" "),
    );
  }

  const workMs = SCANNER_PROFILE_PHASES.reduce(
    (sum, phase) => sum + snapshot.phases[phase].elapsedMs,
    0,
  );

  lines.push("");
  lines.push(`API calls: ${snapshot.apiCalls}`);
  lines.push(`CACHE hits: ${snapshot.cacheHits}`);
  lines.push(`Repository calls: ${snapshot.repositoryCalls}`);
  lines.push(`Fixtures: ${snapshot.fixtures}`);
  lines.push(`Odds attached: ${snapshot.oddsAttached}`);
  if (snapshot.quotaExhausted) {
    lines.push("Quota exhausted: yes");
  }
  lines.push(`Phase work sum: ${roundMs(workMs)} ms`);
  lines.push(
    "Note: phase ms are exclusive work time. Fixture phases overlap (concurrency 3); auth overlaps the scan.",
  );
  return lines.join("\n");
}

export function printScannerProfile(snapshot: ScannerProfileSnapshot): void {
  for (const line of formatScannerProfile(snapshot).split("\n")) {
    console.log(line);
  }
}
