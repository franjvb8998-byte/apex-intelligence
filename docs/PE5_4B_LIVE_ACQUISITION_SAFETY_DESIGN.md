# PE-5.4B-R2 — Offline Acquisition Safety Architecture and Threat Model

**Status:** design only. Revision R2 closes the conditional findings from the second adversarial audit: one canonical operation id, ledger-outage accounting, and vendor-day rebind before dispatch. No module in this document is implemented. No provider call is authorized. Describing a control here does not mean the control exists in the repository.

**Baseline:** `main` at `54cce2ed1095bef0c1e013763795a51375d6aa3b` (`54cce2e`, PE-5.3D).
**Parent:** PE-5.4A read-only architecture audit, then the first PE-5.4B document, then the read-only adversarial audit of that document.
**PE-5.2 contract:** `docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md`. Classifier: `lib/debug/calibration/pe5-availability/evidence-class.ts`. Protocol flags: `lib/debug/calibration/pe5-availability/protocol.ts`.
**PE-5.3D contract:** `docs/PE5_3D_OFFLINE_PROBE_RUNNER.md`. Runner: `lib/debug/calibration/pe5-availability/probe-runner.ts`.

A review that accepts this document does not authorize PE-5.4C, and it does not authorize contact with API-Football.

## Source basis and assumptions

Verified on this baseline by reading source and the two contracts above. Tests named in PE-5.3D were not re-executed for this revision.

| Claim | Basis |
|---|---|
| `PE5_PRODUCTION_WIRING`, `acquisitionAuthorized`, `collectorAuthorized`, and `pe53Authorized` are false | `protocol.ts` `pe5Protocol()` |
| `PE53B_LIVE_PROVIDER_AUTHORIZED` is false, and `authorizePe53bLiveProvider` returns `authorized: false` on every path, ending at `live_transport_not_implemented` | `probe-fixtures.ts`, `probe-runner.ts` |
| The 20-request integer lives in one module evaluation. A second evaluation has its own integer | `probe-runner.ts` `createModuleDispatchBudget`; PE-5.3D contract |
| The public runner calls a fixture reader captured at initialization. That reader returns an empty envelope and writes the requested id into `parameters.fixture` | `probe-offline-fixture.ts` |
| Omitted fixture echoes are accepted as coverage. Proxy rows can skip identity comparison and still be counted. Empty bodies are stored as `observation: "missing"` while the classifier is called with `observation: "present"` | `probe-runner.ts`; PE-5.3D contract. No committed test constructs a proxy row. The contract says that escape was reproduced only by replacing the reader before initialization. That run was not repeated here |
| `classifyPe5Evidence` rejects `observation: "missing"` as `UNSUPPORTED_OR_UNAVAILABLE` / `missing_observation` before the current-snapshot rule. A missing observation with `observedValue: 0` is `missing_coerced_to_zero`. A present `observedValue` of 0 can still be `targetPrematchEligible` when the other prospective rules pass | `evidence-class.ts` |
| Positive `x-ratelimit-requests-remaining` is not exhaustion and not malformed. Malformed is returned only after a daily body phrase is checked. Status 500–599 stops before quota text | `probe-runner.ts` `interpretResponse`, `readDailyQuotaHeader`, `parseQuotaRemaining` |
| Production `createApiFootballClient` retries, uses a process-local sliding-window limiter that waits, and a process-local daily circuit that uses `parseInt` | `client.ts`, `retry.ts`, `rate-limiter.ts`, `quota-circuit.ts` |
| `http/client.ts` does not set `redirect` | source inspection. Fetch's runtime default was not executed |
| Match Center enrichment calls fixture injuries and, when lineups are not already carried, lineups | `lib/match-center/enrich.ts` |
| Vision live transport is `getLiveFixtures`, `getFixturesByIds`, and `getLiveEvents` | `lib/apex-vision/live/service.ts` |
| Scheduled lifecycle runs `npm run lifecycle:prematch` with `API_FOOTBALL_KEY` | `.github/workflows/apex-prematch-lifecycle.yml` |
| No PE-5 evidence store or writer exists. `writesAttempted: 0` is a constant | `probe-runner.ts` |
| The frozen-path helper matches substrings | `probe-fixtures.ts` `assertPe53bResearchPathUntouched` |

**Assumptions, not measurements:**

- API-Football counts quota per account credential. The exact daily number and the vendor's day boundary are operator configuration. This design does not hard-code a vendor plan.
- A request that leaves the process may have been counted by the provider even if this process never reads a response. After `sending` is committed, this design charges the attempt even when the socket might not have opened.
- Product Match Center, Vision, and the lifecycle workflow can spend the same credential as a future PE-5 caller if they are configured with the same key. This design does not read deployment secrets, so it does not know whether today's environments share one key.
- Names such as `APEX_PE5_ACQUISITION_MODE` do not exist in the repository. They are proposed configuration, not current flags. The kill switch is not an environment variable.

## 1. Scope and invariants

### What this design specifies

A future boundary that could acquire API-Football injury and lineup evidence under a separate authorization. The boundary includes default-deny authorization, a ledger-backed kill switch, one authoritative reservation ledger, a `sending` commit before any socket, strict identity checks, immutable raw envelopes, append-only normalized records, one budgeted network attempt, and offline adversarial tests.

### What this design does not do

- It does not add or change TypeScript, tests, configuration, workflows, or flags.
- It does not enable `runPe53bProbe` live mode. That function stays an offline runner.
- It does not call API-Football, and it does not permit a later phase to treat this document as that permission.
- It does not change PE-5.2 class names, fail reasons, or the rule that `numericValue` stays null.
- It does not measure historical lineup or injury retention. PE-5.2 still records that measurement as unauthorized.
- It does not claim a betting edge, a weight, or a production expectation.
- It does not put Match Center, Vision, or the prematch lifecycle on the ledger. Those code paths stay as they are.

### Frozen boundaries

| Boundary | What stays frozen |
|---|---|
| PE-3 | Lifecycle behavior, `PE3C_C0_RECON_ACTIVATION = false`, season-universe paging, and the prematch lifecycle workflow. PE-5.4C must not edit them. |
| PE-4 | Acquisition, as-of-T features, expectation, and form. The pinned PE-4I.21 digest in `protocol.ts` stays a pin. PE-5 does not recompute it or join squad rows onto the PE-4 matrix. |
| PE-5.2 | `classifyPe5Evidence` and `pe5Protocol()` semantics. `PE5_PRODUCTION_WIRING` stays false through PE-5.4C. This design calls the classifier. It does not change it. |
| PE-5.3D | The offline probe, its 20-request module integer, and its empty fixture reader. They are not the live transport and not the account ledger. |
| Production | Match Center, Vision, repositories, and `createApiFootballClient` keep their current behavior. PE-5 evidence must not be read out of their caches. |
| 2025 holdout | Provider season `2025` and calendar-2025 kickoffs stay excluded. No phase in this design reads sealed outcome files or `data/calibration` holdout artifacts. |

### Invariants a future implementation must keep

1. Missing configuration denies acquisition.
2. The kill switch is a ledger record. If it is missing, stale, unreadable, or not `clear`, no `reserved` to `sending` transition commits.
3. No socket opens unless this caller has observed a committed `sending` transition for this operation.
4. `consumed` and `failed` never return quota to the daily ceiling or the research ceiling. `sending` never returns quota either. A newly reserved row occupies the vendor day of that reservation, and that occupancy is its one daily charge. A successful atomic `beginSend` may move that same charge onto the verified vendor day of dispatch. The move keeps exactly one daily charge, enforces the destination day's ceiling, and leaves the research budget unchanged. If the destination day cannot be verified, or the destination ceiling cannot hold the row, dispatch is denied.
5. A lost acknowledgement is reconciled by reading the ledger. It is not treated as a fresh budget.
6. The requested fixture id is never copied into a provider body to fill a missing echo.
7. A missing observation is stored with a null observed value. A present zero is a count of returned rows or identified starters, and the stored row forbids an availability inference.
8. `classifyPe5Evidence` receives the same observation and observed value that are stored. The normalizer cannot replace the sealed capture clock.
9. An unverified historical body stays ineligible for `PROSPECTIVE_PREMATCH_SNAPSHOT`.
10. Reports and logs do not contain credentials, raw bodies, or player names.
11. Offline tests passing does not flip any live flag.

## 2. Threat model

### Assets

| Asset | Why it matters |
|---|---|
| Provider credential | Spends the account quota and can read vendor data. |
| Account daily quota and rate window | Exhaustion breaks PE-5 and any product caller that shares the credential. |
| Research request budget | Caps PE-5 operations for one approval. It does not refill when an attempt finishes. |
| Ledger instance | Two ledgers would each grant a full ceiling. |
| Fixture identity | A wrong id attaches evidence to the wrong match. |
| Raw response bytes and sealed capture clock | The only record of what arrived, and when the store accepted it. |
| Normalized evidence and PE-5.2 class | A bad class, or a zero read as "everyone is fit", leaks into a later prematch use. |
| Sealed 2025 outcomes | Must stay unread by this work. |
| Audit trail | The record that a reservation, send commit, or denial happened. |

### Actors

| Actor | Trust |
|---|---|
| Operator authorizing a future pilot | Trusted to issue an out-of-band approval that names one ledger instance. Not trusted to be replaced by a string in source. |
| PE-5 acquisition process | Trusted only while the ledger kill switch is fresh and `clear`, and only for one committed `sending` transition. |
| Product server (Match Center, Vision) | Trusted to serve the product. Not a PE-5 evidence source. Not a writer on this ledger. |
| Lifecycle workflow runner | Trusted to run the existing prematch job. A separate process. Not a writer on this ledger. |
| Provider | Untrusted input. Headers, paging, and ids can be missing, contradictory, or hostile. |
| Stale worker | Holds an old fencing token after a lease release. Must fail the send transition. |
| Developer or test harness | Can mock a module before initialization. That capability is not a live authorization. |
| Repository constants | `false` flags are an enforced deny input. They are not, by themselves, a runtime kill switch. |

### Trust boundaries

```
operator approval (names one ledger instance; outside the repo)
        |
        v
authorizer (mode, approval, protocol flags all false)
        |
        v
one ledger: kill switch + reservations + sealed raw clock
        |
        v
beginSend CAS  -- only then --> one socket (redirect manual)
        |
        v
raw append (store clock, client clock ignored)
        |
        v
normalizer (cannot replace the clock)
        |
        v
unchanged classifyPe5Evidence
        |
        v
append-only evidence log

Match Center, Vision, lifecycle, product caches, the PE-5.3D fixture reader,
and PE-4 stores are outside this path. They do not spend this ledger.
```

### Failure modes and surfaces

| Surface | Failure | Severity if a live path existed |
|---|---|---|
| Module-local integer | Each process or re-evaluation spends its own 20 | Critical. This design does not use that integer as the ceiling. |
| Second ledger instance | A deployment with another ledger id would grant another full budget | Critical. Authorization denies any id other than the approval's id. A process that ignores the authorizer and calls the provider anyway is outside this guarantee. |
| Product and lifecycle spend | Those callers are not on this ledger | Critical for a shared credential. Pilot stays NO-GO until the credential is dedicated or a separate change reserves their calls. |
| Process-local limiter | Waits inside one process and does not reserve account quota | Critical if reused as the PE-5 budget. This design does not reuse it. |
| Lease release then late send | A worker sends with a token the sweeper already retired | Critical. `beginSend` must fail that token. |
| Ambiguous ledger ack | The client guesses and sends, or picks a new purpose string and reserves again | High. Lookup by canonical operation id, then no automatic send. |
| Quota-header misread | A positive remaining count treated as malformed, or a malformed count treated as zero by `parseInt` | High. Header rules below follow PE-5.3D order. The product circuit is not used. |
| Omitted or proxy identity | PE-5.3D can accept an omitted echo and skip a proxy row | High. Live rules below are stricter on purpose. |
| Cache or caller clock | `fetchedAt` or a normalizer argument becomes the capture time | High. The store writes the clock. The normalizer cannot replace it. |
| Present zero | Classifier can mark `observedValue: 0` as `targetPrematchEligible` | Medium for misreading. The stored row forbids an availability inference. The classifier stays unchanged. |
| Secret leakage | Errors copy provider or exception text | High. Reason codes only. |

Severity ratings describe a future live transport. They are not findings that the current offline runner calls the network. The runner does not use `fetch`, a provider SDK, or a filesystem writer.

## 3. Authorization architecture

Authorization is default deny. Every control below is required. Any deny result denies the operation. These controls are specified, not implemented.

| Control | Where it lives | Missing or unreadable | Allow condition |
|---|---|---|---|
| Mode | `APEX_PE5_ACQUISITION_MODE` | Deny | Exact `offline` for a future offline implementation. Exact `pilot` is not an allow until a later pilot authorization exists. Any other value denies. |
| Kill switch | One record on the approved ledger instance, re-read on every reserve and inside `beginSend` | Deny | `state` is exactly `clear`, `version` is an integer, and `updatedAt` on the ledger clock is within `maxAgeMs` of the ledger's current time. |
| Approval record | Out of band, stored where the acquisition process can read it and the product UI cannot | Deny | Names the mode, the credential id (not the secret), `ledgerInstanceId`, the research ceiling, the daily ceiling, the rate ceiling, `rateWindowMs`, the expiry, and the operator. |
| Protocol flags | `pe5Protocol()` and `PE53B_LIVE_PROVIDER_AUTHORIZED`, read at authorization time | Deny | All of `PE5_PRODUCTION_WIRING`, `acquisitionAuthorized`, `collectorAuthorized`, `pe53Authorized`, and `PE53B_LIVE_PROVIDER_AUTHORIZED` are false. If any is true, deny with `protocol_flag_violation`. |

`PE53B_LIVE_CONFIRMATION` (`PE53B_EXECUTE_LIVE`) is not an approval secret. It already ships in the repository. A future pilot must not accept it. An environment variable is not the kill switch. Deleting a variable from a host does not change a running process, so this design does not use that mechanism.

### Kill switch record

Fields: `state` (`clear` or `engaged`), `version` (monotonic integer), `updatedAt` (ledger clock), `maxAgeMs` (freshness bound).

- A missing record is `engaged`.
- `engaged`, an unknown `state`, a non-integer `version`, or an `updatedAt` older than `maxAgeMs` is a deny.
- While operators want the switch clear, a writer must refresh `updatedAt` before it ages out. If that refresh stops, the switch fails closed even if `state` still says `clear`.
- `maxAgeMs` is an unresolved duration. The implementation must refuse to start when the approval record omits it.
- The switch and the reservation rows share one ledger transaction for `beginSend`. A separate cache of an old `clear` value is not an input to that transaction.

### Evaluation order

1. Read the protocol flags from the current process image. If any required flag is true, deny with `protocol_flag_violation`. Do not read the credential. These flags are code constants. `beginSend` does not re-read them inside the ledger transaction. The kill switch is the control that transaction re-reads.
2. Read the kill switch from the ledger. If it is not a fresh `clear`, deny with `kill_switch_engaged` or `kill_switch_unreadable`.
3. Read the mode. If it is missing or not an exact allow value for this phase, deny with `mode_denied`.
4. Read the approval record. If it is missing, expired, has no `ledgerInstanceId`, or its mode disagrees with the mode flag, deny with `approval_missing` or `approval_inconsistent`.
5. If the process's configured ledger id differs from the approval's `ledgerInstanceId`, deny with `ledger_instance_mismatch`. Do not create a second ledger.
6. For `offline`, the decision is `allow-offline`. The transport factory returns the offline double. It does not construct a socket client.
7. For `pilot`, deny with `pilot_not_authorized` until a later document authorizes a pilot. That later document is not this file.
8. The `beginSend` transaction reads the kill switch again. A clear result from step 2 does not satisfy step 8.

### Inconsistent and stale configuration

- Mode `pilot` with an approval record that says `offline` denies.
- Mode `offline` with a fresh kill `clear` allows only the offline double.
- An approval older than its own expiry denies. The implementation must refuse a record with no expiry.
- If two sources disagree, the result is deny.
- An authorization allow is not cached past the next `tryReserve`. `beginSend` does not reuse it at all. It re-reads the kill switch inside the ledger transaction.

### Human approval

The approval record is produced outside the acquisition process by a person, names exactly one `ledgerInstanceId`, and has an expiry. A pull request, a commit message, or this design file is not that record.

### Race between checks and dispatch

The strongest guarantee this design can make is: the socket opens only after this caller has seen a successful compare-and-swap from `reserved` to `sending` whose predicate included a fresh `clear` kill switch. Two ledger writers cannot both win that swap for one row.

The limitation, which cannot be removed while the provider is outside the ledger: after that swap commits, a kill that arrives before the socket system call cannot pull the bytes back if the process still opens the socket. The implementation must open the socket only in the caller that observed the swap, and only once. A kill during that gap does not authorize a second attempt. A process that never saw the swap acknowledgement must not open the socket.

## 4. Shared quota architecture

The PE-5.3D integer and `getSharedApiFootballRateLimiter` are not this ledger. The limiter waits and is process-local. The PE-5.3D integer resets when the module is evaluated again.

There is one ledger per approval, identified by `ledgerInstanceId`. Every PE-5 process and deployment that is allowed to spend must be configured with that same id. A different id is `ledger_instance_mismatch` and opens no socket. Processes serialize inside the occupancy transaction required below. A per-row compare-and-swap is not that transaction. They do not keep a private ceiling.

Match Center, Vision, and `lifecycle:prematch` do not use this ledger. Their current calls can still consume the vendor account when they hold the same credential. This design does not change those programs. A live pilot is NO-GO until the operator shows a credential those three do not use, or a separately authorized change makes each of their origin calls reserve here. PE-5.4C does not make that change. It uses a fake ledger and a fake product spender in tests.

A process that has the credential and calls the provider without this ledger is not stopped by the ledger. Credential isolation is the control for that bypass. It is not implemented here.

### Four counters

| Counter | Period | What is counted | What is not counted |
|---|---|---|---|
| Research ceiling | The current approval's interval, for rows with that `approvalId` and PE-5 `operationId`s | Rows in `reserved`, `sending`, `consumed`, or `failed` | Rows in `expired` or `abandoned` |
| Daily ceiling | The vendor day of `chargeDay`, using the ledger clock and the day boundary in the approval record | Rows in `reserved`, `sending`, `consumed`, or `failed` whose `chargeDay` is that day, for this `credentialId` | Released rows. Sends from other days. |
| Rate window | Rolling `rateWindowMs` ending at the ledger's current time | Rows in `reserved`, `sending`, `consumed`, or `failed` whose send-credit time is inside the window | Released rows |
| Network attempts | One operation | One socket open after a visible `sending` commit | Redirect hops, retries, and extra pages. Those are forbidden. |

`chargeDay` is the single vendor day that holds the row's daily charge. `tryReserve` sets it to the vendor day of the ledger clock at insert. The `beginSend` transaction is the only later writer. If the vendor day has changed, that transaction moves `chargeDay` to the send day in the same write that enters `sending`, or it does not enter `sending`. `consumed` and `failed` keep the `chargeDay` committed with `sending`. A row is never charged to two days, and a send is never left on the pre-rollover day.

Send-credit time is `sendingCommittedAt` for `sending`, `consumed`, and `failed`. For `reserved`, the send-credit time is the ledger time at which occupancy is calculated, so an in-flight hold occupies the current window. When that hold becomes `expired` or `abandoned`, it leaves the window. When it becomes `sending`, the send-credit time freezes at `sendingCommittedAt` and stays in the window until that timestamp ages out. Moving `sending` to `consumed` or `failed` does not remove it from the window and does not remove it from the daily or research ceilings.

Finishing an attempt does not restore quota. The research ceiling does not reset at midnight and does not reset when `chargeDay` moves. A new ledger-assigned `approvalId` starts a new research count. It does not erase the current vendor day's rows from the daily ceiling.

The rate window does not reset at the vendor boundary. It is a rolling ledger-time window. Rebinding a row to a new day does not insert a second rate slot. After `sending` commits, that one row is credited at `sendingCommittedAt`.

| Counter | What rollover does |
|---|---|
| Research ceiling | Same row, same `approvalId`. Still one charge. No refund and no second research charge. |
| Daily ceiling | Before `beginSend`, the row counts on its current `chargeDay`. The send transaction either moves that one charge onto the send day and enters `sending`, or it does not send. |
| Rate window | Still one row. Reserved holds occupy the window at the time of the occupancy check. A committed send occupies it from `sendingCommittedAt` until that timestamp ages out. |

The research ceiling of a future pilot is chosen in that pilot's approval. It is not the PE-5.3D cap of 20. Twenty is the length of the offline historical plan.

`rateWindowMs`, the daily ceiling, and the rate ceiling are approval fields. Missing fields deny. This document does not pick the integers.

### Reservation states

| State | How it is entered | Daily and research ceilings | Rate window | Socket |
|---|---|---|---|---|
| `reserved` | `tryReserve` commits | Charged | Occupies the current window until released or sent | Not opened |
| `sending` | `beginSend` compare-and-swap commits | Stays charged. No automatic refund. | Counted from `sendingCommittedAt` until it ages out | May be opened once by the caller that saw the commit |
| `consumed` | Outcome record after a response body was fully buffered | Stays charged | Unchanged from `sending` | Already attempted |
| `failed` | Outcome record after an error, timeout, bad response, or unknown outcome | Stays charged | Unchanged from `sending` | Already attempted, or the send commit exists and the outcome is unknown |
| `expired` | Sweeper compare-and-swap from `reserved` after `leaseDeadline` | Released | Leaves the window | Must not open |
| `abandoned` | Holder compare-and-swap from `reserved`, with the current token, before `beginSend` | Released | Leaves the window | Must not open |

There is no `abandoned-unknown` state and no refund for an unknown send. If the outcome is unknown after `sending`, the row stays `sending` until a writer records `failed` with reason `outcome_unknown`. Both of those states stay charged.

### Legal transitions

| From | To | Actor | Predicate |
|---|---|---|---|
| none | `reserved` | `tryReserve` | Kill fresh and `clear`. No existing row for `operationId`. Occupancy checks pass. |
| `reserved` | `sending` | `beginSend` | Same row, fencing token matches, `leaseDeadline` is still after ledger now, remaining lease is greater than the fetch timeout, kill switch fresh and `clear` in this transaction, vendor day is known, and the row's one daily charge fits on that send day. A day change is written in this same swap. |
| `reserved` | `expired` | Sweeper | Same row still `reserved`, `leaseDeadline` has passed. |
| `reserved` | `abandoned` | Holder | Same row still `reserved`, fencing token matches, holder cancels before `beginSend`. |
| `sending` | `consumed` | Outcome writer | Send token from the `beginSend` commit matches. Full body buffered. |
| `sending` | `failed` | Outcome writer | Send token matches. Error, timeout, reject, or `outcome_unknown`. |

No transition from `sending`, `consumed`, or `failed` releases the charge. The sweeper must not expire those rows. A second `beginSend` with the old token fails because the state is no longer `reserved` or the token no longer matches.

### `tryReserve`

One transaction:

1. Deny unless the kill switch is a fresh `clear`.
2. Deny unless every protocol flag listed above is false in the current process image. This step is not repeated inside `beginSend`.
3. Compute `operationId`. If any row with that id exists, return the existing row and do not insert another.
4. Deny if daily occupancy for the vendor day of this insert, the day that will be stored as `chargeDay`, plus one exceeds the daily ceiling.
5. Deny if research occupancy for this `approvalId` plus one exceeds the research ceiling.
6. Deny if rate occupancy plus one exceeds the rate ceiling.
7. Insert `reserved` with a new fencing token, `leaseDeadline`, `chargeDay`, `approvalId`, `credentialId`, and `operationId`.
8. Return the token only after the insert commits.

Occupancy in steps 4–6 counts the states in the table above. It does not count only in-flight rows, and it does not drop a row because the HTTP call finished.

### `beginSend`

One transaction, then a socket. Protocol flags are not read again here.

1. Compute the vendor day from the ledger clock and the boundary stored on the approval. If either is missing or the clock cannot be read, the swap fails with `vendor_day_unknown`. The row stays `reserved`. No socket.
2. Let `sendDay` be that vendor day. Compare-and-swap the row from `reserved` to `sending` under the predicate in the transition table, including a fresh `clear` kill switch.
3. If `chargeDay` is already `sendDay`, the same write sets `sendingCommittedAt` and replaces the fencing token with a send token.
4. If `chargeDay` is not `sendDay`, the same write moves `chargeDay` to `sendDay` only when the new day's charged occupancy, including this row and excluding its old day, is within the daily ceiling. That write also sets `sendingCommittedAt` and the send token. If the new day cannot hold the row, the swap fails with `vendor_day_ceiling`. The row stays `reserved` on the old `chargeDay`. No socket and no second row. A later `beginSend` may try the rebind again. Lease expiry can still release the row.
5. Research occupancy is not incremented by the rebind. The rate window does not gain a second row.
6. If the swap does not commit, do not open a socket. A stale token, an expired lease, a row already `sending`, a kill that is not a fresh `clear`, an unknown vendor day, or a full send day are all failures.
7. If the swap commits and the acknowledgement is lost, do not open a socket. Reconcile by lookup.
8. If this caller observes the committed swap, open one socket. Do not open it twice.

### The gap between the swap and the socket

Those two events are not one atomic action with API-Football. A crash in the gap can leave `sending` charged when the provider saw nothing. A kill in the gap can still allow the one caller that observed the commit to open the socket. This design charges that attempt and does not automatically retry it. Another send for the same fixture requires a new ledger-assigned `approvalId`, or a ledger increment of `generation` on an approval whose `allowRegeneration` is true. Callers cannot choose either value. The default is `allowRegeneration: false` and `generation` `0`.

### Crash and lease behavior

| Situation | Result |
|---|---|
| Crash while `reserved`, before `beginSend` | Sweeper moves the row to `expired` after `leaseDeadline` and releases the charge. The old token cannot `beginSend`. |
| Lease expires while the worker is still `reserved` | Same release. A late `beginSend` fails the compare-and-swap. |
| Crash after `sending` commits, before or during the socket | Row stays `sending` or becomes `failed` / `outcome_unknown`. Charge remains. No automatic second socket. |
| Deploy restart | New processes have empty memory. They must `tryReserve` or reconcile. Existing `sending`, `consumed`, and `failed` rows stay charged. |
| Two workers, one remaining unit | One insert commits. The other is denied. |
| Two workers, one `reserved` row | One `beginSend` commits. The other fails. Only the winner may open a socket. |
| Ledger down before any insert | No socket and no row. Nothing is charged. Reason `ledger_unavailable`. |
| Ledger down after a `reserved` insert | The existing row stays charged. No second insert and no socket until a successful lookup returns its token. |
| Ledger down after a `sending` commit | The existing row stays charged. No second insert and no automatic socket. |
| Lookup timeout or an unattested read | Treat the result as unknown. Do not insert. Do not open a socket. Do not clear a charge that may exist. |
| Ledger clock | Lease deadlines, vendor day, `chargeDay`, the rate window, and kill freshness use the ledger clock, not a worker's wall clock. A worker clock that disagrees cannot move the send onto a different day. |
| Vendor day changes while `reserved` | `beginSend` rebinds that one row onto the send day or does not send. It does not insert another operation. |
| Vendor day unknown | `beginSend` fails. No socket. |

`leaseDeadline` must be far enough past the ledger time of `tryReserve` that a normal fetch timeout fits inside the remaining lease at `beginSend`. The exact milliseconds are an approval field. `beginSend` refuses when the remaining lease is not greater than the timeout. After `sending` commits, lease expiry does not release the row.

### Canonical operation identity

The ledger computes `operationId`. Callers do not supply the hash inputs as free strings. A purpose string, run id, process id, timestamp, or raw path spelling is not an input.

```text
operationId = SHA-256(
  ledgerInstanceId + "\n" +
  credentialId + "\n" +
  canonicalPath + "\n" +
  canonicalFixtureId + "\n" +
  endpoint + "\n" +
  approvalId + "\n" +
  generation
)
```

| Field | Rule |
|---|---|
| `endpoint` | Exactly `lineups` or exactly `injuries`. Anything else is `operation_rejected` before insert. |
| `canonicalPath` | Exactly `fixtures/lineups` when `endpoint` is `lineups`. Exactly `injuries` when `endpoint` is `injuries`. The ledger derives this from `endpoint`. It does not hash a caller path. |
| Caller path, if one is presented | Trim whitespace, convert `\` to `/`, then remove every leading `/` and every trailing `/`. The result must equal the `canonicalPath` for that endpoint. `/fixtures/lineups`, `fixtures/lineups`, and `//fixtures/lineups` are the same operation. A trailing query, a fragment, an internal `//`, or any other path is `operation_rejected`. |
| `canonicalFixtureId` | The fixture form in section 5. |
| `approvalId` | The id on the approval record the ledger already stored. Callers cannot substitute another string. |
| `generation` | An integer stored on that approval. The ledger sets it to `0` when the approval is recorded. |

`allowRegeneration` defaults to false. While it is false, `generation` stays `0` and the ledger will not change it. While it is true, the only way to mint a new generation is a ledger write that sets `generation` to the previous integer plus one. That write is a separate human action on the approval record. A caller request cannot choose the integer, and a lost acknowledgement is not that action.

Repeat request, same approval and same generation: `tryReserve` finds the existing row and does not insert another. No automatic socket. If the row is `reserved` and this caller holds the current token, it may `beginSend` once. If the row is `sending`, `consumed`, or `failed`, nobody opens another socket.

Authorization renewal: a person records a new approval. The ledger assigns a new `approvalId` and `generation` `0`. That is a different `operationId`. It may reserve and send. The new row is a new research charge. Its daily charge starts on the reserve day and moves to the send day inside `beginSend` when those days differ. It is not a retry of a lost acknowledgement. A purpose rename under the old approval does not do this.

### Reconciliation after a lost acknowledgement

Lookup is by `operationId` on the approved ledger. It happens before any socket and before any new insert. A row in the table below is a result only when the ledger attests the read. A timeout, an error, or a read the ledger does not attest is the last row. It is not the no-row row.

| Lookup result | Behavior |
|---|---|
| No row, and the lost call was `tryReserve` | The insert did not happen. One new `tryReserve` is allowed. Nothing is charged yet. |
| No row, and the lost call was `beginSend` | Do not open a socket. Do not invent a send. Do not insert a row to replace the missing one. |
| `reserved`, and this caller does not hold the fencing token | The row stays charged. Do not open a socket. Do not insert a second row. The lease may later expire and release. |
| `reserved`, and this caller holds the token | It may `beginSend` once. It must not open a socket before that commit is visible. |
| `sending`, `consumed`, or `failed` | The row stays charged. Do not open a socket. Do not insert another row. |
| Lookup itself fails or is ambiguous | Do not open a socket. Do not insert another row. Any row that already exists keeps the charge for its current state. |

A lost `beginSend` acknowledgement leaves the charge in place when the lookup shows `sending`. The caller that did not see the commit does not open the socket, because it cannot prove it is the winner. If the winner crashed before the socket, the provider may have seen nothing and the ceiling still counts the attempt. Automatic resend is forbidden.

## 5. Evidence identity and validation

Live acceptance is stricter than PE-5.3D coverage counting. The differences are intentional. They are listed after the header order. Header evaluation order matches the committed probe. The stricter identity rules do not.

### Canonical fixture id

The requested id must match `^[1-9][0-9]{0,11}$`. A response value matches only when:

- it is that exact string, or
- it is a safe integer greater than 0 whose decimal form has no leading zero and is equal to that string.

Whitespace, leading zeros, floats, negative numbers, and strings such as `"01"` do not match. The normalizer does not trim a value into a match and does not copy the requested id into a missing field.

### Objects the normalizer may read

For the body, `parameters`, paging, header map, every `response` element, and every nested value reached while reading `get`, `fixture`, `team`, `player`, `startXI`, and `substitutes`:

- `node:util` `types.isProxy` true rejects the whole response as `malformed_response`.
- An accessor on a key being read rejects the whole response. The getter is not called.
- Inherited ids and inherited paging counters reject the whole response.

A proxy nested under a plain row is still a reject. The row is not skipped and is not counted.

### Envelope checks, in order

1. HTTP status is an integer from 100 to 599. Anything else is `malformed_response`.
2. Status 401 or 403 is `unauthorized`.
3. Status 500–599 is `unexpected_provider_behavior`. Quota text is not read.
4. Read `x-ratelimit-requests-remaining` by exact name, case-insensitive, own data property only. Ignore `x-ratelimit-remaining` and every other header name.
5. Header result is one of `absent`, `exhausted`, or `malformed`:
   - The header is `absent` when it is not an own property, and when the headers object itself is missing.
   - Trim a string before classifying it. Numeric `0`, and a trimmed string of one or more `0` digits, are `exhausted`. `" 00 "` is exhausted.
   - A positive safe integer is `available`. A trimmed string matching `^[1-9][0-9]*$` whose integer form is a safe integer is `available`. `" 15 "` is available. `available` does not stop the run and is not `malformed`. This is the same trim-then-classify rule as `parseQuotaRemaining` in `probe-runner.ts`.
   - Every other present value, including `"0.0"`, `"01"`, negatives, non-integers, empty string, objects, and accessors, is `malformed`.
   - If any matching own property is `malformed`, the header result is `malformed` immediately.
   - If none is `malformed` and any is `exhausted`, the header result is `exhausted`.
   - Otherwise the header result is `absent`.
6. If the header result is `exhausted`, stop with `quota_exhausted`.
7. Then read daily phrases in `message`, `error`, and `errors`. The phrases `request limit for the day` and `daily request quota` are `quota_exhausted`. A lone `quota` is not. If reading those fields throws, status 429 is `rate_limited` and any other status is `unexpected_provider_behavior`.
8. If a daily phrase matched, stop with `quota_exhausted`.
9. If the header result is `malformed`, stop with `malformed_response`.
10. Status 429 is `rate_limited`.
11. Any status other than 200 is `malformed_response`.
12. Success requires an own `errors` value that is an array of length 0. A missing `errors`, an object, a string, or a non-empty array is `malformed_response`.
13. `results` is a non-negative safe integer and equals `response.length`. `response` is an array.
14. Paging `current` and `total` are own data properties of a plain non-proxy object, both the integer 1. Anything else is `malformed_response` or `unexpected_pagination`. No second page is requested.
15. Own `get` must be a string equal to the request path after removing one leading slash. A missing or different `get` is `malformed_response`.
16. Own `parameters.fixture` must be present and must match the canonical requested id. A missing echo is `fixture_id_mismatch`. `null`, objects, accessors, and inherited values are `malformed_response`. A present value that does not canonicalize to the requested id is `fixture_id_mismatch`.
17. Every response element and nested object described above must pass the proxy and accessor rules.
18. When a row has an own `fixture` object, its own `id` must canonicalize to the requested id. A contradictory id rejects the whole body. An omitted row id does not get the requested id copied in. The whole response is `identity_incomplete`: raw bytes may be stored, and no normalized evidence row is written.

### Intentional differences from PE-5.3D

Header steps 4–10 follow `interpretResponse` in `probe-runner.ts`: exhaustion stops before body text, body text stops before a malformed header, and a positive canonical remaining count does not stop. These live rules are stricter than the probe and are not claimed to be the probe:

- A missing `parameters.fixture` is `fixture_id_mismatch`. The probe treats omission as unverified coverage.
- A missing `get` is `malformed_response`. The probe allows a null or empty `get`.
- A proxy row rejects the whole body. The probe can skip that row and still count it.
- An `identity_incomplete` body writes no normalized evidence row.
- Empty observations are classified as `missing`. The probe calls the classifier with `present`.

The product `parseInt` circuit is not used.

### `observedValue`

`absenceMeansAvailable` is stored as false on every row. `availabilityInference` is stored as `forbidden` on every row. A later reader that sees `targetPrematchEligible: true` still does not have a proof that unnamed players are available. This boundary does not write a model feature. PE-5.2 remains the classifier: a present zero can be eligible under that contract, and this design does not change that result. It stores the prohibition beside it.

| Body | Observation | `observedValue` | Other counts | Classifier input |
|---|---|---|---|---|
| Lineups, `response.length` is 0 and `results` is 0 | `missing` | `null` | `startXiCount` and `substituteCount` are `null`, not 0 | `missing` and `null` |
| Lineups, one or more lineup objects | `present` | Count of `startXI` entries whose player id is canonical | `startXiCount` is that same count. Empty lists on a present object yield `0`. | `present` and that count, including `0` |
| Injuries, `response.length` is 0 and `results` is 0 | `missing` | `null` | `injuryRecordCount` is `null`, not 0 | `missing` and `null` |
| Injuries, one or more records | `present` | `response.length`, the count of injury records returned | `injuryRecordCount` is that length | `present` and that length |

A missing observation paired with `0` is not sent to the classifier as a feature. The normalizer records `missing_coerced_to_zero` and writes no evidence feature. The expected classifier result for a true missing input remains `UNSUPPORTED_OR_UNAVAILABLE` / `missing_observation`.

An injury count is a count of rows the provider returned. It is not the number of players ruled out, and it is not a statement that everyone else is fit. A lineup `observedValue` of `0` means the returned object identified no canonical starters. It does not mean the squad is available.

## 6. Provenance and temporal integrity

### Raw-write sequence

This is the only sequence. The raw envelope is not rewritten, and it is not delayed until after classification.

1. `beginSend` has committed, and this caller observed that commit.
2. One socket runs, or it fails. Bytes that arrive are buffered in memory. No parse yet.
3. The raw store appends one envelope in a ledger transaction. The store sets `capturedAtUtc` from the ledger clock at the moment that append commits. A timestamp supplied by the worker, the normalizer, or the caller is ignored.
4. The store sets `captureTimestampVerified` true only when that ledger clock was written by the store in step 3. Otherwise it stores `capturedAtUtc: null` and `captureTimestampVerified: false`.
5. After the append acknowledgement is visible, the normalizer reads the envelope. It copies the clock fields. It has no input that can replace them.
6. The normalizer output and the classifier decision are later appends. They reference the raw id. They do not update the raw bytes or the clock.

If step 3 fails, the reservation stays `sending` or is marked `failed` without a refund. The next process must not rebuild the envelope from memory. The same `operationId` must not open another socket. The audit reason is `raw_missing`.

### Clock trust

The capture clock is the ledger clock at raw append. It is not kickoff, not product `fetchedAt`, not a cache expiry, and not the worker's wall clock. Worker clock skew cannot move `capturedAtUtc` earlier, because the worker's value is discarded.

If the ledger clock is unavailable, the append either fails closed with no envelope, or the store writes a null unverified clock. Both results forbid `prospective_snapshot`. A timestamp equal to either kickoff still fails inside the existing classifier as `capture_time_is_fixture_kickoff`.

`maxAgeMs` on the kill switch is independent of this clock. The unresolved number is how large a gap between `sendingCommittedAt` and the raw-append clock must be before the store records the clock as unverified. Until an approval sets `maxCaptureLagMs`, the store records `captureTimestampVerified: false` and a null capture time whenever it cannot complete the append under the ledger clock. That fails closed. It does not invent a time.

### Provenance passed to the classifier

| Envelope | Provenance |
|---|---|
| Store wrote a verified ledger clock, and the operation is a pre-kickoff snapshot | `prospective_snapshot` |
| Verified clock missing, or `captureTimestampVerified` is false | Do not call the classifier with `prospective_snapshot`. No prospective row. |
| Caller asks for `current_snapshot` on this transport | Refuse before classify. |
| Body with no raw envelope | Reject. Historical imports are not part of this path. |
| Season aggregate | Not requested. |

Historical vendor responses, product cache entries, and recorded fixture-client samples are not promoted to `PROSPECTIVE_PREMATCH_SNAPSHOT`.

### Cache

The PE-5 transport has no read-through cache and no stale-on-error path. It does not call `withApiFootballClientCache`, `readThroughNextDataCache`, or the shared product TTL cache. Product caches may continue to serve the UI. Those hits are not evidence rows. A cache hit must not receive a new `capturedAtUtc`.

### Temporal eligibility

Unchanged classifier rules. The capture instant must be strictly before the source kickoff and strictly before the target kickoff. Same-match realized lineups do not enter that match's prematch row. Equal kickoffs are excluded. Holdout checks use `classifyHoldoutForResearch` before `tryReserve`: provider season `2025` or a calendar-2025 kickoff denies with no reservation. The PE-5.3D string-prefix check is not the live holdout gate.

An accepted `PROSPECTIVE_PREMATCH_SNAPSHOT` is a classified observation. It is not a model feature, a weight, or a production expectation. Together with `availabilityInference: "forbidden"`, a retained zero is still not a claim that the rest of the squad is available.

## 7. Transport boundary

The evidence transport is a new component. `createApiFootballClient` stays the product client. This design does not reuse it. A future redesign of that client would be a separate document. Binding `deps.fetch` to `createApiFootballClient`, `withRetry`, or any wrapper that retries or follows redirects is a failed implementation, even if the source file does not import those modules.

### One attempt

For each operation:

1. `beginSend` must have returned a visible commit.
2. Open one `fetch` with `redirect: "manual"`, an `AbortController` timeout, and the credential header. The transport sets `redirect` on this call. It does not delegate the call to the product client.
3. On 3xx, do not read a `Location` target and do not issue another request. Outcome `redirect_rejected`. The row becomes `failed` and stays charged.
4. Do not loop on timeout, network error, or 5xx. The row becomes `failed` and stays charged.
5. The only query key is `fixture`. Do not add `page`, `team`, or `season`.
6. The remaining lease at `beginSend` must be greater than the timeout. Exact milliseconds are an approval field.

### Concurrency

The ledger occupancy rules are the ceiling. A process-local semaphore may be tighter than the ledger and must not be the authority. Two deployments share a ceiling only when they use the same `ledgerInstanceId`. A second id does not get a second ceiling from this authorizer.

### Errors

Thrown errors and stored error fields use a stable reason code and, when useful, the HTTP status integer. They do not include the exception message, the URL, the body, or player names.

### Offline double

`APEX_PE5_ACQUISITION_MODE=offline` binds a double that returns scripted bytes and records the init object passed to `fetch`, including `redirect`. The double is not `readPe53bOfflineFixture`. Tests inject it at the composition root. The public entry does not accept a caller-supplied fetcher. Unit tests do not enable a live factory.

## 8. Security and observability

### Credentials

- The secret is read only inside the transport, after authorization allows a pilot. Offline mode does not read it.
- It is not written to envelopes, audits, logs, reports, or `NEXT_PUBLIC_*` variables.
- Product UI processes do not receive a research credential when a dedicated key is used. That split is a pilot precondition, not a control this revision implements.
- PE-5.4C uses a fake secret and asserts it never appears in outputs.

### Least privilege

| Component | May | May not |
|---|---|---|
| Authorizer | Read mode, ledger kill switch, approval metadata, and protocol flags | Read the provider secret or raw bodies |
| Ledger | Insert and transition reservation rows, store the kill switch, stamp raw-append time | Call the network or classify evidence |
| Transport | Read the secret, open one socket after a visible `sending` commit, buffer bytes | Classify, follow redirects, or set `capturedAtUtc` |
| Raw store | Append bytes and stamp the ledger clock | Accept a client-supplied capture time |
| Normalizer | Parse buffered bytes and copy the sealed clock | Send network requests or replace the clock |
| Classifier | Existing pure function | I/O |
| Evidence log | Append normalized rows | Update, delete, or write a model feature |
| Product server | Existing product calls | Read the PE-5 evidence log or the research secret |

### Audit

Append-only rows for: authorization deny or allow (mode and ledger id only), kill-switch version observed, reserve, release, `sending` commit, consume, fail, normalizer outcome, and classifier reason. Audit rows omit bodies, player names, and secrets. The evidence log holds normalized observations. The raw store holds bytes. An audit row is still required to say that `sending` committed.

### Diagnostics

Safe diagnostics are reason codes, reservation ids, canonical fixture ids, status integers, and durations. A redaction test feeds a secret, a player name, and a body token into thrown errors and asserts they are absent from the audit, the evidence record, and the thrown reason.

### Emergency shutdown

1. Set the ledger kill record to `engaged`, or stop refreshing `updatedAt`. Both deny the next `tryReserve` and the next `beginSend`.
2. A row already in `sending` may finish the one socket whose commit this caller already observed. It must not `beginSend` again.
3. Shutdown does not delete raw envelopes or evidence rows, and it does not refund `sending`, `consumed`, or `failed`.
4. Product behavior is unchanged. This switch does not stop Match Center, Vision, or the lifecycle workflow.

There is no second enablement path through `PE53B_LIVE_PROVIDER_AUTHORIZED`. If that constant is true, authorization denies.

## 9. Failure-mode matrix

The reservation column says whether the daily and research ceilings stay charged. "Not reserved" means no row was committed.

| Failure | Trigger | Detection | Safe behavior | Evidence retained | Reservation | Offline test |
|---|---|---|---|---|---|---|
| Mode missing | Env unset | Authorizer | Deny | Audit deny | Not reserved | `mode-missing` |
| Protocol flag true | Any listed flag is true | Authorizer | Deny `protocol_flag_violation` | Audit deny | Not reserved | `protocol-flags` |
| Mode inconsistent with approval | Flags disagree | Authorizer | Deny | Audit deny | Not reserved | `approval-mismatch` |
| Approval expired | Ledger clock past expiry | Authorizer | Deny | Audit deny | Not reserved | `approval-expired` |
| Wrong ledger instance | Configured id differs | Authorizer | Deny. No second ledger budget | Audit deny | Not reserved | `two-ledgers` |
| Kill missing, stale, or engaged | Record unreadable, old, or not `clear` | Ledger read and `beginSend` predicate | No reserve, or no `sending` commit | Audit | Not reserved, or an existing `reserved` row stays charged until expiry or cancel | `kill-before-reserve`, `kill-before-send`, `kill-stale` |
| Kill changes in a running process | Ledger record updated after process start | `beginSend` reads the ledger, not `process.env` | Swap fails, no socket | Audit | `reserved` may later expire | `kill-while-running` |
| Kill after `sending` commits | Switch engages in the socket gap | Row already `sending` | That one observed socket may finish. No second attempt | Raw if bytes were stored | Stays charged | `kill-after-sending` |
| Ledger down before any insert | `tryReserve` errors and lookup finds no row | Authorizer or ledger | No socket. No insert | Audit | Not reserved | `ledger-down` |
| Reservation exists, ack lost | Insert committed, caller has no token | Lookup finds `reserved` | No second insert. No socket until that caller holds the token and `beginSend` is visible | Audit | Stays charged while `reserved` | `reserve-ack-lost` |
| `sending` committed, ack lost | Swap committed, this caller did not see it | Lookup finds `sending` | No socket from this caller. No resend | Audit | Stays charged | `send-ack-lost` |
| Sent, outcome unknown | Socket may have opened, no terminal outcome stored | Row still `sending` | No second socket. A later writer may mark `failed` / `outcome_unknown` without a refund | No invented envelope | Stays charged | `crash-after-sending` |
| Ledger down after a possible commit | Lookup times out or is ambiguous | Reconciliation | No insert and no socket. An existing row keeps its charge. Absence of a lookup result is not treated as absence of a row | Audit | Unchanged if a row exists. No new charge if insert is refused | `ledger-down-after-sending` |
| Same query, new purpose string | Caller changes purpose | `operationId` ignores purpose | Second insert denied | First row | One charge | `purpose-alias` |
| Equivalent path spellings | `/fixtures/lineups`, `fixtures/lineups`, and `//fixtures/lineups` | Ledger derives `canonicalPath` from `endpoint` | Second and third inserts denied | First row | One charge | `equivalent-path-identity` |
| Cross-process last unit | Two reserves, ceiling 1 | One insert | One `reserved`, one deny | Both audits | One charge | `quota-race` |
| Module re-evaluation | Second module copy | Ledger, not module memory | No fresh ceiling | Audit | Shared ceilings | `module-reeval` |
| Research ceiling reached | Charged PE-5 rows equal the ceiling, including `failed` | Occupancy | Deny | Audit | Not reserved | `research-cap-held` |
| Daily ceiling reached | Charged rows for that vendor day equal the ceiling, including `sending`, `consumed`, and `failed` | Occupancy | Deny | Audit | Not reserved | `daily-ceiling-held`, `sending-occupancy` |
| Vendor day unknown at send | Boundary or ledger clock missing | `beginSend` | No socket. Row stays `reserved` if it exists | Audit | Existing reserve stays charged until release | `vendor-day-unknown` |
| Send crosses the vendor day | `chargeDay` is yesterday, ledger now is today, new day has room | `beginSend` transaction | One rebind onto today and one `sending` commit | Audit | One daily charge, on the send day | `vendor-day-rollover` |
| Send crosses the vendor day and today is full | New day occupancy cannot hold the row | `beginSend` | No socket. No second operation | Audit | Stays `reserved` on the old day | `vendor-day-rollover` |
| Rate window full | Recent send-credit times fill the window, including completed sends | Occupancy | Deny. Do not sleep | Audit | Not reserved | `rate-window-held` |
| Crash before `beginSend` | Process dies in `reserved` | Lease | Sweeper expires and releases | Audit | Released | `crash-before-send` |
| Stale token after expiry | Late `beginSend` | Compare-and-swap | No socket | Audit | Already released | `stale-token` |
| Lease shorter than timeout | Remaining lease too small | `beginSend` | No socket | Audit | Stays `reserved` until expiry or cancel | `lease-too-short` |
| Crash after `sending` | Die before outcome | Row still `sending` | No second socket. Later `failed` / `outcome_unknown` | No invented envelope | Stays charged | `crash-after-sending` |
| Restart | New process | Ledger rows remain | New work reserves or reconciles | Prior rows | Charged rows remain | `restart-holds` |
| Timeout | AbortController | Transport | Stop. No retry | Raw only if append committed | `failed`, charged | `timeout-no-retry` |
| Redirect | HTTP 3xx | Status and fetch init | Do not follow. Init contains `redirect: "manual"` | Status only | `failed`, charged | `redirect-manual` |
| Product client used as fetch | `deps.fetch` is the product client | Test rejects that binding | No retry wrapper | None | None | `fetch-not-product-client` |
| Extra page | `paging.total` is not 1 | Normalizer | No second request | Raw bytes | `failed`, charged | `no-page-two` |
| Positive quota header | Remaining `15`, `"15"`, or `" 15 "` | Header step | Not malformed and not exhausted | Eligible to continue other checks | Unchanged | `quota-positive` |
| Zero quota header | `0`, `"0"`, `"00"`, or `" 00 "` | Header step | `quota_exhausted` before a success body is accepted | Raw bytes | `failed`, charged | `quota-zero` |
| Malformed quota header | `"0.0"`, `"01"`, accessor | Header step | `malformed_response` after body-phrase check | Raw bytes | `failed`, charged | `quota-malformed` |
| HTTP 500 with quota text | Status 500 and a daily phrase | Status first | `unexpected_provider_behavior` | Raw bytes | `failed`, charged | `http-500` |
| Omitted fixture echo | No own `parameters.fixture` | Normalizer | No normalized row | Raw bytes, `fixture_id_mismatch` | `failed`, charged | `echo-omitted` |
| Contradictory echo | Different canonical id, including a nested row id while `parameters.fixture` matches | Normalizer | No normalized row | Raw bytes | `failed`, charged | `echo-mismatch`, `nested-fixture-contradiction` |
| Bad `get` | Missing or different path | Normalizer | `malformed_response` | Raw bytes | `failed`, charged | `get-path` |
| Non-array `errors` | Object or missing | Normalizer | `malformed_response` | Raw bytes | `failed`, charged | `errors-shape` |
| Inherited or accessor id | Prototype or getter | Own-property read | `malformed_response`. Getter count is 0 | Raw bytes | `failed`, charged | `echo-accessor` |
| Proxy row or nested proxy | `types.isProxy` | Walk | Reject whole body. Do not count | Raw bytes | `failed`, charged | `proxy-row`, `proxy-nested` |
| Empty body | `results` is 0 | Normalizer | `missing`, null counts, classifier sees `missing` | Normalized missing row | `consumed`, charged | `missing-not-zero` |
| Present zero | Lineup object with no canonical starters | Normalizer | `present`, `observedValue` 0, `availabilityInference` `forbidden` | Normalized row plus classifier decision | `consumed`, charged | `present-zero` |
| Missing coerced to zero | Normalizer would pass 0 for missing | Local reject | No feature row | Rejection record | Charged if bytes were sent | `coerce-zero` |
| Clock supplied by caller | Worker sends a timestamp | Store | Stored clock is the ledger clock or null | Envelope | Charged | `clock-sealed` |
| Clock equals kickoff | Same timestamp | Classifier | `capture_time_is_fixture_kickoff`. Not eligible | Decision row | Charged | `clock-eq-kickoff` |
| Untrusted clock | Ledger clock unavailable | Store | Null clock, no `prospective_snapshot` | Raw bytes if append committed | Charged | `clock-untrusted` |
| Body with no envelope | Caller label `prospective_snapshot` | Store | Reject before classify | None | Unchanged | `no-promote-history` |
| 2025 season or calendar kickoff | Holdout classifier | Before `tryReserve` | No reserve | Audit `holdout_rejected` | Not reserved | `holdout-2025` |
| Duplicate operation | Same `operationId` | Ledger | No second socket | First envelope | No second charge | `idempotent-duplicate` |
| Partial persist | Append fails after a 200 | Store error | No synthesized envelope. No resend | Audit `raw_missing` | Stays charged | `partial-persist` |
| Secret in thrown text | Key or player name in an error | Redaction | Reason code only | Audit without the token | `failed`, charged | `redaction` |
| Sealed path read | Frozen prefix or a 2025 outcome file | Path guard before any read | Throw. Error text has no file contents | Audit path class only | Not reserved | `holdout-path` |
| Product import | Evidence module imports the product client or PE-4 live transport | Source test | Fail the suite | None | None | `no-product-client` |
| Cross-consumer spend | Fake product spender and PE-5 share a ceiling | Ledger occupancy | The product fake's charged rows reduce what PE-5 can reserve | Audit | Shared charge | `cross-consumer` |
| Unauthorized pilot | Mode `pilot` | Authorizer | Deny `pilot_not_authorized` | Audit | Not reserved | `pilot-not-authorized` |

## 10. Implementation boundaries

Proposed interfaces for a future PE-5.4C. They are not code in this phase.

```text
evaluateAuthorization(env, approval, ledger, protocolFlags, now) ->
  { decision: "deny", reason }
  | { decision: "allow-offline" }

readKillSwitch(ledger) ->
  { state: "clear", version, updatedAt }
  | { state: "engaged" | "unreadable" }

tryReserve(ledger, input) ->
  { ok: true, reservationId, fencingToken }
  | { ok: false, reason: "denied" | "unavailable" | "ambiguous", existing }

beginSend(ledger, reservationId, fencingToken) ->
  { ok: true, sendToken, sendingCommittedAt }
  | { ok: false, reason: "denied" | "unavailable" | "ambiguous" }

fetchOnce(sendCommit, request, deps) ->
  { sent: false, reason }
  | { sent: true, status, bodyBytes }
  // Called only with a visible sendCommit.
  // deps.fetch is the offline double. It is not createApiFootballClient.

appendRaw(store, reservationId, sendToken, status, bodyBytes) ->
  { ok: true, envelopeId, capturedAtUtc, captureTimestampVerified }
  | { ok: false, reason: "raw_missing" }
  // Store sets the clock. Arguments contain no capture timestamp.

normalize(envelope) -> { ok: true, observation } | { ok: false, reason }
  // Copies envelope.capturedAtUtc. No clock argument.

classifyPe5Evidence(input)   // existing function, unchanged

appendEvidence(store, record) -> ack
```

Composition for PE-5.4C wires `allow-offline` to an in-memory ledger that still enforces one instance id, the occupancy rules, and the compare-and-swap. It does not read `API_FOOTBALL_KEY`. The offline test injects `deps` from the test composition root only.

### Reuse

| Existing piece | Use |
|---|---|
| `classifyPe5Evidence` | Unchanged, with the stored observation and the sealed clock |
| `classifyHoldoutForResearch` | Before `tryReserve` |
| PE-5.3D header order and positive-integer rule | Header steps in section 5. Do not import the probe runner if that import pulls in the fixture reader |
| PE-5.2 UTC timestamp rules inside the classifier | Applied to the store-stamped clock |
| Adversarial style of `pe5.probe-runner.test.ts` | Model for the new tests |

### Do not reuse as the evidence path

| Existing piece | Reason |
|---|---|
| `createModuleDispatchBudget` | One module evaluation, and it refills on the next evaluation |
| `readPe53bOfflineFixture` | Empty body and manufactured echo |
| `authorizePe53bLiveProvider` and `PE53B_LIVE_CONFIRMATION` | Always deny, and the confirmation string is in source |
| `createApiFootballClient` / `withApiFootballClientCache` | Retries, waiting limiter, cache, stale fallback |
| `quota-circuit.ts` header parsing | `parseInt` disagrees with PE-5.3D |
| `getSharedApiFootballRateLimiter` | Process-local wait |
| Match Center `enrich.ts`, Vision coordinator, lifecycle transport | Outside this ledger. PE-5.4C must not edit them |
| PE-4 `createPe4I2LiveTransportFromClient` | Different endpoints, frozen research |
| `writesAttempted` | Constant zero, not an audit |
| `assertPe53bResearchPathUntouched` as a security boundary | It uses substring matching and can fire on an unrelated file name |

### New components

Authorizer, ledger kill record, quota ledger, evidence transport, raw store, normalizer, evidence log, audit log, and the offline test doubles. PE-5.4C places them in a new directory whose path does not contain the frozen substrings in `probe-fixtures.ts`. It must not add files under the PE-3, PE-4, or PE-5.2 modules.

## 11. Adversarial acceptance tests

These tests are specified here and are not implemented. They run with an injected fetch double and an in-memory ledger that can simulate more than one process. They fail if the double records a forbidden call. They do not read the network, `.env`, or sealed files. A green run is a future PE-5.4C result. It is not a live-provider approval.

| Test | Setup | Pass condition |
|---|---|---|
| `mode-missing` | `APEX_PE5_ACQUISITION_MODE` unset | Deny. No reserve. `fetch` count is 0 |
| `approval-mismatch` | Mode is `offline` and the approval record says `pilot` | Deny `approval_inconsistent`. No reserve |
| `approval-expired` | Ledger clock is past the approval expiry | Deny. No reserve. No `fetch` |
| `daily-ceiling-held` | Five rows already `consumed` or `failed` on today's `chargeDay`, ceiling 5 | The sixth `tryReserve` is denied. No `fetch` |
| `sending-occupancy` | Five rows are `sending` on today's vendor day, ceiling 5 | The sixth `tryReserve` is denied. Moving a row from `sending` to `failed` does not free the slot |
| `research-cap-held` | Research ceiling filled with `failed` PE-5 rows for this approval | The next PE-5 reserve is denied. Completing a row does not free a slot |
| `rate-window-held` | Completed sends whose `sendingCommittedAt` is still inside `rateWindowMs` fill the rate ceiling | The next reserve is denied. No sleep. Aging the ledger clock past the window allows one new reserve |
| `two-ledgers` | Approval names ledger A. The process is configured with ledger B | Deny `ledger_instance_mismatch`. Ledger B occupancy stays 0. No `fetch` |
| `quota-race` | Two simulated processes, one remaining daily unit | Exactly one `reserved`. Exactly one later `fetch` if that winner also commits `sending` |
| `module-reeval` | Fill the research ceiling, then evaluate a second copy of the module | The second copy does not get a new ceiling |
| `cross-consumer` | A fake product spender inserts one charged row on the same credential and day | PE-5 occupancy sees that row. A ceiling of 1 denies the PE-5 reserve |
| `stale-token` | Reserve, pass `leaseDeadline`, sweeper expires, then `beginSend` with the old token | No `sending` row. `fetch` count is 0 |
| `lease-too-short` | Remaining lease is less than or equal to the timeout | `beginSend` fails. `fetch` count is 0 |
| `crash-before-send` | Die in `reserved` | Sweeper releases. Charge is gone. Old token cannot send |
| `restart-holds` | Commit one `sending` row, then start a new process with empty memory | The new process sees the charged row. A repeat `operationId` does not `fetch` again |
| `crash-after-sending` | Commit `sending`, then die before the socket returns | No second `fetch`. Row stays charged as `sending` or `failed` / `outcome_unknown` |
| `reserve-ack-lost` | Insert commits, caller does not receive the token | Lookup finds the row. No `fetch`. No second insert |
| `send-ack-lost` | `beginSend` commits, caller does not see it | No `fetch`. Charge remains. A purpose-alias retry does not insert |
| `purpose-alias` | Two reserves that differ only by a purpose string | One `operationId`. One charge. `fetch` count is at most 1 |
| `equivalent-path-identity` | Caller paths `/fixtures/lineups`, `fixtures/lineups`, and `//fixtures/lineups` for endpoint `lineups`, same fixture and approval | One `operationId`. The second and third calls do not insert. `fetch` count is at most 1 |
| `vendor-day-unknown` | Approval has no vendor-day boundary | `beginSend` fails. `fetch` count is 0. An existing `reserved` row stays charged |
| `vendor-day-rollover` | Two rows reserved on vendor day 1. Ledger clock moves to day 2 before `beginSend`. Day 2 ceiling is 1. Worker clocks are set an hour off the ledger | Exactly one row rebinds to day 2 and may `fetch` once. The other stays `reserved` on day 1 with no `fetch`. Neither day shows two charges for one row. Research occupancy stays two rows, not four |
| `kill-before-reserve` | Switch `engaged` | `fetch` count is 0 |
| `kill-before-send` | `reserved`, then switch `engaged`, then `beginSend` | Swap fails. `fetch` count is 0 |
| `kill-stale` | `state` is `clear` and `updatedAt` is older than `maxAgeMs` | Deny. `fetch` count is 0 |
| `kill-while-running` | Process already started. Ledger record changes to `engaged` without changing `process.env` | The next `beginSend` fails |
| `kill-after-sending` | Switch engages after a visible `sending` commit | At most one `fetch`. No retry |
| `timeout-no-retry` | Scripted timeout after a visible `sending` commit | `fetch` count is 1. The row is `failed` and still charged |
| `redirect-manual` | Scripted 302 | The recorded init has `redirect: "manual"`. `fetch` count is 1. Location host is absent from audits |
| `fetch-not-product-client` | Attempt to bind the product client as `deps.fetch` | The composition root rejects it. A retrying wrapper is not called |
| `no-page-two` | `paging.total` is 2 and the body includes a next URL | `fetch` count is 1. Outcome is `unexpected_pagination`. The next URL is not requested |
| `quota-positive` | Header `15`, `"15"`, and `" 15 "` on HTTP 200 with an otherwise valid body | Not `malformed_response` and not `quota_exhausted` |
| `quota-zero` | `0`, `"0"`, `"00"`, and `" 00 "` | `quota_exhausted` |
| `quota-malformed` | `"0.0"`, `"01"`, accessor | `malformed_response`, and the accessor is not invoked |
| `http-500` | Status 500 plus a daily phrase | `unexpected_provider_behavior` |
| `echo-omitted` | No own `parameters.fixture` | No normalized row |
| `echo-mismatch` | `parameters.fixture` differs from the requested id | No normalized row |
| `nested-fixture-contradiction` | `parameters.fixture` matches the requested id and one response row has a different own `fixture.id` | No normalized row. `fetch` count is 1 |
| `get-path` | `get` missing or not the request path | `malformed_response` |
| `errors-shape` | `errors` is an object | `malformed_response` |
| `echo-accessor` | Inherited id and a throwing getter | `malformed_response`. Getter count is 0 |
| `proxy-row` | Proxy row whose id differs | Whole body rejected. Row is not counted |
| `proxy-nested` | Plain row with a proxy `player` or `fixture` | Whole body rejected |
| `missing-not-zero` | Empty `response` | Observation `missing`, observed value null, counters null, classifier reason `missing_observation` |
| `present-zero` | Present lineup object, no canonical starters | Observation `present`, observed value 0, `availabilityInference` is `forbidden` |
| `coerce-zero` | Missing observation with value 0 | No feature row |
| `clock-sealed` | Worker supplies a capture time earlier than kickoff | Stored `capturedAtUtc` is the ledger time or null, never the supplied time |
| `clock-eq-kickoff` | Sealed clock equals kickoff | Not `targetPrematchEligible` |
| `clock-untrusted` | Ledger clock cannot be stamped | No `prospective_snapshot` |
| `no-promote-history` | Body with no envelope, caller label `prospective_snapshot` | Rejected before classify |
| `idempotent-duplicate` | Two calls, one `operationId`, first envelope exists | `fetch` count is 1 |
| `partial-persist` | Raw append fails after a scripted 200 | No synthesized envelope. `fetch` count stays 1 |
| `redaction` | Secret, player name, and body token in the error | Those strings are absent from audit, evidence, and the thrown reason |
| `holdout-2025` | Season `2025` or a calendar-2025 kickoff | No reserve and no `fetch` |
| `holdout-path` | Path under the frozen prefixes | No file contents in the error |
| `no-product-client` | Read the new module sources | They do not import `createApiFootballClient`, `withApiFootballClientCache`, the lifecycle runner, or PE-4 live transport |
| `protocol-flags` | Any required flag set true | Deny `protocol_flag_violation` |
| `pilot-not-authorized` | Mode `pilot` with a well-formed approval | Deny `pilot_not_authorized` |
| `ledger-down` | `tryReserve` throws or times out and lookup finds no row | No insert. `fetch` count is 0. No charge |
| `ledger-down-after-sending` | A `sending` row exists, then lookup times out | No second insert. `fetch` count stays 0 for the caller that did not already observe the commit. The existing row stays charged |

## 12. Stage gates

### Corrected PE-5.4B documentation

**GO** only when an independent reviewer agrees that all of the following are true in this text:

- One occupancy definition is used in the state table, `tryReserve`, `beginSend`, the failure matrix, and the tests. Rows in `sending`, `consumed`, and `failed` stay inside the daily ceiling and the research ceiling. A send is charged on the vendor day of the `beginSend` commit, or it does not happen.
- `operationId` uses the fixed paths `fixtures/lineups` and `injuries`. Purpose strings and path spellings do not create a second id. `approvalId` and `generation` come from the ledger.
- A ledger lookup failure does not clear an existing charge and does not insert a replacement row.
- A worker whose lease has expired cannot move a row to `sending`, and the sweeper cannot release a row that is already `sending`.
- Lost acknowledgements are reconciled by `operationId` lookup, and a purpose string cannot create a second charge.
- The kill switch is a fresh ledger record checked inside `beginSend`. The listed protocol flags are deny inputs at authorization and `tryReserve`. They are not read again inside that send transaction.
- Positive, zero, malformed, and absent quota headers follow the order in section 5, including the intentional stricter identity rules.
- The raw store stamps the capture clock, and the normalizer cannot replace it.
- Missing data and a present zero both store `availabilityInference: "forbidden"`.
- Section 11 names the tests that enforce those rules.
- No sentence treats design acceptance as permission to call API-Football.

**NO-GO** if completed requests can replenish the daily ceiling, if a stale token can send after lease expiration, if the document edits application code, or if the baseline moved.

Accepting this review authorizes nothing except a possible later request to start PE-5.4C.

### Future offline PE-5.4C implementation

**GO to start** only under a new user authorization, and only to add the new modules and the tests in section 11, using fakes.

**NO-GO to merge** if the change touches product clients, lifecycle, PE-4, PE-5.2 semantics, workflows, flags, or sealed data; if `fetch` is invoked outside the injected double; if `pilot` can send; if any section 11 test is absent; or if a finished request frees a daily or research slot.

PE-5.4C remains NO-GO for live requests even when every offline test passes.

### Independent implementation audit

**GO** only after PE-5.4C exists and a reviewer who did not write it repeats the section 11 cases, inspects the compare-and-swap, and confirms the product client is not on the evidence path.

**NO-GO** if that audit finds a second budget, a refund of `consumed` or `failed`, a send after lease expiry, a redirect follow, a proxy skip, a missing-as-zero feature, a classifier call that disagrees with the stored observation, a caller-supplied capture clock that was stored, or a path that reads sealed 2025 files.

### Future explicitly authorized live pilot

**GO to plan** only under another explicit user authorization, after the implementation audit is GO, and after the credential rule in section 4 is satisfied.

**NO-GO**, regardless of offline tests and regardless of this revision, until that authorization exists. This design review is not that authorization. PE-5.4C passing is not that authorization. Setting `APEX_PE5_ACQUISITION_MODE=pilot` is not that authorization.

## Unresolved operational decisions

These values are unspecified on purpose. Behavior when they are missing is deny or fail closed, which is specified. A pilot cannot start while they are unset. An offline fake may use test values.

| Decision | Specified failure if missing | Still unset |
|---|---|---|
| Ledger technology | Must provide one instance id, the ledger clock, and one serializable transaction, or an equivalently proven atomic mechanism, that together reads all relevant charged occupancy, enforces the destination vendor-day ceiling, updates the reservation row, and enters `sending`. That mechanism must stop concurrent workers from both consuming the last available slot. A per-row compare-and-swap alone is insufficient. Not `globalThis` and not the product cache | Which database or file |
| Dedicated credential versus a later product change | Pilot is NO-GO until one option is shown | Which option |
| Daily ceiling, research ceiling, rate ceiling | `tryReserve` denies | The integers in a future approval |
| `rateWindowMs`, lease length, fetch timeout, `maxAgeMs`, `maxCaptureLagMs` | Deny or unverified clock, as specified above | The durations |
| Vendor day boundary | `beginSend` fails with `vendor_day_unknown` until the approval stores a boundary the ledger can apply | The timezone and the reset instant. The rebind rule itself is specified |
| Secret storage | Offline mode does not read a real key | The manager used in a future pilot |
| Who refreshes the kill record | A stale record denies | The operator or job |
| Attested empty lists | They stay `missing` under frozen PE-5.2 | Whether a later protocol version adds a class. Out of scope |

## Statement

PE-5.4B-R2 is a design correction. The repository's live acquisition switch remains off. `pe53Authorized` remains false. No component described here is implemented, and none is authorized to contact API-Football.
