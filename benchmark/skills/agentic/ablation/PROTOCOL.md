# Optional helper ablation: frozen decision protocol

## Question

Do small optional executable helpers improve successful delivery or reduce effort compared with identical minimal instructions alone?
Ordinary documentation and current package Skills provide secondary context.
This is a new experiment; the previous post-run scores are development evidence only.

## Conditions and population

Use four conditions: docs, current, minimal, helpers.
Docs and current retain the existing ordinary-document and current-Skill baselines.
Minimal and helpers receive byte-identical short guidance and discovery instructions.
Only helpers has twelve optional code files and their capability index.
Every condition has the same tools; none requires copying.
Helper authors must not inspect new task prompts, graders, fixtures, or learner outputs.
Generic contract defects found before measurement may be repaired with a retained development snapshot and a new helper freeze; no helper tuning from learner outcomes is permitted.

Use 24 fresh bounded consumer tasks, two within each of twelve capability families, on the same frozen Node-compatible package runtime.
Tasks include lifecycle-sensitive integrations and simple integrations where helpers may add no value.
Do not label a task as a known helper win before measurement.
Task authors cannot read the helper bundle.

## Grader calibration before any measured attempt

Every task must have explicit behavior, validation, error-delivery, ownership, and output requirements.
Do not infer rejection of extra properties or synchronous-only validation when the prompt does not demand it.
The original author supplies one working fixture and at least two compiling semantic mutations that pass public smoke and fail withheld checks.
A separate author receives only task prompts and public package contracts and writes another correct implementation before seeing the grader or original fixture.
Record that independent implementation's initial hash before validation.
Any disagreement goes to independent prompt-semantic review; resolve unfair or missing checks before freezing.
An outcome-blind review must clear every task and both positive implementations.
No grade may reward reading a document, copying a file, retaining a helper name, or stylistic similarity.

## Size and allocation

Run all 192 planned attempts: 24 tasks × four conditions × two fresh conversations.
The two allocation-order seeds are 13007 and 17011, with one repetition per seed.
Within each seed, shuffle task blocks and allocate all 24 possible four-condition orders once in a shuffled cycle.
Six overlapping workers can start and finish in different orders; record allocation, dispatch, start, end, and worker identity.
Use gpt-5.6-luna at low effort, 32 tool actions, four public checks, and a 240-second agent deadline.
Do not replace tasks or trials, stop for a favorable result, or retune materials from partial outcomes.
Stop allocation only on infrastructure failure or three consecutive attempts without measurable model work on one worker; retain an incomplete plan if that occurs.

The prior eight-task success-difference standard deviation was approximately 0.33.
That suggests roughly ±14 percentage points for 24 independent task clusters or ±21 points for twelve similarly variable family clusters, before any benefit from the new design.
The planned budget can identify large consistent effects and diagnose concrete failures; it does not guarantee a decisive five-point noninferiority result.
More repeats of the same tasks would not create more independent capability families.

## Complete cost and failure accounting

The attempt timer includes discovery, generation, checks, repairs, accounting grace, and final hidden grading.
Report shared setup, provider startup, preparation, and later review separately; do not claim lifetime savings from per-attempt totals.
All attempts remain in success, token, and elapsed denominators.
Report total tokens, uncached tokens, elapsed time, and total arm effort divided by correct artifacts; zero successes means infinite effort per success.
Reasoning tokens are included in output, not added again.

On action-budget excess, deny further tools immediately, preserve a failed logical status, and permit up to ten seconds for a normal backend finish.
After a terminal backend event allow a 100ms quiet drain for cumulative usage updates.
Natural backend completion plus observed cumulative usage supports reported usage completeness; the protocol does not provide an independent final billing acknowledgement.
Hard timeout, forced cancellation, isolation violation, missing usage, or uncertain finality remains explicitly incomplete and cannot support a token-efficiency adoption claim.
Before measurement, exercise normal finish, tool exhaustion, late usage, missing usage, cancellation, and denied extra writes in unit tests plus separately recorded bounded live smoke attempts.
Do not silently impute missing tokens or drop those failures.

## Analysis and decision

The sole primary comparison is helpers minus minimal.
Pair by task and allocation seed, average the two seed contrasts within task, then average the two task contrasts within each of the twelve families.
Record all 48 matched primary pairs and their discordances.
Use exhaustive family-level sign-flip inversion for two-sided 95% uncertainty intervals, stating the common-location residual-symmetry assumption and grid resolution.
Also report task-level raw contrasts and twelve-family Student-t intervals as a sensitivity check.
Family cost contrasts use the ratio of the two arms' means across all four attempts in that family, so failures remain in the denominator.
Constant family contrasts or zero discordant outcomes must not produce a claim of exact equivalence from a zero-width interval.
Report the zero-discordance bound only when no matched primary pair is discordant; it treats the twelve families as independent units and classifies degenerate inference as inconclusive.

A general replacement claim requires all 192 unique planned records and complete usage, a success lower confidence bound at least −5 points, an uncached-cost upper relative bound at most −15%, and an elapsed upper relative bound at most +10%.
It also requires no unresolved material grader or artifact defect.
Report supported, fails target, or inconclusive; a favorable mean alone is insufficient.
The current/docs comparisons and family-specific results are descriptive and cannot bypass the primary rule.
For each family report correctness, all-attempt effort, and voluntary helper use; with only four attempts per arm per family, label promising cases as candidates for packaging rather than general proof.

## Independent final review

After the run, select one artifact per task/condition by a fixed hash of attempt identity, independent of outcome.
Review anonymized prompt/source pairs without condition labels, read histories, or scores.
Investigate definite missing behavior across every affected saved artifact using the archived runtime.
Keep any newly added probes and rescored outcomes exploratory, preserve the frozen endpoint, and prohibit a positive confirmatory claim after material post-run grader defects.

The final plain-language report must explain what was tested, what worked, what cost it took including failures, which helpers appear useful or unnecessary, and what changed in packages.
No agent-efficiency result is a package-runtime performance result.
