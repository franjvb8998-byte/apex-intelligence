# Probability Engine — D-04 Population Governance Decision

## 1. Document control

| Field | Value |
| --- | --- |
| Decision ID | D-04 |
| Title | Named Population Separation and Fail-Closed Governance for Unknown 2025 Overlap |
| Approved option | Option 1 |
| Status | OWNER-APPROVED DECISION |
| Date of this record | 2026-11-11 |
| Repository | `C:\Projects\apex-intelligence` |
| Branch | `main` |
| Baseline commit | `3a3bd665164be12bf237e6880cbd94ba42d37a31` (`3a3bd66`) |
| Baseline check | Before this file was added, `HEAD`, `main`, and `origin/main` were that commit and `git status --porcelain` was empty. |
| Scope | Population names, the owner’s fail-closed eligibility rule for future unseen-outcome research validation, and the boundary around existing RC2, PE-4, PE-5, and GOALS restrictions. |
| What this record is | The repository record that the owner approved Option 1, including both mandatory clarifications in section 3. |
| What this record is not | A finding that every excluded row was previously used, scored, or contaminated. An amendment of a frozen protocol. A D-05 disposition. An authorization to unseal, score, acquire, or promote. A declaration that Research Complete has been achieved. |

D-01 required a written population decision before an unseen window can be named (`docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` lines 108 and 202). That requirement is to identify which 2025 populations RC2 already used, which remain protected, and which later studies may cite published RC2 aggregates without opening outcome files. Line 108 also says that D-01 itself does not resolve the continuity document’s unknown dataset relationship. That sentence is not a universal requirement that every population decision leave fixture-level identity UNKNOWN. `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md` left the 2025 relationship unresolved and required an owner decision (lines 345–353). Its register listed three alternatives: a crosswalk that does not open sealed files, permanent separation, or a controlled comparison under a new protocol (line 434). This file records the owner’s choice. Option 1 names the populations and keeps their fixture-level identity unresolved. That preservation is the approved Option 1 decision. Option 1 establishes the current fail-closed separation in section 8. It is not the register’s permanent-separation alternative. It is not the controlled-comparison alternative. Any future resolution of fixture identity requires a separately authorized protocol. This file does not open sealed files.

No file under `data/calibration/` or `data/prospective/` was listed, hashed, or read while writing this record. `.gitignore` lines 37–41 ignore both directories. No test, build, scoring job, generator, or live provider was run. No source file and no existing document was edited.

## 2. Owner decision

The owner has approved D-04 Option 1:

**Named Population Separation and Fail-Closed Governance for Unknown 2025 Overlap.**

That approval includes the two clarifications in section 3. Both clarifications are part of the decision. The title alone is not the whole decision.

The approval does these things:

1. It names the populations in section 4 as separate labels.
2. It records which of those labels have a documented history of RC2 outcome use.
3. It leaves existing PE-4, PE-5, and GOALS restrictions in force inside the scopes where they are already written.
4. It adopts the current fail-closed eligibility rule in section 8 for future unseen-outcome research validation where fixture-level overlap with a used RC2 Premier League population is unknown. That rule is not permanent separation. A later resolution of fixture identity requires a separately authorized protocol.
5. It leaves D-05 pending and leaves the D-01 unseen-validation gate unmet.

The approval does not retire, amend, or replace `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md`, `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md`, or `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md`. It does not edit D-01. Sentences in D-01 that say D-04 is undecided are the status of that file at its own baseline. This later record is the D-04 decision. It does not rewrite D-01’s text.

## 3. Mandatory clarifications

### 3.1 Governance versus historical fact

Conservative exclusion from future unseen scoring is a governance eligibility rule.

It is not proof that every excluded record was previously used, scored, or contaminated. Absence of a fixture-level crosswalk is the reason the eligibility rule fails closed. That absence is not a retrospective finding of universal contamination.

Four categories stay distinct. A later reader may not collapse them into one “2025” status. The confirmed-use category is the RC2 Premier League populations in that row. Sections 6 and 8 keep the used-season prohibition inside that scope. A seal, a possible overlap, or an unknown fixture identity is not the same category, and a different competition is not brought into the confirmed-use category by the season numbers alone.

| Category | What it is | What it is not |
| --- | --- | --- |
| Confirmed prior RC2 outcome use | Premier League 2023, 2024, and 2025, as named in the freeze, the 5B findings, and 5C.1, are used investigation seasons. Section 6 states the evidence. | A fixture inventory. This record does not list fixture IDs and does not reopen outcome files. |
| Existing PE-4 and GOALS protections | Protocol seals, reservations, rejections, and research-pool exclusions already written for provider-season 2025, calendar-2025 kickoffs, and GOALS season 2025. Section 7 states the evidence. PE-5 restrictions in that section are included because clarification 2 keeps them binding. | Proof that RC2 scored the same rows. A seal is a restriction on later use inside that protocol. It is not a historical verdict that the sealed row was inside 5B.1–5B.16. |
| Potential population overlap | The labels share the token `2025`, and several contracts also name Premier League competition `39`. Overlap is possible. It has not been measured at fixture level. | Measured contamination. Shared names and a shared competition id do not establish that the rows are the same matches. |
| Unknown fixture-level identity | Whether any specific fixture in one named population is the same fixture as a row in another named population. Section 12 leaves this UNKNOWN. | Either equivalence or disjointness. Neither claim has evidence in the files read for this decision. |

### 3.2 Scope of restrictions

The D-04 fail-closed exclusion applies to eligibility for future unseen-outcome research validation under the Probability Engine program.

It does not retroactively amend frozen protocols. Each frozen protocol continues to mean what its own text says, inside the scope that text already has.

It does not create a blanket prohibition on unrelated product data uses. Match Center, Match Analysis, Copilot, Vision, and the prematch lifecycle remain on the contracts those paths already have. This decision adds no new program-wide ban on those paths. It also grants them no new permission to read sealed research outcomes, to change a model parameter, or to treat a live product fixture as an unseen validation row.

Existing RC2, PE-4, PE-5, and GOALS restrictions remain independently binding within their documented scopes. Where an existing restriction is tighter than this eligibility rule, the tighter restriction continues to bind on its own text. This decision does not relax it. Where this eligibility rule refuses an unseen-validation use that an older protocol did not discuss, the refusal is prospective governance for that validation use. It is not a silent edit of the older protocol.

## 4. Population glossary

Each entry is a name used by a cited contract. The glossary does not assert that two entries are the same set of fixtures, and it does not assert that they are disjoint.

### RC2 PL 2023

The Premier League 2023 investigation season in the RC2 record. The 5B.6 validation shape names holdout seasons `2023` and `2025` for league id `39`, league name `Premier League`, dataset kind `NATURAL FULL POPULATION`, and validation role `HOLDOUT` (`lib/debug/calibration/validation-5b6-shape.ts` lines 6–17). The freeze states that PL 2023 was holdout in 5B.6–5B.16 (`docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` lines 18–24). The shape file’s header says it was frozen before any holdout was collected (lines 1–3). The later freeze and findings are the record that the season was used. This decision does not re-derive that use from outcome files.

### RC2 PL 2024

The Premier League 2024 investigation season in the RC2 record. The same shape file sets `VALIDATION_DEVELOPMENT_SEASON = "2024"` and `DEVELOPMENT_ROLE = "DEVELOPMENT"` (lines 10 and 18). The freeze states that PL 2024 was the development / pilot population (lines 18–24). The findings state that 2024 is development only and never enters holdout aggregates (`docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md` line 227). Development use is still use. PL 2024 is a used investigation season (findings line 27; freeze lines 18–26).

### RC2 PL 2025

The Premier League 2025 investigation season in the RC2 record. The shape file includes `2025` in `VALIDATION_HOLDOUT_SEASONS` (line 9). The freeze states that PL 2025 was holdout in 5B.6–5B.16 (lines 18–24). The findings discuss 2025 extra draws and a 2025 extra draw rate as results of an investigation that already used 2025 outcomes (lines 132 and 138). Those sentences are historical findings. They are not a fixture list, and they are not permission to open a sealed file.

### PE-4 provider-season 2025

The API-Football season query value `2025` in the PE-4 acquisition contracts. `PE4I2_HOLDOUT_SEASON = "2025"` and `PE4I2_HOLDOUT_POLICY = "REJECT_2025_OUTCOME_AND_METADATA_IN_THIS_PROTOCOL"` (`lib/debug/calibration/pe4-acquisition/protocol.ts` lines 24–27). Allowed acquisition seasons in that protocol are `2023` and `2024` (line 21). Line 18 is the comment that identifies the target league as Premier League. Line 19 sets `PE4I2_TARGET_LEAGUE_PROVIDER_ID = "39"`. `assertNoProviderSeason2025Request` throws when the season argument equals that holdout constant (`lib/debug/calibration/pe4-acquisition/holdout.ts` lines 61–66). `classifyHoldoutForResearch` returns `provider_season_2025_forbidden` when `providerSeasonId === PE4I2_HOLDOUT_SEASON`, and it does so before the calendar-year test (`lib/debug/calibration/pe4-as-of-t-features/holdout-firewall.ts` lines 48–58).

PE-4I.21 records that provider-season 2025 still has no corpus example in that contract and that a synthetic holdout classification covers the branch (`docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` line 124). That sentence is a limitation of the PE-4I.21 contract examples. It is not a fixture-level comparison with RC2 PL 2025, and it is not evidence that every gitignored artifact lacks 2025 outcomes. This writing task did not open those artifacts.

### Calendar-2025 UTC kickoff population

Rows whose kickoff timestamp has UTC calendar year 2025. `isCalendar2025Kickoff` is `calendarKickoffYear(kickoffUtc) === 2025` (`holdout-firewall.ts` lines 44–46). `calendarKickoffYear` parses the kickoff and returns `getUTCFullYear()` (`holdout.ts` lines 20–24). When the provider season is not the 2025 holdout season, `classifyHoldoutForResearch` returns `calendar_2025_sealed_outcome` for that UTC year, `unknown_kickoff` when the year does not parse, and `dev_or_conf_eligible` otherwise (`holdout-firewall.ts` lines 48–58). `dev_or_conf_eligible` is that classifier’s branch for a parsed kickoff year other than 2025 when provider season 2025 was not reported. It does not establish eligibility for unseen-outcome validation under this decision. Section 8 remains the eligibility rule for that validation use.

The research pools `DEV_FITTING`, `FEATURE_SELECTION`, `CALIBRATION`, and `COMPARISON` exclude those kickoffs (lines 31–42 and 65–86). `LEDGER_STORAGE` may retain raw rows (lines 31–34 and 90–100). PE-4I.21 says calendar-2025 ledger rows stay sealed and that DEV rows contain none of those outcomes (line 129). That statement is the contract’s historical record. This task did not re-open the ledger to re-count it.

A provider-season-2024 fixture with a calendar-2025 kickoff is not automatically research-holdout-2025 evidence. `isResearchHoldoutOutcomeEvidence` always returns `false` (`holdout.ts` lines 46–58). PE-4I.4 and PE-4I.15 answer different questions. This decision keeps both.

### GOALS reserved season 2025

Nine GOALS protocols each document their own holdout constant with the string value `2025` and their own `holdoutPolicy` literal `RESERVED_UNTOUCHED_NO_OUTCOME_EVAL`. Each constant stays inside that protocol’s scope. The shared string does not identify one identical fixture-level population. This decision does not assert that the nine constants are the same matches, and it does not assert that they are disjoint.

On G1, `GOALS_G1_HOLDOUT_SEASON = "2025"` is the constant at `lib/debug/calibration/goals/g1/protocol.ts` line 27. Development season `2023` and confirmatory season `2024` are separate constants (lines 25–26). The type `GoalsG1Protocol` declares `holdoutSeason: typeof GOALS_G1_HOLDOUT_SEASON` at line 58 and declares the type literal `holdoutPolicy: "RESERVED_UNTOUCHED_NO_OUTCOME_EVAL"` at line 59. `goalsG1Protocol()` assigns `holdoutSeason: GOALS_G1_HOLDOUT_SEASON` at line 106 and assigns that policy literal at line 107. The type declaration and the function assignment are different sites.

The other eight protocols, and G1 again for the common shape, are:

| Protocol scope | File | Constant | Type declaration | Assignment |
| --- | --- | --- | --- | --- |
| G0 league baseline | `lib/debug/calibration/goals/g0/protocol.ts` | `GOALS_G0_HOLDOUT_SEASON`, line 16 | lines 37–38 | `goalsG0Protocol()`, lines 64–65 |
| G1 attack/defense Poisson | `lib/debug/calibration/goals/g1/protocol.ts` | `GOALS_G1_HOLDOUT_SEASON`, line 27 | lines 58–59 | `goalsG1Protocol()`, lines 106–107 |
| G3 opponent-adjusted attack/defense | `lib/debug/calibration/goals/g3/protocol.ts` | `GOALS_G3_HOLDOUT_SEASON`, line 38 | lines 85–86 | `goalsG3Protocol()`, lines 133–134 |
| Distributional audit; no model fitting | `lib/debug/calibration/goals/distributional-audit/protocol.ts` | `GOALS_DIST_AUDIT_HOLDOUT_SEASON`, line 29 | lines 92–93 | `goalsDistAuditProtocol()`, lines 123–124 |
| Market-calibration audit; no calibrator fitting | `lib/debug/calibration/goals/market-calibration/protocol.ts` | `GOALS_MCAL_HOLDOUT_SEASON`, line 35 | lines 100–101 | `goalsMcalProtocol()`, lines 137–138 |
| Market-calibration POC | `lib/debug/calibration/goals/market-calibration-poc/protocol.ts` | `GOALS_MCAL_POC_HOLDOUT_SEASON`, line 42 | lines 161–162 | `goalsMcalPocProtocol()`, lines 211–212 |
| Market-calibration refinement | `lib/debug/calibration/goals/market-calibration-refinement/protocol.ts` | `GOALS_MCAL_REF_HOLDOUT_SEASON`, line 39 | `holdoutSeason` at line 131; policy literal at line 134 | `goalsMcalRefProtocol()`, `holdoutSeason` at line 181 and the policy literal at line 184 |
| Recent attack/defense signal audit | `lib/debug/calibration/goals/recent-attack-defense/protocol.ts` | `GOALS_RAD_HOLDOUT_SEASON`, line 47 | lines 96–97 | `goalsRadProtocol()`, lines 148–149 |
| Rest/schedule signal audit | `lib/debug/calibration/goals/rest-schedule/protocol.ts` | `GOALS_REST_HOLDOUT_SEASON`, line 35 | lines 115–116 | `goalsRestProtocol()`, lines 159–160 |

The GOALS evidence types repeat season strings of their own: `GOALS_HOLDOUT_SEASON = "2025"`, `GOALS_DEV_SEASON = "2023"`, `GOALS_CONFIRMATORY_SEASON = "2024"` (`lib/debug/calibration/goals/types.ts` lines 15–17). `buildGoalsEvidenceDataset` skips rows whose `season` equals that evidence-layer holdout constant, emits only the 2023 and 2024 seasons, defaults `competitionId` to `39`, and throws `holdout_season_forbidden` if a target in the emitted loop still carries the holdout season (`lib/debug/calibration/goals/build-dataset.ts` lines 71–73, 85–99, and 119–127). That builder rule is the evidence builder’s scope. It does not collapse the nine protocol constants into one fixture set.

`CalibrationRow.season` is typed as `string` (`lib/debug/calibration/types.ts` lines 41–48; the field is line 48). The type annotation types the field as `string`. That annotation alone does not define provider-season semantics, and it does not define calendar-year semantics. This decision does not supply that missing definition.

The PE-4 + GOALS checkpoint says Premier League 2025 remains sealed for those research paths, with structural references only, and that artifacts under `data/calibration/` are gitignored (`docs/PE4_GOALS_RESEARCH_CHECKPOINT_AUDIT.md` lines 51–55). That sentence is a seal statement for the paths the checkpoint names. It does not establish fixture-level identity among RC2 PL 2025, PE-4 provider-season 2025, the calendar-2025 UTC kickoff population, or any GOALS holdout constant. Section 5 is the crosswalk for that distinction.

## 5. Population crosswalk

The crosswalk separates three grades: documented distinction, possible overlap, and unknown identity. A cell may carry only the grade the cited lines support.

| Topic | Documented distinction | Possible overlap | Unknown identity |
| --- | --- | --- | --- |
| RC2 season role | PL 2023 and PL 2025 are named holdouts in 5B.6–5B.16. PL 2024 is named development / pilot. All three are used Premier League seasons (freeze lines 18–26; findings lines 27 and 227). Section 3.1 confines that used-season category to these RC2 Premier League populations. | The three names are one RC2 Premier League investigation record. That record is not a claim about other competitions, and it is not a claim about PE-4 or GOALS files. | Which fixture IDs were inside the used RC2 Premier League windows. Outcome files were not opened. |
| RC2 label versus PE-4 provider season | RC2’s freeze uses the names “PL 2023”, “PL 2024”, and “PL 2025”. PE-4I.2 uses provider season strings and rejects provider season `2025` (protocol lines 21–27). PE-4I.4 states that provider season, calendar year, and research axis are different (`holdout.ts` lines 1–17). | The 5B.6 shape names Premier League and league id `39` (lines 6–7). PE-4I.2 line 18 names Premier League in a comment. Line 19 holds provider league id `39`. A shared competition id is a shared label. | Whether an RC2 “PL 2025” row is a PE-4 `providerSeasonId` of `2025`. Not established. |
| Provider season versus UTC kickoff year | The provider-season-2025 branch returns before the calendar-year branch (`holdout-firewall.ts` lines 52–57). A provider-season-2024 fixture with a calendar-2025 kickoff is not automatically research-holdout-2025 evidence (`holdout.ts` lines 46–58). | A single fixture can carry one provider season and a different UTC kickoff year. The code exists because that split occurs. | Which real fixtures, if any, have provider season 2024 and kickoff year 2025, and which of those were in RC2. Not measured here. |
| Calendar-2025 kickoff versus ledger storage | Outcome-consuming PE-4 pools exclude calendar-2025 kickoffs. `LEDGER_STORAGE` may retain raw rows (`holdout-firewall.ts` lines 31–42 and 89–100). Retention in storage is not eligibility for fitting, selection, calibration, or comparison. | Stored calendar-2025 rows might intersect RC2 PL 2025. They might not. | Whether the PE-4 ledger’s calendar-2025 rows are the same files, a subset, or a disjoint extract relative to RC2. `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md` leaves this UNKNOWN (lines 347–351). This file leaves it UNKNOWN. |
| GOALS season `2025` versus the other 2025 labels | Nine protocols each reserve their own `2025` holdout constant under `RESERVED_UNTOUCHED_NO_OUTCOME_EVAL` (section 4). The evidence builder excludes its own holdout season string (`build-dataset.ts` lines 91–99 and 123–124). The checkpoint says Premier League 2025 remains sealed for those research paths (checkpoint lines 51–55). | The builder defaults `competitionId` to `39` (`build-dataset.ts` line 85). The 5B.6 shape and PE-4I.2 also name competition `39`. A shared id, or a shared season string, is a shared label. | Whether any GOALS holdout constant, `CalibrationRow.season`, `PE4I2_HOLDOUT_SEASON`, a UTC kickoff year, and RC2 “PL 2025” denote one match set. The checkpoint seal does not establish that identity. The `string` type of `CalibrationRow.season` does not define provider-season or calendar-year semantics. |
| PE-5 versus the populations above | PE-5.2, PE-5.3D, and PE-5.4B each keep a 2025 exclusion inside their own protocols (section 7). The PE-5.2 protocol says targets and sources fail closed when `classifyHoldoutForResearch` reports provider season 2025 or a calendar-2025 kickoff (`docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md` lines 21 and 62–64). That sentence reports the classifier result. It is not cited here as a direct call. | The PE-5.2 text uses the same two reported classifications that the PE-4 classifier defines. Using that report does not identify fixtures with RC2. | PE-5 does not publish a fixture crosswalk. This decision does not create one. |
| String `2025` across programs | The token is a season argument, a holdout constant, a UTC year, or an RC2 season name, depending on the file. 5C.3 forbids inferring the provider season identifier from the calendar alone (`docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` lines 48–54). | The token can refer to overlapping football if the underlying fixtures overlap. | Fixture-level equivalence and fixture-level disjointness. Both remain UNKNOWN. |

No row in this table is a statement that two populations were compared on fixture ID.

## 6. Confirmed historical usage

RC2 PL 2023, RC2 PL 2024, and RC2 PL 2025 are already used. They cannot be reused as unseen. That used-season prohibition is scoped to those RC2 Premier League populations. Section 3.1 keeps confirmed prior RC2 outcome use distinct from existing seals, from possible overlap, and from unknown fixture identity. The prohibition does not say that every 2023, 2024, or 2025 row in every competition was used in 5B.

The supporting record is:

- The freeze lists all three under “Frozen historical data (USED)” and states that they must not be called unseen again (`docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` lines 18–26).
- The findings state that PL 2023, 2024, and 2025 are used investigation seasons and must not be called unseen again (line 27).
- 5C.1 repeats the same three names as used investigation seasons, says they must not be used to choose or rank the pre-registered candidates, and says 5C.1 does not load their persisted outcome datasets (`docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` lines 19–27).
- 5C.3 permanently excludes PL 2023, PL 2024, and PL 2025 from prospective validation (lines 58–62).
- The findings’ 2025 draw sentences (lines 132 and 138) are evidence that 2025 outcomes had already been used inside that investigation. They add no fixture list.
- `PRODUCTION_CORRECTION_READY` remained NO at 5B.16 because no unseen window existed (findings lines 225–231). In that sentence, the missing window is a window outside the used RC2 investigation. The sentence is not a finding that every 2025 row elsewhere in the repository was inside 5B.

Unseen, in the freeze, means outcomes that were not used in 5B.1–5B.16 (freeze lines 50–52). The three named Premier League seasons do not meet that definition. D-01 already records the same exclusion (D-01 lines 38, 113, and 118). This decision preserves it.

Confirmed use of those three Premier League seasons does not, by itself, identify the fixture IDs inside PE-4 provider-season 2025, the calendar-2025 UTC kickoff population, or any of the nine GOALS 2025 holdout constants in section 4.

## 7. Protected populations

The following restrictions already exist. This decision preserves them. It does not restate them as a new discovery, and it does not narrow the text that already binds.

### PE-4

- Provider season `2025` is rejected for this acquisition protocol, including outcome and metadata (`protocol.ts` lines 21–27; `holdout.ts` lines 61–66).
- Provider season `2025` is `provider_season_2025_forbidden` for the as-of-T research classifier (`holdout-firewall.ts` lines 52–54 and 71–76).
- Calendar-2025 UTC kickoffs are sealed for the outcome-consuming research pools named in section 4 (`holdout-firewall.ts` lines 31–42 and 65–86).
- Calendar year alone does not promote a row into research-holdout outcome evidence (`holdout.ts` lines 46–58; `holdout-firewall.ts` lines 103–113).
- PE-4I.21 keeps calendar-2025 and provider-season-2025 targets excluded, keeps `PE4I21_PRODUCTION_WIRING` false, and keeps calendar-2025 ledger rows sealed (lines 15–16 and 129). The phrase “research-complete” on line 7 of that contract is a feature-contract close. D-01 already separates it from Probability Engine Research Complete (D-01 lines 22 and 135). This decision uses that same separation. Line 9 of PE-4I.21 says “PE-5 is not started.” D-01 records that sentence as a preserved conflict with later history (D-01 line 135). This decision does not adopt line 9 as a current inventory.

### GOALS

- Each of the nine holdout constants in section 4 remains reserved under that protocol’s own `RESERVED_UNTOUCHED_NO_OUTCOME_EVAL` declaration and assignment. G1’s type literal is line 59 of `lib/debug/calibration/goals/g1/protocol.ts`. G1’s assignment is line 107 of `goalsG1Protocol()`. The eight sibling protocols keep the scopes and line ranges in the section 4 table. Those constants are not one identical fixture-level population.
- The evidence builder continues to emit 2023 and 2024 only and to reject its evidence-layer holdout season (`build-dataset.ts` lines 71–73, 91–99, and 119–127). That builder scope is not a fixture crosswalk across the nine protocols.
- The checkpoint continues to state that Premier League 2025 remains sealed for the PE-4 and GOALS research paths, with structural references only (checkpoint lines 51–55). That phrase does not establish fixture-level identity. Section 5 records the unknown.
- G1 k = 10 remains the research backbone recorded at checkpoint lines 28 and 40. That selection is not a product λ formula, and this decision does not evaluate any reserved holdout.

### PE-5

- PE-5.2 excludes calendar-2025 kickoffs and provider season 2025, and it says the protocol does not read sealed 2025 outcomes (lines 21 and 62–64). The holdout paragraph says targets and sources fail closed when `classifyHoldoutForResearch` reports those classifications. This decision cites that report. It does not cite a direct call site in the protocol document.
- PE-5.3D says the runner does not read or write sealed 2025 artifacts, and that a 2025 season or calendar kickoff stops the plan (`docs/PE5_3D_OFFLINE_PROBE_RUNNER.md` line 70).
- PE-5.4B’s frozen 2025-holdout boundary excludes provider season `2025` and calendar-2025 kickoffs, and it says no phase in that design reads sealed outcome files or `data/calibration` holdout artifacts (`docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` line 65). The design’s temporal section denies, before reserve, when `classifyHoldoutForResearch` reports provider season `2025` or a calendar-2025 kickoff (line 490).
- PE-5.4B’s live pilot remains NO-GO until a later explicit authorization (lines 790–802). This decision is not that authorization. D-01’s reading of the stale inventory sentences in that design is unchanged (D-01 line 140). This decision does not delete them and does not re-audit PE-5.4C.

### RC2

- The freeze, 5C.1, and 5C.3 exclusions in section 6 remain in force.
- 5C.1 remains **FROZEN FOR REVIEW — no unseen outcomes scored** (lines 1–7 and 189–193).
- 5C.3 sets `prospectiveSeason = UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY` and forbids inferring the provider season from the calendar (lines 48–54). This decision does not verify a provider season and does not authorize that discovery.

## 8. Fail-closed eligibility

Unknown overlap remains ineligible for future unseen-outcome research validation under the Probability Engine program, unless a separate authorized protocol establishes eligibility.

Option 1 establishes that separation as the current fail-closed rule. It is not the continuity register’s permanent-separation alternative (line 434). A future resolution of fixture identity, or a future finding of eligibility, requires a separately authorized protocol. This file is not that protocol.

The rule has four parts.

1. RC2 PL 2023, RC2 PL 2024, and RC2 PL 2025 are ineligible because their use is already documented. Section 3.1 scopes that confirmed-use category to those RC2 Premier League populations. No later protocol may call those named Premier League seasons unseen. The freeze already forbids that for the Premier League seasons it lists (lines 18–26). This decision repeats that Premier League prohibition and does not reopen it. It does not attach the confirmed-use label to every 2023, 2024, or 2025 row in another competition.
2. While fixture-level identity with those used RC2 Premier League seasons remains UNKNOWN, PE-4 provider-season 2025, the calendar-2025 UTC kickoff population, and each of the nine GOALS 2025 holdout constants in section 4 are ineligible for future unseen-outcome validation. Each GOALS constant keeps the protocol scope named in that section. The shared string `2025` does not make those constants one fixture-level population. The reason is unresolved overlap. The reason is not a finding that each reserved row was scored in 5B. A PE-4 result of `dev_or_conf_eligible` (`holdout-firewall.ts` lines 48–58) classifies a row for that research firewall. It does not establish eligibility for unseen-outcome validation.
3. The RC2 historical-overlap restriction on a differently labeled 2023 or 2024 population covers two classes only. The first class is rows identified as Premier League or as provider competition `39`. The second class is rows whose competition identity is unknown and cannot be proven to lie outside that RC2 Premier League population. A row with a documented competition id other than `39` is outside this specific RC2 overlap restriction. Relabeling the season axis of a row that remains inside either class does not make that row unseen. This limit is not a finding that every Premier League 2023 or 2024 row was inside the RC2 population. Leaving this specific restriction does not, by itself, establish unseen eligibility. Section 9 still states the conditions for a later validation. This paragraph does not override a PE-4, PE-5, GOALS, or calendar-2025 restriction that already applies on that protocol’s own text. Those restrictions remain in force inside their documented scopes, including where the competition id is not `39`.
4. Eligibility, and any fixture-level resolution of the unknowns in section 12, can be established only by a separate written protocol that a later owner authorization approves before outcome access. This file does not authorize the file access, the comparison, or the scoring that such a protocol would need. Until that protocol exists and has been approved, the current fail-closed rule stands.

The controlled-comparison alternative in the continuity register (line 434) is not approved. The register’s permanent-separation alternative is not adopted. Option 1 is the current fail-closed separation in this section.

Sealed, reserved, and rejected rows stay sealed, reserved, and rejected under section 7 whether or not a future eligibility protocol is ever written. Establishing unseen eligibility, were a later protocol to attempt it, would still have to obey those existing restrictions and the RC2 Premier League prohibition in section 3.1. This sentence does not predict that such a protocol can succeed.

## 9. Future validation conditions

Any later unseen-outcome validation under the Probability Engine program is subject to all of the following. This section states conditions. It does not authorize the study.

1. **Respect the RC2 freeze.** An unseen prospective window is data whose outcomes were not used in 5B.1–5B.16 (freeze lines 50–52). A historical season outside 2023–2025 qualifies only when the candidate was frozen before that season’s outcomes were loaded or scored, no results from that season were used in 5B, and no parameter changes after outcome access (freeze lines 61–65). Freeze line 28 is an instruction not to collect a new season in 5B.17, and it keeps zero API required for that freeze sprint. This decision records that instruction. It does not rewrite it.
2. **Preserve the PL 2023–2025 exclusion.** Those three RC2 Premier League seasons remain used (freeze lines 18–26; 5C.1 lines 19–27; 5C.3 lines 58–62). Section 3.1 scopes that used-season prohibition to those RC2 Premier League populations. 5C.1 line 180 allows scoring on seasons not in `{2023, 2024, 2025}` unless a later season was unused in 5B and the 5C.1 freeze predates its outcome access. D-01 reads that “unless” as not reopening Premier League 2023, 2024, or 2025 (D-01 line 118). This decision adopts that reading for those Premier League seasons and does not amend line 180. Section 8, part 3, states the narrower competition limit for a differently labeled 2023 or 2024 population.
3. **Prefer genuinely time-prospective capture.** The preferred design is to collect predictions before match completion, store immutable pre-match records, score only after results are final, and make no retroactive candidate changes (freeze lines 54–59). 5C.1 requires capture of all five arms before a separate scoring step (lines 176–181).
4. **Require preregistration before outcome access.** The freeze requires exact formulas, constants, and code hashes before loading or scoring unseen outcomes (line 46). The unseen-window rule and the three historical-season conditions sit at lines 50–66. 5C.1 is a pre-registration frozen for review. It becomes the accepted study only if D-05 records ACCEPT or AMEND. RETIRE of 5C.1 would close that pre-registration only. D-01 states that RETIRE is not Research Complete and that a replacement would need its own freeze and a new written owner decision (D-01 lines 38–47 and 109–112). This file does not choose ACCEPT, AMEND, or RETIRE.
5. **Keep scoring separately authorized.** D-01 states that writing D-04 would still need a separate authorization before any scoring run (line 122). This decision is that written D-04. It is not the scoring authorization. No outcome is scored by approving Option 1.
6. **Do not infer provider season from calendar year.** 5C.3 states that rule directly (lines 48–54). PE-4I.4 states the corresponding distinction for research axes (`holdout.ts` lines 1–17 and 46–58). A UTC kickoff year of 2025 does not identify `providerSeasonId`, and `providerSeasonId` of `2025` does not identify the RC2 PL 2025 fixture set.

Primary metrics remain log loss, Brier, and ECE, reported separately (freeze lines 71–79; 5C.1 lines 133–139). No production promotion at N = 100 merely because metrics look good (freeze lines 105–107). This decision adds no threshold.

## 10. Citation of published aggregates

D-01 requires D-04 to say which later studies may cite published RC2 aggregates without opening outcome files (D-01 lines 108 and 202).

A later Probability Engine research document may quote the aggregate statements already printed in these files:

- `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md`
- `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md`
- `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md`
- `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md`

Quotation of those published sentences is not outcome access and is not scoring. Quotation does not make a quoted season unseen. Quotation does not admit PE-4, PE-5, or GOALS rows into an unseen window. Quotation does not authorize opening `data/calibration/` or `data/prospective/` to recompute, extend, or check the aggregates at fixture level.

Studies that want a new numeric result from outcome rows need a separate authorization. Section 9 states the conditions that authorization would have to meet. This section does not grant it.

## 11. Scope boundary for product paths and frozen text

This governance decision is not a retrospective finding of universal contamination. Section 3.1 is the binding statement of that distinction.

This governance decision does not regulate unrelated product paths. Section 3.2 is the binding statement of that limit. Existing product callers of the hybrid engine are outside the new fail-closed eligibility rule. Their existence is not Research Complete, and this file does not change their code or their data contracts.

This governance decision does not amend:

- `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md`
- `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md`
- `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md`
- `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md`
- `docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md`
- `docs/PE4_GOALS_RESEARCH_CHECKPOINT_AUDIT.md`
- `docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md`
- `docs/PE5_3D_OFFLINE_PROBE_RUNNER.md`
- `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md`
- `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md`
- `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md`
- the PE-4, GOALS, and 5B.6 source contracts cited above

Those files remain the authorities for the sentences they already contain.

## 12. Remaining unknowns

The following stay UNKNOWN under owner-approved Option 1. D-01 required this decision to identify used and protected 2025 populations. D-01 did not require that fixture-level identity remain UNKNOWN in every possible population decision. Option 1 is the authority for leaving these identities unresolved. This decision does not assign a probability to them and does not schedule a study to close them. A later resolution requires the separately authorized protocol in section 8. This file does not authorize that protocol.

1. Whether the Premier League 2025 rows used in RC2 5B are the same files, a subset, or a disjoint extract from the calendar-2025 rows the PE-4 ledger is allowed to store. Continuity line 349 states this unknown. No sealed file was opened to resolve it.
2. Whether any gitignored artifact under `data/calibration/` or `data/prospective/` still contains outcome rows. A clean Git status does not describe gitignored files. Continuity lines 350 and 421 state that limit for `data/calibration/`. This task did not list either directory.
3. Whether “Premier League 2025” in RC2, “provider season 2025”, “calendar-2025 UTC kickoff”, and any of the nine GOALS 2025 holdout constants denote the same match set. Continuity line 351 states the first three as unknown, because PE-4I.4 exists to keep provider season, calendar year, and research axis apart (`holdout.ts` lines 1–17). Each GOALS constant is a further unresolved label, and the nine constants are not claimed to be one fixture-level population (section 4). The checkpoint phrase “Premier League 2025 remains sealed” does not settle this identity question (section 5).
4. Which fixture IDs belong to RC2 PL 2023, RC2 PL 2024, or RC2 PL 2025. The shape file names the seasons and the dataset kind `NATURAL FULL POPULATION` (lines 9–16). `ValidationSeasonMetadata` describes that kind for a 5B.6 holdout-season natural population (`lib/debug/calibration/types.ts` lines 185–193). Neither file, as read here, is a fixture dump. This task did not open a population artifact.
5. Whether a provider-season-2024 fixture with a calendar-2025 kickoff occurs in any retained ledger, and whether any such fixture was used in RC2. The code distinguishes the case. Occurrence is not measured here.
6. The provider season id that a future live prospective capture would verify. 5C.3 leaves it `UNVERIFIED_UNTIL_FIRST_LIVE_DISCOVERY` (lines 48–54). This decision does not discover it.

Publishing this named separation does not convert any of these unknowns into a fact.

## 13. Dependencies

| Item | Status after this decision | Why |
| --- | --- | --- |
| D-04 | OWNER-APPROVED DECISION | Section 2. Option 1 and both clarifications. |
| D-05 | PENDING | ACCEPT, AMEND, or RETIRE of `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` is not chosen. Continuity lines 291 and 435, and D-01 lines 109–112 and 203, leave that choice to a later owner record. |
| D-01 clause 3, population-naming item | RECORDED | D-01 lines 108 and 202 require a written decision identifying which 2025 populations RC2 already used, which remain protected, and which later studies may cite published aggregates without opening outcome files. This file records that identification. Leaving fixture-level identity UNKNOWN is Option 1, not a universal requirement imposed by D-01. Recording the decision does not score the unseen study. |
| D-01 gate B, mandatory unseen validation | NOT MET | D-05 is pending. 5C.1 is frozen for review and unscored. No separately authorized unseen study exists. D-01 lines 124, 172–176, and 202–203. Approving D-04 removes only the “D-04 is undecided” part of that gate. The rest of the gate remains open. D-01’s own sentences are not edited. |
| Research Complete | NOT ACHIEVED | D-01 lines 10, 30–31, and 186–188. Clause 3 is unmet. This file supplies the population decision and does not supply the unseen score. |
| Continuity D-04 row | ANSWERED BY THIS FILE | The register at continuity line 434 asked for a written decision. This file is that decision. The register text is unchanged. The continuity file is not edited. |

Gate A of D-01, the independent formula-fidelity record, is outside this decision. This file does not pass it and does not waive it.

## 14. Explicit non-authorizations

This document does not authorize any of the following.

- Opening, reading, listing, hashing, unsealing, or scoring protected outcome datasets, including gitignored artifacts under `data/calibration/` and `data/prospective/`.
- A scoring run of 5C.1 or of any replacement study.
- Live API-Football acquisition, including the 5C.3 “first controlled live discovery”, a PE-5.4B pilot, or any use of an offline PE-5 path as a live client.
- Amendment of a frozen protocol, of D-01, of the continuity register, or of the PE-4, PE-5, or GOALS source contracts.
- Parameter promotion, including S, blend weight, draw base, home advantage, shrinkage k, Dixon-Coles ρ, λ3, a HIGH_EQUAL multiplier, role bases, or a goal-difference formula.
- Setting `PE4I21_PRODUCTION_WIRING`, `PE5_PRODUCTION_WIRING`, `PE3C_C0_RECON_ACTIVATION`, or a live-provider flag to true.
- PE-6 or PE-7 work. The names stay unused. This decision does not define them.
- Betting Analyzer work, or a change to Copilot value scan. Any betting-surface status remains D-08, as D-01 left it (D-01 lines 41 and 154–158).
- A controlled fixture-level comparison of the populations in section 4.
- A declaration that Research Complete has been achieved.
- A D-05 disposition.
- Implementation, tests, builds, configuration changes, commits, or pushes.

A later owner authorization has to name the files and the action in scope. Approval of Option 1 authorizes nothing except this written decision and further reading of it.

## 15. Evidence

Grades used here:

| Grade | Meaning |
| --- | --- |
| READ AT THIS BASELINE | The cited lines were read in the working tree at `3a3bd66` while writing this file. They were not executed. |
| HISTORICAL VERDICT | A conclusion already recorded by the freeze, the findings, a protocol, or a checkpoint. Not re-executed and not re-derived from outcome files. |
| OWNER DECISION | The approval recorded in section 2, including section 3. |
| UNKNOWN | Left unknown on purpose. |

| Proposition | Source | Lines | Grade |
| --- | --- | --- | --- |
| 2025 relationship left unresolved; owner decision required | `docs/PE_ARCHITECTURE_CONTINUITY_AND_REMAINING_SCOPE.md` | 345–353 | READ AT THIS BASELINE |
| Register alternatives: sealed-file-free crosswalk, permanent separation, or a new-protocol comparison | same | 434 | READ AT THIS BASELINE |
| Continuity does not declare 2025 globally unseen or sealed data available | same | 307–309 | READ AT THIS BASELINE |
| D-01 requires a written D-04 that identifies which 2025 populations RC2 already used, which remain protected, and which later studies may cite published RC2 aggregates without opening outcome files. Line 108 also says D-01 itself does not resolve the continuity unknown. That sentence does not require fixture-level identity to remain UNKNOWN | `docs/PE_D01_RESEARCH_COMPLETE_DEFINITION.md` | 108, 202 | READ AT THIS BASELINE |
| D-01 Premier League 2023–2025 exclusion, and the statement that writing D-04 is not a scoring authorization | same | 38, 113–118, 122 | READ AT THIS BASELINE |
| D-01 Research Complete is not achieved; gate B is unmet while D-05 and the unseen study remain open | same | 10, 30–31, 124, 172–176, 186–188, 203 | READ AT THIS BASELINE |
| RC2 PL 2023 holdout, PL 2024 development / pilot, PL 2025 holdout; those Premier League seasons must not be called unseen | `docs/calibration/RC2_PROSPECTIVE_VALIDATION_FREEZE.md` | 18–26 | HISTORICAL VERDICT, read at this baseline |
| Instruction not to collect a new season in 5B.17; zero API remains required for the freeze sprint | same | 28 | READ AT THIS BASELINE |
| Unseen means not used in 5B.1–5B.16; time-prospective design; three conditions for another historical season | same | 50–66 | READ AT THIS BASELINE |
| Separate log loss, Brier, and ECE; no promotion at N = 100 | same | 71–79, 95–109 | READ AT THIS BASELINE |
| Pre-registration before outcome access; slots were unassigned in the freeze itself | same | 32–46 | READ AT THIS BASELINE |
| 5B.6 shape: league `39`, Premier League, holdout seasons 2023 and 2025, development season 2024, natural full population | `lib/debug/calibration/validation-5b6-shape.ts` | 1–18 | READ AT THIS BASELINE |
| 5B.6 metadata type names that dataset kind and does not list fixture IDs in the type | `lib/debug/calibration/types.ts` | 185–193 | READ AT THIS BASELINE |
| Findings: three seasons used; 2025 draw residuals; 2024 development only; no unseen window at 5B.16 | `docs/calibration/RC2_5B_CALIBRATION_FINDINGS.md` | 27, 130–138, 225–231 | HISTORICAL VERDICT, read at this baseline |
| 5C.1 used-season firewall; does not load those outcome datasets; status frozen for review; season clause; capture-before-score | `docs/calibration/RC2_5C_CANDIDATE_PREREGISTRATION.md` | 1–7, 19–27, 176–193 | READ AT THIS BASELINE |
| 5C.3: do not infer provider season from the calendar; PL 2023–2025 permanently excluded; season unverified | `docs/calibration/RC2_5C_LIVE_CAPTURE_PROTOCOL.md` | 48–62 | READ AT THIS BASELINE |
| PE-4I.2: line 18 names Premier League; line 19 is provider league id `39`; lines 21–27 are allowed seasons, holdout season, and rejection policy | `lib/debug/calibration/pe4-acquisition/protocol.ts` | 18–27 | READ AT THIS BASELINE |
| Provider season, calendar year, and research axis are different; calendar year does not auto-promote holdout evidence; provider-season-2025 requests throw | `lib/debug/calibration/pe4-acquisition/holdout.ts` | 1–17, 20–24, 46–66 | READ AT THIS BASELINE |
| Calendar-2025 pool exclusion; provider-season-2025 branch first; `dev_or_conf_eligible` is the other parsed-year branch and is not unseen-validation eligibility; ledger storage is distinct from outcome pools | `lib/debug/calibration/pe4-as-of-t-features/holdout-firewall.ts` | 31–58, 61–113 | READ AT THIS BASELINE |
| PE-4I.21 exclusions, production wiring false, no provider-season-2025 corpus example, calendar-2025 ledger rows sealed | `docs/PE4I21_FEATURE_ELIGIBILITY_CONTRACT.md` | 7–16, 124, 129 | HISTORICAL VERDICT for the close and the limitations. Line 7 is not D-01. Line 9 is not adopted as a current PE-5 inventory. |
| Checkpoint: PL 2025 sealed for PE-4 and GOALS; structural references only; gitignored artifacts; G1 k = 10 is research-only. The seal sentence does not establish fixture-level identity (section 5) | `docs/PE4_GOALS_RESEARCH_CHECKPOINT_AUDIT.md` | 28, 40, 51–55 | HISTORICAL VERDICT, read at this baseline |
| G1 constant, type declaration of holdout season and the policy literal, and assignment inside `goalsG1Protocol()` | `lib/debug/calibration/goals/g1/protocol.ts` | 25–27, 58–59, 106–107 | READ AT THIS BASELINE |
| G0 holdout constant, type declaration, and `goalsG0Protocol()` assignment | `lib/debug/calibration/goals/g0/protocol.ts` | 16, 37–38, 64–65 | READ AT THIS BASELINE |
| G3 holdout constant, type declaration, and `goalsG3Protocol()` assignment | `lib/debug/calibration/goals/g3/protocol.ts` | 38, 85–86, 133–134 | READ AT THIS BASELINE |
| Distributional-audit holdout constant, type declaration, and `goalsDistAuditProtocol()` assignment | `lib/debug/calibration/goals/distributional-audit/protocol.ts` | 29, 92–93, 123–124 | READ AT THIS BASELINE |
| Market-calibration holdout constant, type declaration, and `goalsMcalProtocol()` assignment | `lib/debug/calibration/goals/market-calibration/protocol.ts` | 35, 100–101, 137–138 | READ AT THIS BASELINE |
| Market-calibration POC holdout constant, type declaration, and `goalsMcalPocProtocol()` assignment | `lib/debug/calibration/goals/market-calibration-poc/protocol.ts` | 42, 161–162, 211–212 | READ AT THIS BASELINE |
| Market-calibration refinement holdout constant, type declaration, and `goalsMcalRefProtocol()` assignment | `lib/debug/calibration/goals/market-calibration-refinement/protocol.ts` | 39, 131, 134, 181, 184 | READ AT THIS BASELINE |
| Recent attack/defense holdout constant, type declaration, and `goalsRadProtocol()` assignment | `lib/debug/calibration/goals/recent-attack-defense/protocol.ts` | 47, 96–97, 148–149 | READ AT THIS BASELINE |
| Rest/schedule holdout constant, type declaration, and `goalsRestProtocol()` assignment | `lib/debug/calibration/goals/rest-schedule/protocol.ts` | 35, 115–116, 159–160 | READ AT THIS BASELINE |
| GOALS season constants | `lib/debug/calibration/goals/types.ts` | 15–17 | READ AT THIS BASELINE |
| Dataset builder emits 2023/2024 only and rejects holdout season 2025; default competition 39 | `lib/debug/calibration/goals/build-dataset.ts` | 71–73, 85–99, 119–127 | READ AT THIS BASELINE |
| `CalibrationRow.season` is typed `string`. The type alone does not define provider-season versus calendar-year semantics | `lib/debug/calibration/types.ts` | 41–48 | READ AT THIS BASELINE |
| PE-5.2 2025 exclusion. The protocol reports fail-closed behavior when `classifyHoldoutForResearch` reports provider season 2025 or a calendar-2025 kickoff. No sealed 2025 outcome read. The citation is the protocol’s report, not a direct call site | `docs/PE5_2_OFFLINE_EVIDENCE_PROTOCOL.md` | 21, 62–64 | READ AT THIS BASELINE |
| PE-5.3D stops a plan on a 2025 season or calendar kickoff and does not read sealed 2025 artifacts | `docs/PE5_3D_OFFLINE_PROBE_RUNNER.md` | 70 | READ AT THIS BASELINE |
| PE-5.4B 2025 holdout boundary, deny-before-reserve, live pilot NO-GO | `docs/PE5_4B_LIVE_ACQUISITION_SAFETY_DESIGN.md` | 65, 490, 790–802 | READ AT THIS BASELINE |
| Git ignores offline calibration artifacts and prospective capture data | `.gitignore` | 37–41 | READ AT THIS BASELINE |
| Owner approval of Option 1 with both clarifications. Option 1 is the current fail-closed separation and the authority for leaving fixture-level identity UNKNOWN. It is not permanent separation | This file, sections 2, 3, 8, and 12 | — | OWNER DECISION |
| Fixture-level identity and overlap among the named populations | Section 12 | — | UNKNOWN |

The findings’ numeric O/E remarks are cited only as evidence that the investigation used 2025 outcomes. They were not recomputed.

## 16. Limits of this record

- Option 1, including both clarifications, is an owner decision recorded here. The continuity file did not contain the title “Option 1”. The title is the owner’s name for the approved choice. Option 1 is current fail-closed separation. It is not the register’s permanent-separation alternative. A later identity resolution requires a separately authorized protocol.
- D-01 required identification of used and protected 2025 populations. Preserving fixture-level identity as UNKNOWN is Option 1. It is not a universal requirement imposed by D-01.
- The RC2 used-season prohibition in sections 6 and 8 is scoped to the RC2 Premier League populations distinguished in section 3.1. Part 3 of section 8 limits the additional 2023/2024 overlap restriction to Premier League / provider competition `39` and to rows whose competition identity cannot be proven outside that population. A documented different competition id is outside that specific restriction. Other PE-4, PE-5, GOALS, and calendar-2025 restrictions stay in force on their own text.
- The nine GOALS 2025 holdout constants are cited in their own protocol scopes. They are not claimed to be one fixture-level population. The checkpoint seal does not establish that identity.
- `dev_or_conf_eligible` is a PE-4 classifier branch. It is not unseen-validation eligibility.
- D-01 still contains the sentence that D-04 is undecided. That sentence is historical text in D-01. This file is the later decision and does not edit D-01.
- Gate B remains unmet. Research Complete remains not achieved. D-05 remains pending.
- No sealed outcome file was opened. Every population distinction above is a distinction among names and protocol rules.
- PE-4I.21’s statement that DEV rows contain none of the calendar-2025 outcomes was read as that contract’s text. The ledger was not re-counted.
- PE-5 orchestrator source was not re-opened. PE-5 restrictions are cited from the PE-5 documents above. The design’s deny-before-reserve sentence is the design’s sentence.
- No protocol text was amended. No scoring was authorized. No parameter was promoted.
