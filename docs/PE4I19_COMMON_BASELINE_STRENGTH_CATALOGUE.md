# PE-4I.19 — Offline As-of-M Common-Baseline Strength Catalogue

PE-4I.19 materializes research-only opponent-strength evidence from the existing offline ledger. It performs no provider, HTTP, database, lifecycle, fitting, odds, or production work.

## Contract

- Each team is reconstructed independently through `resolveHistoricalCommonBaselineStrength()` at `kickoff(M)`.
- Both home and away teams use the shared PE-4 baseline of 1580. These values are not comparable to venue-specific production C0 ticket Elo.
- Evidence is scoped to the same competition and provider season and must have kickoff strictly before M. Match M, same-kickoff fixtures, and future fixtures cannot contribute.
- Identical fixture duplicates collapse deterministically; conflicting duplicates fail closed.
- Calendar-2025 and provider-season-2025 targets are excluded through the PE-4I.15 firewall.
- AET/PEN rows remain explicitly marked as regulation-ambiguous. Candidate ambiguity counts are reported; no ambiguity is silently converted to clean regulation evidence.
- The join is available only when every selected history row has a valid `(opponentTeamId, kickoffM)` entry and at least three observations exist. Partial or insufficient joins are `UNAVAILABLE`.
- If one team is attached to multiple fixtures at the same kickoff, the ambiguous join key is removed and counted as conflicted; no fixture is chosen silently.

## Output and boundaries

Rows include source, played count, reconstruction base and semantics, temporal cutoff, evidence-universe digest, ledger provenance, holdout classification, and ambiguity accounting. `PE4I19_PRODUCTION_WIRING` is permanently `false`; no production module consumes the catalogue.

Focused validation lives in `pe4i19.strength-catalogue.test.ts`. No PE-4I.20 work is included.

Run the offline materializer with `npm run calibration:pe4i19-strength-catalogue`. It writes only to the gitignored `data/calibration/pe4-acquisition-v1/stage2i19-strength-catalogue/` directory.
