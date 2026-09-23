# PE-3 C0 Live Acceptance Runbook

Operator checklist for closing PE-3 with one legitimate controlled live C0 ticket.

**Safety:** Do not flip `PE3C_C0_RECON_ACTIVATION`. Do not change the GitHub Actions workflow. Do not delete durable tickets. Do not fabricate fixtures, widen T-120, or add leagues to force a pass.

## Prerequisites

- Allowlisted competition already configured for lifecycle.
- Controlled smoke CLI available: `npm run lifecycle:prematch:c0-smoke`
- Read-only verifier available: `npm run lifecycle:verify-c0-acceptance`
- Dual acknowledgements required for smoke:
  - `--enable-c0-recon-smoke`
  - `--confirm-production-write`

## Procedure

1. **Wait** for a legitimate T-120 eligible fixture (NS, allowlisted, kickoff within the canonical capture window). Do not invent eligibility.

2. **Control the BASE scheduler race** before smoke. Scheduled `lifecycle:prematch` can first-write a BASE ticket for the same fixture. Options:
   - Temporarily disable the prematch lifecycle workflow in GitHub UI, **or**
   - Temporarily clear/empty `APEX_LIFECYCLE_LEAGUE_IDS` (fail closed → no capture),
   - then restore immediately after step 10.
   - A Cloudflare watchdog or other external dispatcher must also be paused if it can trigger the same workflow during the window.

3. **Confirm durable-missing** for the target fixture (no existing prematch decision ticket). If BASE already captured it, **that fixture is not a valid C0 acceptance target**. Do not delete the existing ticket to coerce a pass — choose another opportunity.

4. **Run the dual-ack C0 smoke** (forces `maxNewTicketsPerRun=1`):

```bash
npm run lifecycle:prematch:c0-smoke -- --enable-c0-recon-smoke --confirm-production-write
```

5. **Save the sanitized runner JSON** from stdout (mode counters, regime, season-universe request counts). Do not capture secrets from the environment.

6. **Run the read-only verifier** for the created fixture:

```bash
npm run lifecycle:verify-c0-acceptance -- --fixture-id <FIXTURE_ID>
```

7. **Require verifier PASS** (`PE3_C0_LIVE_ACCEPTANCE=PASS`). Pure base_prior / both-sides fallback tickets are FAIL for PE-3 closure even if a C0 ticket exists.

8. **Re-run the same dual-ack smoke** to prove first-write-wins / idempotency (expect no overwrite; created count 0 or idempotent/already-ticketed behavior).

9. **Confirm ticket identity and provenance unchanged** (same `ticketId`, same `acceptedEvidenceDigest`, same Elo sides) via a second verifier run or durable read.

10. **Restore BASE scheduler configuration immediately** (re-enable workflow / restore allowlist / resume watchdog).

11. **Confirm** `PE3C_C0_RECON_ACTIVATION` remains `false` in `lib/prematch-lifecycle/pe3-activation.ts`.

12. **Confirm** `.github/workflows/apex-prematch-lifecycle.yml` still invokes only `npm run lifecycle:prematch` (BASE path), not the C0 smoke script.

## Closure note

Healthy smoke no-ops (no eligible fixture) do **not** close PE-3.  
PE-3 closes only after verifier PASS on a team-specific catalogue-discriminating C0 ticket.
