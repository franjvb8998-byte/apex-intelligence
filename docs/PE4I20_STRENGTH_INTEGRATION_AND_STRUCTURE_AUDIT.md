# PE-4I.20 — Strength-integrated DEV dataset and renewed structural audit

PE-4I.20 is an offline, research-only extension of PE-4I.17–19. It adds the
PE-4I.19 common-baseline opponent-strength join to the unchanged PE-4I.17 DEV
population, then repeats a PE-4I.18-style structural audit without reading
outcome labels.

## Frozen boundaries

- No provider, HTTP, database, Supabase, or Cloudflare calls.
- No fitting, calibration, weights, odds, EV, or outcome-driven selection.
- Calendar-2025 and provider-season-2025 exclusions remain independent.
- AET/PEN targets remain excluded; ambiguous evidence metadata remains visible.
- Common-baseline reconstruction base is 1580 and is not comparable to
  venue-specific C0 Elo.
- `PE4I20_PRODUCTION_WIRING=false`; no C0/G1, lifecycle, scheduler, or frozen
  protocol wiring changes.

## Temporal contract

For target T and every selected history match M:

1. `kickoff(M) < kickoff(T)`.
2. The joined opponent strength cutoff equals `kickoff(M)`.
3. Strength reconstruction uses only fixtures strictly before M.

The join key is `(opponentTeamId, kickoffM)`. A complete join requires every
selected history row and at least three observations. Any missing or invalid
key makes only the opponent-strength family `UNAVAILABLE`; the dataset record
is retained.

Unavailable strength is represented by a null mean, explicit reason, matched
and missing counts, and sorted missing keys. PE-4I.20 never uses zero, 1580, or
a partial mean as a missing-value substitute.

## Conflict lineage

The pinned ledger contains eight ambiguous team/kickoff keys, representing 16
DEV team-perspective source misses. PE-4I.19 removes those keys. PE-4I.20
requires the same 8/16 counts before the canonical corpus runner can proceed.

## Population and xG

The accepted corpus remains:

- 969 eligible targets.
- 40,698 Path A records.
- 40,698 Path B records.
- Identical Path A/B population keys.

Strength availability never changes eligibility or population. Path B remains
the unchanged PE-4I.17 optional-xG record: missing stays missing,
`zeroFillUsed=false`, and `populationShifted=false`.

## Versioned artifacts

PE-4I.20 uses new directories only:

- `data/calibration/pe4-acquisition-v1/stage2i20-strength-integrated-dev-dataset-v1/`
- `data/calibration/pe4-acquisition-v1/stage2i20-strength-structure-audit-v1/`

Writers refuse a non-empty target directory. PE-4I.17, I.18, and I.19
artifacts are never opened for writing.

Dataset manifests pin the ledger, catalogue, original PE-4I.17 Path A/B, and
new PE-4I.20 Path A/B SHA-256 digests. No labels artifact is emitted.

## Renewed structural audit

The label-free audit covers presence, descriptive/variance classifications,
exact redundancy, Pearson correlation bands, window overlap, venue-mode
overlap, sparse history, and the feature-family matrix. Its strength numeric
candidates are:

- mean opponent common strength as of M;
- observation, matched, and missing counts;
- selected-history regulation-ambiguity count;
- catalogue prior-ambiguity candidate count.

Null strength is absent for pairwise calculations, never coerced to zero. The
audit runs twice and over a deterministic shuffle and requires identical
digests. It also requires unchanged Path B digest, population parity, and the
canonical target/row counts.

## Commands requiring separate artifact authorization

These commands write the new PE-4I.20 directories and must not be run during
implementation-only validation:

```text
npm run calibration:pe4i20-strength-dataset
npm run calibration:pe4i20-strength-structure-audit
```

Safe implementation validation uses TypeScript, ESLint, and the focused
in-memory test file. The focused tests do not invoke either writer.
