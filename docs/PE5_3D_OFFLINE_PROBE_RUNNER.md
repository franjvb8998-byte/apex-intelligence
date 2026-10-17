# PE-5.3D — Budget Integrity and Transport Isolation

PE-5.3D replaces the PE-5.3C budget slot and the symbol-branded transport seam. It does not authorize a live provider call, and it does not change PE-5.2 classification semantics.

**Parent checkpoint:** `f436eb7` (`research(calibration): checkpoint PE-5.3C offline runner safety hardening`)

## Budget ownership

`probe-runner.ts` keeps one integer inside `createModuleDispatchBudget`. The integer is not a property of an object that callers can see, and it is not stored on `globalThis`. `tryReserve` checks and decrements it synchronously before `offlineFixtureReader` is called. Every `runPe53bProbe` on that module evaluation shares the integer, so overlapping async runs on one event loop cannot jointly pass 20 attempted dispatches.

There is no exported reset and no exported remaining counter. Dry-run, live rejection, a missing in-memory confirmation, and a pre-dispatch gate do not reserve. A dispatch that is reserved stays consumed when the fixture reader throws. Later runs on the same evaluation see the exhausted integer.

This is not a process-wide guarantee. A second evaluation of the module — `vi.resetModules()`, a second worker, a second OS process, or a second bundled copy — has its own integer. Tests use a fresh evaluation when they need a full budget. The public runner cannot do that.

`originRequestsAttempted` is the count for that run only. Reports set `sharedBudget.reported` to false. They do not include a remaining balance, because this module cannot verify a process-wide quota.

## Transport isolation

`runPe53bProbe` builds the official plan and calls `executeOfficialPlan`. That function calls `offlineFixtureReader`, a const captured from `readPe53bOfflineFixture` when the runner module initializes. The public input type has no transport field. Extra properties, including a `request` callback or a symbol stamp, are not read.

`readPe53bOfflineFixture` returns one empty envelope. It does not take a callback. The symbol capability, `executePe53bBrandedPlan`, `createPe53bBrandedOfflineTransport`, and `probe-test-boundary.ts` are removed. `Object.getOwnPropertySymbols` cannot recover an authorization bit that is not stored.

### What TypeScript and the module graph enforce

- The public function's type and body do not accept a caller callback.
- The runner module does not export a function that invokes a caller-supplied callback.
- Nothing in this folder re-exports a test double.
- A local const copies the fixture reader at initialization, so a later assignment to the export does not retarget that evaluation. Native ESM rejects the assignment outright.

### What still needs an OS sandbox

- A process that can edit these files, mock the module before it initializes, or run a second copy of the program can still call the network itself.
- TypeScript disappears at runtime. A caller who ignores the type can pass extra fields; the implementation does not read them, but the type checker is not a security boundary.
- Source scans for `fetch`, HTTP clients, and provider SDKs are review aids.

The runner does not use `fetch`, an HTTP client, a provider SDK, a database client, a filesystem writer, or a dynamic import.

## Accounting

The loop remembers `attempted` and `measurements` outside the per-request work.

1. A gate failure returns before reserve. That request is not counted.
2. Reserve runs synchronously. If it returns false, the report stops with `request_cap` and `stoppedAtOrdinal: null`. The current request is not counted.
3. If reserve throws, earlier attempts and measurements are kept and the current request is not counted.
4. After a successful reserve, the attempt is counted, then the fixture reader is called.
5. A throw from the reader or from interpretation keeps that attempt, does not invent a measurement, records the ordinal, and uses `unexpected_provider_behavior`. The thrown message is not copied into the report.

`request_cap` uses a null ordinal because the cap fires before a dispatch is attributed to that fixture. Response and gate stops use the snapshot ordinal.

## Quota headers

`x-ratelimit-requests-remaining` is matched by exact name, case-insensitive, own property only. Numeric `0` and all-zero digit strings (`"0"`, `"00"`, `"000"`, surrounding whitespace) are exhaustion. A positive canonical integer is not exhaustion. Any other present value, including `"0.0"`, `"01"`, accessors, and non-numeric values, is `malformed_response`.

`x-ratelimit-remaining` and other names are ignored. The phrases `request limit for the day` and `daily request quota` in `message`, `error`, or `errors` still mean `quota_exhausted`. A lone `quota` does not. Status 500–599 still stops as `unexpected_provider_behavior` before quota text is read. A malformed remaining header on HTTP 429 fails closed as `malformed_response`.

## Pagination

`current` and `total` must be own data properties of a plain, non-proxy paging object. Inherited counters, accessors, and proxies are `malformed_response`. The accessor is not invoked. Missing, non-integer, negative, zero, `NaN`, and infinite values are `malformed_response`. Any integer other than 1 is `unexpected_pagination`. The runner never requests another page.

## Fixture identity

The ten-fixture allowlist and the lineups-then-injuries order are unchanged.

Explicit rule for an omitted echo: if `parameters.fixture` or a row's `fixture.id` is not an own data property, the runner does not copy the requested id into that field and does not treat the omission as provider confirmation. The measurement's `fixtureId` stays the allowlisted request id. Lineup rows often omit `fixture.id`; rejecting those rows would discard coverage the probe is meant to count. A present own-property string or positive integer that differs is `fixture_id_mismatch`. `null`, objects, accessors, and a fixture id inherited from a custom prototype are `malformed_response`.

Paging proxies and accessor-based paging metadata are rejected as `malformed_response`. Certain Proxy-backed provider rows may still pass the row validator. A contradictory fixture ID inside such a Proxy row may escape fixture-identity comparison. This was reproduced only by replacing the offline fixture reader before module initialization. The built-in public offline reader returns ordinary local fixture objects. This limitation must be resolved or explicitly addressed before any future live transport.

## Evidence firewall

Historical rows stay `CURRENT_SNAPSHOT_UNPROVEN`. `numericValue` stays null. An empty body is stored as `observation: "missing"` and is not availability and not zero. The runner does not read or write sealed 2025 artifacts. A 2025 season or calendar kickoff stops the plan.

PE-5.2 is unchanged. `classifyPe5Evidence` returns `UNSUPPORTED_OR_UNAVAILABLE` / `missing_observation` for a missing observation before it applies the current-snapshot rule. Calling it with `"missing"` would trip `evidence_promotion_blocked` and drop the empty-coverage row, and the class would no longer be `CURRENT_SNAPSHOT_UNPROVEN`. The runner therefore still probes the classifier with `observation: "present"` while the stored measurement uses `"missing"`. That split is a limitation (`emptyObservationProbe`), not a promotion path.

`writesAttempted` stays a runner-local counter. It is not a storage audit.

## Validation

```bash
npx vitest run lib/debug/calibration/pe5-availability/pe5.probe-runner.test.ts lib/debug/calibration/pe5-availability/pe5.evidence-class.test.ts
npx tsc --noEmit
npx eslint lib/debug/calibration/pe5-availability/probe-runner.ts lib/debug/calibration/pe5-availability/probe-transport.ts lib/debug/calibration/pe5-availability/probe-offline-fixture.ts lib/debug/calibration/pe5-availability/pe5.probe-runner.test.ts
git diff --check
```
