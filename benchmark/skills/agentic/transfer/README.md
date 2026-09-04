# Test a copy-and-adapt recipe workflow

The completed study and adoption decision are in [RESULTS.md](RESULTS.md).
The original frozen run has two confirmed grader fairness defects and incomplete token accounting for six interrupted attempts.
The commands below describe that historical protocol; a fresh confirmatory run must incorporate the post-run corrections and receive a new independent freeze.
`postrun.mjs` and `saved-audit.mjs` preserve original measurements while rechecking saved artifacts with the archived runtime.
`postrun-tests.mjs` verifies legitimate alternative solutions as well as a broken implementation.

This suite tests the combined workflow of a short Skill router, a direct recipe copy, and task-specific adaptation.
It compares that candidate with ordinary docs and current Skills on eight new consumer tasks.
The recipe and task authors work independently; recipe contents must not be tuned from these task answers.

The [protocol](PROTOCOL.md) fixes the quality threshold, cost threshold, allocation order, all-attempt accounting, and limits on claims before measurement.
The task requirement matrices map disclosed behavior to public and hidden checks.
Positive fixtures and deliberately broken implementations calibrate the checking system before any learner runs.
An independent pre-run audit must resolve material coverage and fairness findings.

## Run offline checks and freeze inputs

```shell
npm run build:typescript
npm run check:skill-agentic
npm run benchmark:skills:transfer:preflight
```

Preflight requires `AUDIT.md` to contain the independent review's final ready disposition, runs all transfer tests, and records hashes of the complete harness, support code, conditions, tasks, runtime, and settings.
If a checked source changes, the live runner refuses to start until preflight is repeated.
Every live run uses a new evidence directory.
The existing signed-in provider, virtual-tool limits, approval boundaries, and artifact isolation remain in force.

## Run the fixed experiment

```shell
npm run benchmark:skills:transfer -- --output /absolute/durable/path/recipe-transfer
npm run benchmark:skills:transfer:analyze -- --input /absolute/durable/path/recipe-transfer
```

The fixed run has 240 attempts, eight task families, five repetitions, two allocation-order seeds, three assigned conditions, and six concurrent fresh conversations on `gpt-5.6-luna` at low effort.
The timer includes reading, model work, checks, repairs, and final grading, including failed attempts.
Shared setup and independent audit costs are reported separately.
The report distinguishes total tokens from uncached tokens and treats interrupted usage as incomplete.

The candidate must copy a recipe before authoring an adapter, but correctness is judged independently of that process.
Copy counts, exact retained source lines, and parsed helper retention are diagnostic proxies; they never turn a failing artifact into a success.
The primary comparison uses every attempt assigned to a condition, even when the workflow is unsuccessful.

## Interpret the evidence

Keep the frozen report and all attempt traces.
Apply the predeclared success-preservation and uncached-cost gates before considering any replacement.
The numeric gate alone is insufficient: an independent artifact review must also find no unresolved critical behavior or grader defect.
Any newly discovered checks are exploratory and stay separate from the original scores.
Eight task clusters can leave the answer inconclusive; additional repetitions do not turn them into new task families.
