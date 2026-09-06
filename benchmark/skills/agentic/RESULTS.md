# Three-way unfamiliar-task evaluation — 2026-08-31

The minimal guidance and recipe design reduced cost, but did not demonstrate preserved artifact quality.
Keep the current semantic references available; do not replace them wholesale with the tested minimal variant.
Against ordinary documentation, the minimal design is a promising candidate for further work, not an established improvement across correctness, uncached tokens, and time.

## Completed experiment

Ran 240 fresh conversations: eight unfamiliar task families × three conditions × five repetitions × two execution-order seeds.
The model was `gpt-5.6-luna`, reasoning effort `low`, with six concurrent conversations, 32 actions, four public checks, and a 240-second deadline per attempt.
All 240 conversations completed with full cumulative token telemetry; there were no timeouts, missing usage records, or infrastructure failures.
Live experiment wall time was 25 minutes 48 seconds.
Package runtime, documents, task prompts, and graders were frozen; the host runtime fingerprint also remained unchanged.

All arms had the same catalog, ordinary READMEs, declarations, and tools.
The current arm additionally offered existing Skills and references.
The minimal arm offered short package routers and task-independent TypeScript scaffolds extracted from existing quick-start recipes.
Agents chose which material to read and whether to copy it.

Success required strict compilation, a coarse retained-package-import check, public smoke checks, withheld behavioral checks, and completion within the shared budget.
The grader did not reward document paths, terminology, or resemblance to a fixture.
The tasks required application adapters and edge cases beyond the existing quick-starts.
“Unfamiliar” means fresh evaluation conversations and newly authored tasks, not a claim about model training data.

## Results including every failed attempt

All three score versions are shown: the original frozen grader, the fairness-corrected grader, and the final post hoc quality audit prompted by a condition-blind source review.
The quality audit is an exploratory assessment of disclosed requirements, not a replacement for the preregistered scores or a claim of complete correctness.
Token columns are sums over all 80 attempts in each condition, including failures.
Elapsed time is the mean per attempt from fresh conversation startup through final grading, including discovery, generation, checks, and repairs.

| Condition         | Frozen success | Corrected success | Audited success | Total tokens | Uncached tokens | Mean elapsed |
| ----------------- | -------------: | ----------------: | --------------: | -----------: | --------------: | -----------: |
| Ordinary docs     |  49/80 (61.3%) |     58/80 (72.5%) |   43/80 (53.8%) |   10,928,774 |       1,426,054 |        37.8s |
| Current Skills    |  58/80 (72.5%) |     67/80 (83.8%) |   50/80 (62.5%) |   12,726,099 |       1,670,483 |        41.0s |
| Minimal + recipes |  51/80 (63.7%) |     61/80 (76.3%) |   46/80 (57.5%) |    9,285,711 |       1,338,447 |        35.9s |

Compared with current Skills, the minimal design used 27.0% fewer total tokens, 19.9% fewer uncached tokens, and 12.4% less elapsed time, while producing four fewer audit-passing artifacts per 80 attempts.
Compared with ordinary docs, it used 15.0% fewer total tokens, 6.1% fewer uncached tokens, and 4.9% less time, with three more audit-passing artifacts.
These percentages are ratios of the pooled arithmetic totals or means.
They describe an observed tradeoff, not evidence that lower success caused the lower cost.

Total tokens include cached input plus output; uncached tokens subtract cached input.
Reasoning tokens are already in output and are not counted twice.
Initial installation/build and shared provider startup are outside the per-attempt timer.
The fairness replay took a separate 73.2 seconds and the two additional quality probes took 9.6 seconds of wall time; neither changed the recorded agent costs.

## Uncertainty and execution order

The paired analysis averages repetitions within each task before calculating exploratory, unadjusted 95% Student-t intervals across eight task clusters.
There are eight task clusters, not 80 independent task types per condition.
Success comparisons below use the post hoc quality audit; every earlier comparison is retained in its original evidence directory.

| Comparison        | Success difference, 95% interval | Total tokens per attempt, difference | Uncached tokens per attempt, difference | Elapsed difference |
| ----------------- | -------------------------------: | -----------------------------------: | --------------------------------------: | -----------------: |
| Current − docs    |             +8.8pp [−6.4, +23.9] |            +22,467 [+1,566, +43,367] |                   +3,055 [+960, +5,150] | +3.2s [+0.4, +6.0] |
| Minimal − docs    |            +3.8pp [−11.0, +18.5] |            −20,538 [−42,656, +1,579] |                   −1,095 [−2,883, +693] | −1.8s [−5.0, +1.3] |
| Minimal − current |             −5.0pp [−11.3, +1.3] |            −43,005 [−78,758, −7,252] |                 −4,150 [−6,881, −1,420] | −5.1s [−9.7, −0.4] |

The supplemental geometric analysis weights relative changes equally by task rather than by token volume.
It estimates minimal-versus-docs total-token change at −12.6% [−21.7%, −2.5%], uncached change at −4.8% [−12.4%, +3.6%], and elapsed change at −4.4% [−11.1%, +2.8%].
The arithmetic total-token interval crosses zero, so the conclusion depends on the estimand; the geometric result does not replace that caveat.

| Condition         | Seed 1709 success | Seed 4201 success |
| ----------------- | ----------------: | ----------------: |
| Ordinary docs     |     20/40 (50.0%) |     23/40 (57.5%) |
| Current Skills    |     25/40 (62.5%) |     25/40 (62.5%) |
| Minimal + recipes |     22/40 (55.0%) |     24/40 (60.0%) |

Minimal used fewer total tokens than docs in both seeds, but seed 4201 used 474 more uncached tokens per attempt and took 0.1 seconds longer.
Current Skills cost more than docs in both seeds.
Minimal success was below current success in both seeds.
The predeclared rule required preserved success, at least one practically useful 10% efficiency gain, no material regression elsewhere, consistent seed direction, and inspection of task failures.
The minimal replacement has not established success preservation; all three audited success-difference intervals cross zero.
Its comparison with docs remains inconclusive, and neither comparison supports broad adoption of the minimal design.

## What failed and what was reused

| Task                          | Ordinary docs | Current Skills | Minimal + recipes |
| ----------------------------- | ------------: | -------------: | ----------------: |
| Reversible route catalog      |         10/10 |          10/10 |             10/10 |
| Backpressured batch operation |          2/10 |           1/10 |              0/10 |
| Typed inventory HTTP handler  |          4/10 |           8/10 |              8/10 |
| Reactive leaderboard          |          7/10 |          10/10 |              8/10 |
| Deferred reactive projection  |          2/10 |           1/10 |              1/10 |
| Owned document channel        |          8/10 |           9/10 |              9/10 |
| Opaque cursor                 |         10/10 |          10/10 |             10/10 |
| Mixed resource scope          |          0/10 |           1/10 |              0/10 |

The retained failures concern meaningful semantics: nested work/cleanup errors, synchronous initial publication, invalid reactive writes, route validation, cancellation/backpressure, subscription delivery, explicit invalid option values, and sparse arrays.
Mixed resource cleanup is a conspicuous gap across all three designs: only one of 30 artifacts passed.
Current guidance helped observed correctness on HTTP and leaderboard tasks, while minimal guidance lost successes on batch and deferred-effect tasks relative to ordinary docs.
The HTTP and messaging results suggest narrower candidates worth testing; ten attempts per task and condition do not justify a targeted production claim yet.

Current-arm agents read Skills in 78/80 attempts and recipe references in 76/80.
Minimal-arm agents read scaffold files in 63/80 attempts, but invoked the copy tool in only 1/80.
The one copy attempt was an inventory-handler success.
Average distinct documents read were 4.29 for docs, 7.64 for current Skills, and 5.09 for minimal guidance.
The experiment therefore provides stronger evidence about selective delivery and reading than about a dependable direct-copy workflow.
Reading a scaffold can still influence generated code; copy counts alone do not measure all code reuse.

## Independent audit and transparent corrections

An independent reviewer examined frozen prompts and graders without condition materials or results.
The audit found three fairness problems: cursor encoding rejected extra input properties without a disclosed requirement, inventory grading required a particular Allow-header order, and the import gate omitted the legitimate HTTP handler subpath.
The current source now removes those restrictions, with focused regression tests.

Every saved artifact was replayed against the archived runtime and original frozen grader, then regraded with only those three corrections.
All 240 original grades reproduced exactly.
The cursor correction changed 28 outcomes; the two HTTP corrections changed no final outcomes.
No inventory attempt encountered the public import-gate failure, so that gate did not change observed repair trajectories.
Original success counts remain preserved: docs 49/80, current 58/80, minimal 51/80.
No conversations were rerun or selectively discarded, and no costs were replaced by successful-attempt-only costs.

A second reviewer inspected 14 deterministically selected, anonymized artifacts without condition labels, document histories, or test results.
The source review confirmed missing subscription delivery, omitted disabled-state publication, and incorrect error-suppression nesting.
It also found two concrete false-positive gaps: explicit `highWaterMark: null` silently became the default despite requiring a supplied finite non-negative integer, and sparse item arrays bypassed finite-number validation.
The latter can yield `undefined` items and `NaN` projections.

Those two disclosed-requirement probes were appended to the saved hidden programs and run against all 60 affected artifacts using the same archived runtime.
All previous hidden checks remained in place.
The probes changed 47 earlier corrected passes to failures: 26 batch artifacts and 21 deferred projections.
They changed no prior failure to a pass.
This post hoc audit materially lowers the apparent success rates and is preserved separately in `quality/`, alongside the frozen and fairness-corrected results.
No further coverage expansion was performed for this evaluation.

The retained-import check is coarse evidence of capability use, not proof that an imported function does the work.
Behavioral coverage does not establish every architectural property, such as actual buffer detachment or exactly-once internal subscription cleanup.
These are Node-compatible integration tasks on one model/effort setting and one shared host/service, not browser UI or production-project evaluations.
The model identifier is an alias, not an immutable snapshot.

## Changes and expected impact

Added the reusable three-condition harness, fresh discovery and repair loops, frozen runtime/material evidence, independent behavioral grading, complete usage accounting, paired analysis, and saved-artifact replay.
Corrected the three grader fairness flaws, added the two uncovered validation checks and regression fixtures, and retained all three score versions.
The current consumer Skills have not been replaced by the experimental minimal representation.

The next design should combine short routing with small executable recipes that preserve difficult semantics, especially cleanup/error composition, validation, and reactive lifecycle behavior.
Simply exposing generic quick-start files did not create a reliable copy-and-adapt workflow.
Test that next design on a new held-out task set; using these failures to author a recipe and then claiming success on these same tasks would overstate generalization.
Expected impact is more selective reading and fewer semantic repairs, but no additional token or success improvement is claimed until measured.
The immediate benefit is avoiding adoption of an unproven replacement and preventing known false-positive artifacts from passing future evaluations.

## Validation

The package TypeScript build passed before the live run.
All 30 focused evaluation tests pass, covering the golden artifacts, compiling semantic mutants, frozen discovery and tools, provider protocol and telemetry, paired statistics, and the new fairness/validation regressions.
All 68 package Skills and the repository Skill validate.
The new source passes Biome, the report/protocol Markdown passes dprint, and the diff whitespace check passes.
Required repository-wide `npm run verify` remains blocked by unrelated unused Base files/exports (`components/base/src/.experiment.ts` and `captureError` in `components/base/src/lib/.internals.ts`).
The older `check:skill-bench` suite also remains blocked by missing catalog/usage-task coverage for the concurrently added `@serve-tools/client-dom-fragment` package.

## Evidence and reproduction

The full evidence directory is `/Users/jonathan/Documents/Codex/2026-08-31/skill-evaluation-3way`.
It contains the original plan, hashed conditions, archived runtime, frozen harness, all 240 artifacts and traces, raw records, reports, both independent audits, diagnostics, and separate `corrected/` and `quality/` directories with programs, provenance, and analysis.
See [README.md](README.md) for the frozen measurement protocol and commands.
No git publication, registry mutation, or Slack message was performed.
