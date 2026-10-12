# PE-5.2 — Offline Evidence-Class Protocol

PE-5.2 classifies squad evidence. It does not acquire it, store it, or fit it.

**Base HEAD:** `f522634593ea5f0a9a8a0b978020852a90f05952` (`main`)
**Parent audit:** PE-5.1 strategic feasibility audit
**Status:** PE-5.2R remediation of the first closure audit. A new independent closure audit has not been run.
**Pinned PE-4I.21 contract digest:** `f204eca3f3851af8d0c276fb09c81e7d99c39bc7873d1cd8963cad9a74dcd76c`
**PE-5.2 protocol digest:** `b9598e27d654177ed322e6db671842b2c6c2378e9450be11e7ecc66727f1cbd9`

`digestPe5Protocol()` is the SHA-256 of `JSON.stringify(pe5Protocol())`. That object is protocol metadata: version, flags, class names, and kind lists. The digest does not cover `evidence-class.ts` or the test file, and it does not guarantee that the classifier is unchanged.

PE-4 stays closed. Production expectation stays unavailable. C0 stays off. G1 stays at k=10. PE-5.3, PE-6, and PE-7 are not started.

## Frozen boundaries

- No provider, HTTP, database, Supabase, or Cloudflare calls.
- No historical backfill and no prospective collector.
- No artifact writer and no dataset mutation.
- No fitting, calibration, weights, odds, EV, or coefficient tuning.
- Calendar-2025 kickoffs and provider season 2025 stay excluded. This protocol does not read sealed 2025 outcomes.
- `PE5_PRODUCTION_WIRING = false`. `PE4I21_PRODUCTION_WIRING` stays false.
- The PE-4I.21 digest above is a pin. PE-5.2 does not recompute the contract by rewriting PE-4 files.

## Evidence classes

| Class | Meaning | Target pre-match row | Later-target history |
|---|---|---|---|
| `PROSPECTIVE_PREMATCH_SNAPSHOT` | Attested capture clock strictly before the source kickoff and strictly before the target kickoff | Only when the source fixture is the target | When the source fixture is an earlier match |
| `REALIZED_MATCHDAY_HISTORY` | Recorded matchday evidence from an earlier fixture | Never | When `kickoff(source) < kickoff(target)` |
| `CURRENT_SNAPSHOT_UNPROVEN` | A live snapshot with no attested historical capture clock | Never | Never |
| `SAME_MATCH_OR_POST_MATCH_EXCLUDED` | Same fixture, same kickoff, or information at/after the relevant kickoff | Never | Never |
| `UNSUPPORTED_OR_UNAVAILABLE` | Family, season aggregate, or missing observation this protocol will not turn into a feature | Never | Never |

Prospective kinds: injuries, suspensions, confirmed starting XI, bench availability, goalkeeper availability.

Realized kinds: those five, plus per-match rotation minutes.

Unsupported kinds: expected starting XI, player importance, international duty, travel absence, coach or manager changes.

## Temporal rules

1. A prospective row needs `captureTimestampVerified === true` and a UTC timestamp. Accepted spellings are `YYYY-MM-DDTHH:mm:ssZ` and the same form with one, two, or three fractional digits. A non-boolean attestation (`"yes"`, `1`, `{}`, `null`, `undefined`) fails closed.
2. The parsed instant must round-trip to the supplied UTC year, month, day, hour, minute, second, and milliseconds. `2024-02-31`, `2024-08-17T24:00:00Z`, and non-leap `2023-02-29` fail closed as capture times and as kickoffs. `2024-02-29` remains valid. The PE-4 timestamp parser is not used for this check.
3. That clock must be strictly earlier than the source kickoff and strictly earlier than the target kickoff.
4. A timestamp equal to either kickoff is a fixture time, not a capture time.
5. Realized evidence of the target fixture cannot enter that fixture's pre-match row. Marking it verified does not promote it.
6. History from another fixture is eligible only when its kickoff is strictly earlier. Equal kickoffs are excluded, including two different fixture ids.
7. The same fixture id with two different kickoffs is ambiguous and fails closed.
8. A current snapshot stays unproven when its clock is merely earlier than kickoff. Setting the verified flag on a current or realized row is ambiguous.
9. Season-aggregate minutes, appearances, or an `injured` flag are not pre-match observations.
10. Prospective rotation minutes are ambiguous: minutes are known after the match.

## Missingness

`observation: "missing"` stays unavailable. `numericValue` is always null. `zeroFilled` is false.

A missing observation paired with `0` fails closed as coercion. A present observation may retain a raw zero. That retained zero is the observed count, not a filled missing value. Rejected rows retain nothing.

A present negative count is retained as supplied. A present observation with a null count stays eligible and retains null. Neither path writes zero. This protocol does not add a numeric domain check.

## Holdout

Targets and sources fail closed when `classifyHoldoutForResearch` reports provider season 2025 or a calendar-2025 kickoff. Synthetic identifiers in the tests are not sealed outcome rows. Unknown or non-UTC kickoffs fail closed as malformed timestamps.

## Modules

| File | Role |
|---|---|
| `protocol.ts` | Version, pins, class lists, `productionWiring: false` |
| `evidence-class.ts` | Pure classifier |
| `pe5.evidence-class.test.ts` | In-memory boundaries and production isolation |

There is no writer and no `data/calibration` directory for PE-5.2.

## Validation

```bash
npx vitest run lib/debug/calibration/pe5-availability/pe5.evidence-class.test.ts
npx tsc --noEmit
npx eslint lib/debug/calibration/pe5-availability/protocol.ts lib/debug/calibration/pe5-availability/evidence-class.ts lib/debug/calibration/pe5-availability/pe5.evidence-class.test.ts
```

## Limitations

- `captureTimestampVerified === true` is still a caller attestation. This protocol cannot prove a future collector set it from a real clock.
- `digestPe5Protocol()` pins protocol metadata only. It does not freeze the classifier source.
- Historical lineup and injury retention on API-Football is still unmeasured. PE-5.3 is a separate authorization.
- Player-level suspension rules are not encoded.
- Eligible rows retain a raw observation. They do not emit a model feature, a coefficient, or a join onto the PE-4 matrix.
