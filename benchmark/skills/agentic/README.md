# Agentic documentation and recipe evaluation

This experiment measures whether ordinary documentation, current package Skills, or minimal guidance with directly reusable recipes helps an agent deliver correct unfamiliar consumer artifacts.
The agent chooses its own documents, writes an artifact, runs public checks, and repairs failures within a common budget.
Hidden behavioral tests grade the delivered artifact independently of the documents, package-selection rationale, or vocabulary used in the answer.
The completed 240-attempt experiment and adoption decision are recorded in [RESULTS.md](RESULTS.md).

## Conditions

All conditions have the same installed-package name/version/description catalogue, package READMEs, public declarations, and virtual tools.
Material is frozen in memory before the run and persisted with SHA-256 hashes.

- `docs`: ordinary READMEs and public declarations.
- `current`: the same baseline material plus existing package Skills, focused references, and the suite selector.
- `minimal`: the same baseline material plus short generic package routers and clone-ready TypeScript extracted from existing compile-checked quick-start recipes.

The minimal transformation is package-wide and independent of the new task corpus.
It never uses task IDs, expected packages, hidden tests, or golden solutions to select or write a recipe.
Recipe reuse is optional: an irrelevant quick-start should not be copied merely to satisfy a process requirement.
Every condition can copy and edit virtual files; only the minimal condition additionally supplies ready-to-edit `.ts` scaffolds.
This compares documentation-delivery designs as a whole, not the isolated causal effect of one sentence or the copy tool.

## Task and grading contract

The eight newly authored task families cover typed route composition, cancellable backpressured operations, Fetch contract validation, reactive collections, MessagePort ownership, opaque cursors, resource cleanup, and deferred effects.
They require application adapters and edge cases beyond reproducing a quick-start.
They are unfamiliar to the evaluation conversations; this is not a claim about inaccessible model training data.

Each task specifies one exported `solution.ts` API, has public smoke checks for feedback, and separate withheld checks for the same disclosed requirements.
The runner never loads `packages`, `fixturePath`, or hidden test contents into model context.
Required documents, exact package sets, prose terms, and implementation similarity do not contribute to success.
For capabilities explicitly required by a task, emitted JavaScript must retain a public import from an eligible package family, including legitimate facade/subpath alternatives.
This is coarse static evidence of contract use, not proof that an imported function performs all the work.
Strict TypeScript compilation and both behavioral suites must pass, and the agent must finish within budget.
Golden fixtures and deliberately wrong artifacts validate the grader offline; those runs are not evidence of model effectiveness.
The tasks are Node-compatible integration exercises, not full browser applications or UI-quality evaluations.

## Measurement and execution

The live provider uses a signed-in local Codex app-server and starts a fresh ephemeral conversation for each attempt.
It exposes only finite virtual discovery, read, copy, write, replacement, and public-check tools.
Personal skills, memory, connectors, shell access, network tools, and delegation are excluded from the learner.
The host's ordinary global parallel-workflow guidance remains common to every condition and is recorded by path and content hash.
Platform approvals and security rules are not bypassed.
Model-generated artifacts execute in bounded child processes against a copied runtime with filesystem permissions that exclude repository sources and test files.
The trusted parent supplies test programs through stdin; hidden test files are never copied into the readable runtime.
This closes direct test/source-file access without claiming a hardened security boundary against hostile runtime exploits.
API keys and authentication contents are never read or persisted by the harness.

The timer starts before starting the individual conversation and stops after final hidden grading.
It includes document discovery, model generation, tool work, compilation, public tests, repair, and final grading.
Initial dependency installation/build and shared provider initialization are excluded.
The report also records time to the first artifact write, time after the first failed public check, action/check counts, copies, each final artifact, and full tool traces.

Total tokens are input plus output, including cached input.
Uncached tokens are input minus cached input plus output.
Reasoning tokens are already contained in output and are not added twice.
Failed attempts and timeouts remain in all success and elapsed-time denominators.
Missing usage is marked as unavailable; reported token subtotals must not be interpreted as complete costs.
Interrupted attempts retain observed counters as lower bounds and do not support complete token-cost confidence intervals.
Token counts are not dollar charges or account quota percentages.

The default experiment has eight tasks, five repetitions per task per seed, two execution-order seeds, and three conditions: 240 attempts.
Jobs are deterministically shuffled for each seed, and all model settings, action budgets, check budgets, and timeouts are shared.
Use an explicit model, and record the returned model identifier; aliases are not immutable historical snapshots.

```shell
npm ci --ignore-scripts
npm run build:typescript
npm run check:skill-agentic
npm run benchmark:skills:agentic -- --fixture
npm run benchmark:skills:agentic -- \
  --model gpt-5.6-luna --effort low \
  --runs 5 --seeds 1709,4201 --concurrency 4 \
  --output /absolute/durable/path/skill-evaluation
```

The live output directory must not contain an existing `records.jsonl`.
Keep `plan.json`, frozen `conditions.json`, all attempt artifacts/traces, `records.jsonl`, and the final report together.
Do not mix infrastructure smoke runs or a changed task/condition revision into the main comparison.
On a host where the Codex subprocess requires permission, use the normal approval mechanism; do not disable sandboxing or hooks.

Generate supplemental seed accounting and task-clustered relative comparisons after a run completes:

```shell
npm run benchmark:skills:agentic:analyze -- --input /absolute/durable/path/skill-evaluation
```

The historical 2026-08-31 grader audit also has a bounded replay command.
It verifies the archived runtime, reproduces original grades, applies only the three documented fairness corrections, and writes a separate `corrected/` evidence directory.
Its exact source assertions deliberately reject incompatible task revisions.
Agent costs are preserved; replay overhead is reported separately.

```shell
npm run benchmark:skills:agentic:rescore -- --input /absolute/durable/path/skill-evaluation
npm run benchmark:skills:agentic:analyze -- --input /absolute/durable/path/skill-evaluation/corrected
```

The same historical run also has two bounded post hoc quality probes discovered by a condition-blind artifact review.
They retain all corrected checks, audit the saved affected artifacts without model calls, and preserve results separately in `quality/`.

```shell
npm run benchmark:skills:agentic:audit -- --input /absolute/durable/path/skill-evaluation
npm run benchmark:skills:agentic:analyze -- --input /absolute/durable/path/skill-evaluation/quality
```

## Decision rule, declared before measurement

Treat a candidate as suitable for a broader trial only if artifact success is preserved and it shows a practically useful improvement (at least 10%) in total tokens, uncached tokens, or elapsed time without a material regression in the other measures.
Task-specific failures and lifecycle violations take precedence over an attractive aggregate.
Require consistent direction across both seeds and inspect paired task-clustered 95% intervals.
Repetitions are averaged within tasks before intervals are calculated; they are not independent new tasks.
The three comparisons have unadjusted exploratory intervals and do not establish family-wide significance.
Small success differences, intervals spanning zero, or too few independent tasks remain inconclusive.
Do not drop failures, retune prompts from hidden failures, or broaden claims to all skills, models, browser apps, or production work.
Preserve evidence for rejected and inconclusive approaches.
