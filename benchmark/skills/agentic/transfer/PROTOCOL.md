# Frozen recipe-transfer evaluation protocol

## Question and scope

Does a prescribed copy-and-adapt workflow with small tested semantic recipes produce correct unfamiliar consumer integrations with less uncached text processing and elapsed time than current package Skills?
Ordinary documentation is a secondary baseline.
This tests the combined materials and workflow, not the isolated effect of document length or a copy tool.
The scope is eight Node-compatible package capability families on one model and effort setting.
Complete coverage of the written contracts is the goal; no finite suite proves all possible package behavior or all future agent tasks.

## Before measurement

The recipe author may inspect package contracts and historical failure categories but may not inspect the new task prompts, solutions, or graders.
The task author may inspect package contracts but may not inspect the new recipe bundle.
Each task has a disclosed requirement-to-check matrix, positive golden artifact, public smoke feedback, withheld boundary/property/interaction checks, and compiling semantic mutants covering its high-risk categories.
Goldens must pass and mutants must be rejected before the live run.
An independent reviewer examines prompts, matrices, goldens, mutants, and grading code without recipe materials or outcomes, checking for both unfair restrictions and unobserved requirements.
Resolve material findings before freezing; do not weaken requirements to make a candidate pass.
Recipe helpers must compile and pass their own behavior tests independently of the held-out task corpus.

## Assigned conditions

- `docs`: existing READMEs, public declarations, package catalog, and virtual tools.
- `current`: the same baseline plus current package Skills and focused references.
- `minimal`: the same ordinary baseline plus a short router and independently authored executable recipes; its prescribed workflow requires copying a relevant recipe before authoring the adapter.

All conditions have identical action/check/time budgets and the same virtual tools.
The candidate copy gate is part of the tested workflow and is counted in cost and failures.
Artifact correctness never depends on document names, copied text, helper names, or style.
Copy compliance and retained source text are separate descriptive diagnostics; no failed or noncompliant attempts are dropped.
Exact retained lines and parsed helper structure with external syntactic references are descriptive reuse proxies, not proof of execution, semantic lineage, or all possible reuse.
Renamed or substantially rewritten helpers can evade these diagnostics.

## Live measurement

Use eight new task families, five repetitions, two allocation-order seeds (7349 and 9811), and three conditions: 240 planned attempts.
Use `gpt-5.6-luna`, effort `low`, six concurrent fresh conversations, 32 tool actions, four public checks, and a 240-second per-attempt deadline.
Shuffle task/repetition blocks within each seed and allocate the six possible treatment permutations in shuffled balanced cycles.
These seeds control allocation order; six overlapping workers can start and finish jobs in different orders.
Record allocation index, worker, dispatch/start/end timestamps, first successful copy, and first authored write separately; the legacy first-write field includes copies.
Freeze prompts, test programs, package runtime, condition files, recipe sources/tests, harness, analysis scripts, and this protocol with hashes before the first learner attempt.
Record model identifiers, environment and host load, cache-token counters, all tool calls/errors, artifacts, and original terminal grades.
Do not retune or select prompts, conditions, or budgets from partial results.

Include every started attempt in the assigned-condition comparison, including failures, timeouts, and incomplete workflow execution.
Measure each attempt from fresh conversation startup through final hidden grading, including discovery, generation, public checks, and repairs.
Report shared setup and later independent audit work separately.
Recipe and harness authoring are one-time preparation, outside the per-attempt comparison; do not claim net lifetime savings or a break-even point without measuring those preparation and maintenance costs.
Total tokens equal input plus output; uncached tokens equal input minus cached input plus output.
Reasoning is already in output and is not added again.
Missing or interrupted usage is a lower bound; it cannot support a complete token-efficiency claim.
Stop further allocation on a worker infrastructure error or three consecutive attempts without measurable model work on one worker, allow in-flight attempts to finish, and retain the incomplete plan and failure reason without automatic replacement trials.

## Predeclared replacement gate

The primary comparison is `minimal` versus `current`.
Pair by task, seed, and repetition; average within each task before computing two-sided 95% Student-t intervals across the eight task clusters.
Use task-mean log ratios for relative cost/time intervals and task-mean paired differences for success.
Repetitions and seeds are not independent new task families.

Require all 240 unique planned attempts with complete usage, 80 complete primary pairs, and all eight task clusters before evaluating a replacement.
A replacement is supported only if all of the following hold:

1. The lower success-difference confidence bound is at least −5 percentage points.
2. The upper uncached-token ratio confidence bound is at most −15%.
3. The upper elapsed-time ratio confidence bound is at most +10%.
4. Each seed's point estimate favors the candidate on success and uncached tokens.
5. No unresolved critical correctness, ownership, cancellation, or data-integrity failure remains in the candidate artifacts or grader.

Using two-sided intervals is deliberately conservative for these directional gates.
With only eight task clusters, insufficient precision is a valid inconclusive outcome; do not substitute pooled-attempt intervals or relax the margin afterward.
Report total tokens and ordinary-doc comparisons as secondary results, without using a favorable secondary endpoint to bypass the primary gate.
Cost per successful artifact is also secondary and includes the costs of failed attempts.

## Independent artifact review and reporting

After the run, give an independent reviewer a deterministic stratified sample of anonymized artifacts and their prompts, without condition labels, read histories, or measured scores.
Investigate definite missing behaviors across every affected saved artifact, preserving the original frozen grades and costs.
Any new post-run checks are explicitly exploratory and cannot replace the preregistered endpoint or turn an inconclusive trial into a confirmatory win.
A discovered material grader defect prevents a positive adoption claim until a fresh independently frozen evaluation resolves it.

The plain-language report must answer: what was tested, whether it worked, how much text/time it used including failures, what changed in the repository, and whether any package or end-user improvement has actually been demonstrated.
Keep measured results, expected benefits, and unresolved uncertainty separate.
This use of task-specific checks, edge cases, logging, and held-out data follows [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).
