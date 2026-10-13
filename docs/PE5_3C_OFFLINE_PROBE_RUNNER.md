# PE-5.3C — Offline Probe Runner Safety Hardening

PE-5.3C hardens the PE-5.3B offline squad-coverage probe. It does not authorize a live provider call, and it does not change PE-5.2 classification semantics.

**Parent checkpoint:** `71bc98e` (`research(calibration): checkpoint PE-5.3B offline squad coverage probe runner`)

## Public entry

`runPe53bProbe` is dry-run unless `mode` is `in_memory` and the in-memory confirmation matches. In-memory mode calls `createPe53bBuiltinOfflineTransport()`. That function is built inside the offline-capability module and returns an empty fixture envelope. The public input type has no transport field. A caller-supplied callback on the object is ignored.

Live confirmation still cannot authorize a provider. `PE53B_LIVE_PROVIDER_AUTHORIZED` and `pe53Authorized` stay false, and the authorizer still ends at `live_transport_not_implemented` if those flags were ever flipped.

## Transport boundary

`kind: "in_memory"` is not a capability. The runner accepts a transport only when it carries a module-private symbol. That symbol is not exported. A second `Symbol(...)` with the same description does not match.

`probe-test-boundary.ts` is the testing seam. It stamps the symbol onto a double. The stamp does not inspect or sandbox the callback. Source review can see that `runPe53bProbe` never forwards a caller callback. That is static isolation, not a sandbox, a process permission boundary, or a guarantee about other modules a programmer can import.

Regex scans for `fetch`, filesystem, and provider-client imports are review aids. They are not a security boundary.

## Dispatch budget

One counter is stored on `globalThis` under `Symbol.for("apex.pe53c.offlineProbeDispatchBudget")`. The first module copy publishes it. Later copies in the same realm adopt it. Deleting or replacing the slot is written back to the same object. Reservation is a synchronous decrement before the transport call, so overlapping async runs on one event loop cannot jointly pass 20 attempted dispatches.

This is not a cross-process, cross-worker, or multi-host cap. Code in the same process can still call `resetPe53cDispatchBudgetForTests` or mutate the counter. The runner does not refill it between runs. Dry-runs, live rejections, and pre-dispatch gate failures do not reserve.

## Response validation

Pagination must be a plain object whose `current` and `total` are positive safe integers equal to 1. Any other shape or counter is `malformed_response`. A later page or a total above 1 is `unexpected_pagination`. The runner does not request that page.

HTTP status must be an integer from 100 through 599. Strings and non-integers are `malformed_response`. 401 and 403 stop as `unauthorized`. 500–599 stop as `unexpected_provider_behavior`. 429 stops as `rate_limited` unless a daily-quota signal is present.

Daily quota is recognized only from `x-ratelimit-requests-remaining: 0` and from the phrases `request limit for the day` and `daily request quota` in `message`, `error`, or `errors`. Payload text, the word `quota` alone, and `x-ratelimit-remaining` are not daily exhaustion. A malformed body is never stored as an empty success.

Interpretation throws become `unexpected_provider_behavior`. The report keeps earlier measurements, counts the failed dispatch, records the ordinal, and does not include the thrown value.

## Evidence firewall

Historical responses stay `CURRENT_SNAPSHOT_UNPROVEN`. `numericValue` stays null. Missing observations are not zeroes and do not mean available. The runner does not read or write sealed 2025 artifacts. A 2025 season or calendar kickoff stops the plan before the next dispatch.

`writesAttempted` is a runner-local counter. It is not a storage audit. Reports copy `PE53C_REPORT_LIMITATIONS` so those limits stay visible.

## Validation

```bash
npx vitest run lib/debug/calibration/pe5-availability/pe5.probe-runner.test.ts lib/debug/calibration/pe5-availability/pe5.evidence-class.test.ts
npx tsc --noEmit
npx eslint lib/debug/calibration/pe5-availability/probe-runner.ts lib/debug/calibration/pe5-availability/probe-transport.ts lib/debug/calibration/pe5-availability/probe-offline-capability.ts lib/debug/calibration/pe5-availability/probe-test-boundary.ts lib/debug/calibration/pe5-availability/pe5.probe-runner.test.ts
```
