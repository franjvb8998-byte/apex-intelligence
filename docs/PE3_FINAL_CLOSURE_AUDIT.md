# PE-3 Final Closure Audit

**Status:** CLOSED  
**Live acceptance:** `PE3_C0_LIVE_ACCEPTANCE = PASS`  
**C0 default activation:** remains OFF (`PE3C_C0_RECON_ACTIVATION = false`)  
**Production scheduler:** BASE path only (`npm run lifecycle:prematch`), league allowlist unchanged by this phase

---

## 1. Live acceptance evidence (authoritative)

### Controlled smoke

| Field | Value |
| --- | --- |
| startedAtUtc | `2026-09-24T00:15:20.518Z` |
| completedAtUtc | `2026-09-24T00:15:33.567Z` |
| fixtureId | `1490209` |
| leagueId | `253` |
| season | `2026` |
| matchup | Seattle Sounders vs Real Salt Lake |
| kickoffUtc | `2026-09-24T01:30:00.000Z` |

### Smoke counters

| Counter | Value |
| --- | --- |
| configuredLeagueCount | 1 |
| leagueAllowlistInvalid | false |
| eligibleT120Count | 1 |
| alreadyTicketedCount | 0 |
| newTicketAttempts | 1 |
| newTicketsCreated | 1 |
| newTicketsIdempotent | 0 |
| oddsRequests | 1 |
| peComputations | 1 |
| errorCount | 0 |
| fatalErrorCount | 0 |
| peInputMode | `c0_recon` |
| inputRegime | `REGIME_LIFECYCLE_C0_RECON_V1` |
| c0ReconAttempts | 1 |
| c0ReconTicketsCreated | 1 |
| c0ReconFallbackBasePrior | 0 |
| c0ReconMixed | 0 |
| c0ReconSkipped | 0 |
| seasonUniverseAcquisitions | 1 |
| seasonUniverseHttpRequests | 1 |
| seasonUniverseCacheHits | 0 |
| c0LastSkipReason | null |

### Read-only verifier (PE-3G)

| Field | Value |
| --- | --- |
| fixtureIdRequested | `1490209` |
| fixtureId | `1490209` |
| ticketId | `apex:prematch-decision:v1:1490209` |
| leagueId | `apex:api-football:league:253` |
| season | `2026` |
| kickoffUtc | `2026-09-24T01:30:00.000Z` |
| historicalCutoffUtc | `2026-09-24T01:30:00.000Z` |
| modelVersion | `elo-poisson-hybrid-0.1.0` |
| inputRegime | `REGIME_LIFECYCLE_C0_RECON_V1` |
| acceptedEvidenceDigest | `086f9a476c29ef4ab9ec48d34627034eb19d39d4cf553acbe9e150fb5a88c146` |

#### HOME (catalogue, non-fallback)

| Field | Value |
| --- | --- |
| reconstructedElo | 1552 |
| source | catalogue |
| fallback | false |
| played | 24 |
| acceptedEvidenceCount | 24 |

#### AWAY (catalogue, non-fallback)

| Field | Value |
| --- | --- |
| reconstructedElo | 1498 |
| source | catalogue |
| fallback | false |
| played | 25 |
| acceptedEvidenceCount | 25 |

#### Frozen 1X2

| Selection | Probability |
| --- | --- |
| home | `0.614531265300863` |
| draw | `0.1949789427626912` |
| away | `0.19048979193644583` |

Every PE-3G acceptance check returned `pass=true`.  
Final verifier result: **`PE3_C0_LIVE_ACCEPTANCE = PASS`**.

---

## 2. Windows / libuv assertion investigation

### Observed anomaly (live)

After the verifier had already printed the complete PASS JSON, Windows/Node printed:

```text
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
```

PowerShell then returned to the prompt. Durable acceptance output was already emitted successfully.

### Static findings

- Verifier entrypoint: `scripts/verify-prematch-c0-acceptance.ts`
- Path: argv parse → `runPe3C0AcceptanceVerification` → durable ticket lookup (Supabase/fetch) → pure evaluator → `console.log(JSON)` → **hard `process.exit(...)`**
- Durable backend creates a Supabase JS client per read (`lib/prematch-decision/durable-postgres.ts`) using HTTP/fetch; no explicit agent close before process termination
- Calibration CLIs already prefer soft `process.exitCode = …` (graceful drain)

### Offline reproduction (no Supabase, no API-Football, no production writes)

On this Windows host (Node `v24.19.0`):

| Scenario | Assertion? |
| --- | --- |
| Pure async + hard `process.exit(0)` (no I/O) | No |
| tsx verifier-shaped hard exit (timer only) | No |
| Single loopback `fetch` + hard `process.exit(0)` | No |
| **Three loopback `fetch`es + hard `process.exit(0)`** | **Yes — exact `UV_HANDLE_CLOSING` / `async.c` line 94** (6/6 multi-fetch hard-exit trials after baseline) |
| Three loopback `fetch`es + soft `process.exitCode = 0` / `2` | **No** (0/7 soft-exit trials) |

Stdout always printed PASS JSON before the assertion when hard-exiting after multi-fetch — matching live behavior.

### Root cause

**CLI lifecycle cleanup:** hard `process.exit()` during Node/Windows teardown of HTTP keep-alive / libuv async handles opened by fetch (as used by the durable Supabase read). Not a PE formula, provenance, ticket, or acceptance-evaluator bug.

### Fix applied

Replace hard `process.exit(code)` with soft `process.exitCode = code` in:

- `scripts/verify-prematch-c0-acceptance.ts` (observed anomaly)
- `scripts/run-prematch-lifecycle.ts` (same class after HTTP I/O)
- `scripts/run-prematch-lifecycle-c0-smoke.ts` (same class after HTTP I/O)

No PE/model, fingerprint, activation, workflow, Cloudflare, or durable-ticket changes.

### Disposition

| Item | Assessment |
| --- | --- |
| Blocks PE-3 live acceptance? | **No** — PASS JSON already emitted; durable ticket intact |
| PE / Elo / 1X2 integrity? | Unaffected |
| Remaining risk | Soft exit relies on the event loop draining; keep-alive handles must not pin the process indefinitely (not observed in offline soft-exit trials). Linux CI/production scheduler was already outside this Windows-only abort path. |

---

## 3. Safety confirmations (this closure task)

| Guard | Status |
| --- | --- |
| Live C0 smoke re-run | Not performed |
| Durable ticket 1490209 mutate/delete | Not performed |
| Live API-Football calls | Not performed |
| Supabase writes | Not performed |
| `PE3C_C0_RECON_ACTIVATION` | Remains `false` |
| GitHub Actions / Cloudflare | Unchanged |
| PE formulas / fingerprints / modelVersion | Unchanged |
| Commit / push | Not performed |

---

## 4. Closure decision

**PE-3 is CLOSED** on the strength of the controlled live C0 ticket for fixture `1490209` with verifier `PASS`, catalogue-discriminating Elo on both sides, and frozen 1X2 above.

**Next phase:** PE-4 Current Form & Schedule Intelligence.

Operator runbook remains: `docs/PE3_C0_LIVE_ACCEPTANCE_RUNBOOK.md`.
