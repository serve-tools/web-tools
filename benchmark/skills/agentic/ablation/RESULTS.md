# Optional helper evaluation results — August 31, 2026

Adding optional reusable code to a short guide did not demonstrate savings in this experiment.
Across 192 attempts, helpers used 5.0% more uncached tokens and 1.3% more elapsed time than the identical short guide alone.
After independent review and corrective checks, helpers produced one additional passing artifact out of 48; the uncertainty is too large to call that a reliability improvement.
The evidence does not support replacing current package Skills with this helper bundle.

## What we tested

We compared ordinary documentation, current package Skills, a short guide, and that same short guide with twelve optional reusable helpers.
The last two conditions had byte-identical instructions and discovery guidance, isolating the added helper files and their capability index.
Agents could discover materials, write code, test, and repair it; copying was never required.
Tests judged observable behavior and required public API usage, without rewarding document reads or source similarity.

There were 24 fresh consumer tasks across twelve package families, two fresh conversations per task and condition, and 48 attempts per condition.
Task authors and helper authors were mutually blind during preparation.
The corpus included cancellation, cleanup, messaging, routing, typed HTTP, binary framing, observables, streaming, and scheduling, including simple tasks where scaffolding might add overhead.
This evaluates Node-compatible package integrations with `gpt-5.6-luna` at low effort, not arbitrary applications or document creation.
Each attempt had 32 tool actions, four public checks, and a 240-second agent deadline.
Allocation seeds were 13007 and 17011; all 24 condition orders appeared once per seed, with six overlapping workers.
The [frozen protocol](./PROTOCOL.md) records the decision rules established before measurement.

## Results including failed attempts

The final audited scores below are exploratory because some checks were corrected after seeing outcomes.
All token and time totals are the original measured costs, including discovery, generation, public checks, repairs, failures, accounting grace, and final hidden grading.

| Materials available            | Audited success | Total tokens | Uncached tokens | Sum of attempt time | Mean per attempt |
| ------------------------------ | --------------: | -----------: | --------------: | ------------------: | ---------------: |
| Ordinary docs                  |   34/48 (70.8%) |    5,030,763 |         871,275 |           26.72 min |         33.4 sec |
| Current Skills                 |   33/48 (68.8%) |    6,523,218 |       1,034,834 |           29.97 min |         37.5 sec |
| Short guide                    |   34/48 (70.8%) |    5,591,638 |         885,334 |           27.13 min |         33.9 sec |
| Short guide + optional helpers |   35/48 (72.9%) |    5,693,698 |         929,282 |           27.47 min |         34.3 sec |

Total tokens include cached input; uncached tokens exclude cached input and include model output.
Reasoning tokens are already included in output and are not counted twice.
All 192 attempts have cumulative usage and normal backend completion under the accounting protocol, including one logical tool-budget failure whose backend was allowed to finish normally.
The protocol provides no separate final billing acknowledgment, so this is complete observed usage rather than invoice reconciliation.
The other 191 artifacts compiled and passed the public smoke check; hidden checks still rejected many of them.
No infrastructure failure stopped allocation, and no attempt was discarded or replaced.

All-attempt effort divided by audited successes gives the cost of delivering a passing artifact while also paying for unsuccessful attempts:

| Materials             | Total tokens per correct artifact | Uncached tokens per correct artifact | Attempt seconds per correct artifact |
| --------------------- | --------------------------------: | -----------------------------------: | -----------------------------------: |
| Ordinary docs         |                           147,964 |                               25,626 |                                 47.2 |
| Current Skills        |                           197,673 |                               31,359 |                                 54.5 |
| Short guide           |                           164,460 |                               26,039 |                                 47.9 |
| Short guide + helpers |                           162,677 |                               26,551 |                                 47.1 |

These ratios are descriptive; the single additional helper success is uncertain.
Before corrective grading, helper effort per success was 167,462 total tokens, 27,332 uncached tokens, and 48.5 seconds.

## What the comparison supports

The primary comparison was helpers versus the identical short guide, with uncertainty calculated across twelve capability families rather than treating every repeated attempt as independent.

| Frozen primary measure | Family-average difference |        95% interval | Preregistered decision                                                 |
| ---------------------- | ------------------------: | ------------------: | ---------------------------------------------------------------------- |
| Success rate           |     0.0 percentage points | −6.4 to +6.4 points | Inconclusive against a maximum 5-point loss                            |
| Uncached tokens        |                     +5.6% |     −5.8% to +18.5% | Fails the target of at least 15% savings                               |
| Elapsed time           |                     +1.2% |      −6.3% to +9.4% | Supports no more than 10% slowdown; does not establish faster delivery |
| Total tokens           |                     +0.6% |     −9.5% to +11.6% | Descriptive                                                            |

The final exploratory quality recheck changes the success estimate to +2.1 points, with a −6.4 to +10.2-point interval.
It leaves token and time estimates unchanged.
Neither the original nor corrected analysis supports general helper adoption.
The post-run grader defects independently prohibit a positive confirmatory claim from this run.

Intervals use all 4,096 family-level sign flips with a common-location residual-symmetry assumption, a 0.002 probability grid for success and a 0.005 log-ratio grid for costs, expanded by one grid step.
Student-t sensitivity intervals and all 48 matched primary pairs are retained in the analysis files; the original primary comparison had six discordant pairs.
Pooled totals weight families by their cost, so they differ from equally weighted family estimates: helpers cost 1.8% more total tokens, 5.0% more uncached tokens, and 1.3% more time than the short guide.

The short guide used 14.4% fewer uncached tokens, 14.3% fewer total tokens, and 9.5% less elapsed time than current Skills in pooled totals.
This secondary comparison is promising, but equivalent quality was not established and it cannot bypass the primary decision rule.
Its family estimate was 15.3% fewer uncached tokens (95% interval 4.9% to 24.8% fewer) and 10.6% less time (0.5% to 19.7% less).
Ordinary docs had the lowest pooled token and time costs in this corpus, further weakening any blanket claim that a Skill necessarily improves efficiency.

## What agents actually reused

Helpers were read in 18 of 48 helper attempts, with zero `copy_file` calls.
Trace and source inspection found no retained helper declarations or direct helper calls.
One successful cleanup implementation resembled the helper's cleanup and error-precedence structure; manual adaptation is possible, but the resemblance does not establish causality.
Reactive-state, base64, and SSE helpers were never read.
No family has enough observations to justify a packaging decision by itself.

This is evidence about the effectiveness of offering these helpers through this discovery workflow.
It does not establish that reusable scaffolding is ineffective when it is actually adopted, or that unread helpers are unnecessary in every setting.
The detailed family table uses the original frozen success scores and explicitly labels that endpoint.

## Independent checks and corrections

Before measurement, all 24 original and 24 independently authored positive implementations passed, while 48 deliberate behavioral mutations compiled, passed public smoke, and failed hidden checks.
The independent authors' initial source hashes and prompt packets were preserved before grader feedback.
A separate outcome-blind review approved the initial task requirements and checks.

After measurement, four reviewers examined 96 anonymized prompt/source pairs selected by a fixed hash, one per task and condition.
They received no condition labels, scores, read histories, helpers, or reference implementations.
Final source-review verdicts were 80 with no definite issue, ten definite violations, and six uncertain; absence of a detected issue is not proof of correctness.
A further reviewer assessed grader fairness without seeing measured artifacts or outcomes.

That review found four kinds of unannounced restriction: requiring a particular validation-error class, requiring asynchronous callback validation, counting subscriptions in a way that rejected valid operator pipelines or early aborts, and rejecting an array where the prompt allowed a non-null object.
Separate correction programs now accept those legitimate alternatives while retaining behavioral checks.
Additional quality probes check the declared service enum, invalid binary chunk containers/types, and malformed UTF-8 percent encoding.

| Materials             | Original frozen score | Fairness corrections only | Fairness + added quality probes |
| --------------------- | --------------------: | ------------------------: | ------------------------------: |
| Ordinary docs         |                 34/48 |                     35/48 |                           34/48 |
| Current Skills        |                 33/48 |                     34/48 |                           33/48 |
| Short guide           |                 34/48 |                     36/48 |                           34/48 |
| Short guide + helpers |                 34/48 |                     35/48 |                           35/48 |

The quality probes rejected three previously passing HTTP handlers with an omitted enum constraint, plus one binary implementation temporarily rescued by the fairness correction.
The UTF-8 probe also exposed an omission shared by both reference authors, demonstrating why agreement between two implementations is not enough to prove a grader correct.
Original graders, measured records, source artifacts, and runtime remain preserved; the rechecks ran against the archived runtime without new model attempts.
A mechanical comparison confirmed all 192 identities and every non-grade record field, including usage, timing, and status, are identical across the original and both rechecks.
The runtime archive hash was also verified.
See [POSTRUN-GRADER-AUDIT.md](./POSTRUN-GRADER-AUDIT.md) for adjudication and approval of the corrective implementation.

## Total effort and limits

The live run took 18.90 minutes with six overlapping workers, consuming 22,839,317 total tokens and 3,720,725 uncached tokens.
Summing each attempt's elapsed time gives 111.30 minutes; that sum is not wall-clock duration.
Shared setup took 4.47 seconds and provider startup roughly 52–65 milliseconds per attempt.
The host used Node 24.16.0, npm 12.0.2, Codex CLI 0.150.1, and an Apple M5 Max.

Preparation took at least 60.9 minutes, measured from creation of the first new helper to run setup; earlier planning is outside that lower bound.
Authoring, calibration, infrastructure smoke runs, and independent review were additional work whose model tokens were not completely metered as part of the trial corpus.
Review began at 14:51:09 UTC, after the live run ended at 14:49:36 UTC; the audit summary records later completion and verification times.
These preparation and review costs prevent a claim of net project-wide or amortized savings.
No results from older experiments are pooled into this study.

## Changes and expected impact

This work added the four-condition benchmark, twelve optional test helpers, fresh independent task fixtures, failure-inclusive accounting, family-level analysis, blinded review packets, and saved-artifact correction checks.
It changed no public package runtime or published consumer Skill as part of this follow-up.
There is no measured package-runtime improvement or production token saving to report.

The immediate decision is to keep this helper bundle experimental and avoid adding its cost to all consumer workflows without evidence of uptake.
Shorter guidance is the more promising direction, with the observed 14% uncached-token reduction versus current Skills serving as a hypothesis for further validation rather than a promised production gain.
Any next positive claim needs fresh tasks and a revised frozen protocol incorporating the alternative error, cancellation, pipeline, and structural-object controls discovered here.
The concrete improvement is a more discriminating evaluation: it now detects both unfair test failures and plausible-looking artifacts that violate the requested behavior.

## Validation and evidence

All 67 focused tests passed: 34 original harness tests, 19 transfer tests, and 14 ablation tests, including both independent positive implementations per task, all deliberate mutations, and the new correction controls.
Package build and all 69 package/repository Skill validations passed during this work.
Final lint and diff-whitespace checks passed, with one unrelated existing lint warning.
Full `npm run verify` stopped at unrelated AUI unused-file/export findings: `components/aui/src/.experiment.ts` and `captureError` in `components/aui/src/lib/.internals.ts`.
Later verification stages did not run through that command, so this is not a clean whole-repository verification result.

Evidence directory: `/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192`.

- [Original analysis](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/analysis.json), [original records](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/records.jsonl), and [frozen plan](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/plan.json).
- [Final exploratory report](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/quality/report.md), [score changes](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/score-changes.json), and [cost-preservation verification](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/preservation-validation.json).
- [Family results](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/family-results.md), [reuse audit](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/mechanism-audit.json), and [blind-review summary](/Users/jonathan/Documents/Codex/2026-08-31/optional-helper-ablation-192/audit-summary.json).
- [Preparation timing bound](/Users/jonathan/Documents/Codex/2026-08-31/ablation-preparation/timing-bound.json), [final focused test log](/Users/jonathan/Documents/Codex/2026-08-31/ablation-preparation/final-agentic-tests.log), and [repository verification log](/Users/jonathan/Documents/Codex/2026-08-31/ablation-preparation/repository-verify-final.log).
