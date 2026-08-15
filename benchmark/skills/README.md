# Package Skill evaluation benchmark

This benchmark measures whether the published `@serve-tools` Agent Skills improve package selection and implementation quality enough to justify their context, latency, and token cost.
It compares two paired documentation conditions:

- `baseline` exposes package metadata and lets the model load the selected package README.
- `skill` exposes the suite selector, package Skill discovery metadata, compact routers, and focused references.

Both conditions receive the same task and use the same model settings.
Execution order is deterministically shuffled so one condition does not consistently run first.

## Task corpus

The corpus contains three independently scored task kinds:

- `selection` covers all 24 runtime packages and tests narrow choices among adjacent packages.
- `composition` covers package compatibility, responsibility splits, lifecycle, and cleanup across package boundaries.
- `usage` asks for public-import TypeScript and checks package selection, document retrieval, required API semantics, imports, and compilation.

Several composition and usage prompts are generalized from recurring application patterns in `reve-core`, including reactive maps in Lit, typed local-storage preferences, DOM context, and SharedWorker-owned state.
They contain no project-specific source or expected answer text.

Expected selections and deterministic checks are kept out of model context.
The model never grades its own output.

## Offline validation

Run the corpus, catalog, provider-contract, compiler-sandbox, report, and perfect-fixture checks without network access:

```shell
npm run check:skill-bench
```

The fixture condition uses the same routing, grading, compilation boundary, statistics, and report generation as a live run.
It proves harness behavior rather than Skill effectiveness.

## Live paired evaluation

Build the workspaces first so generated public imports resolve during TypeScript compilation.
Then provide an OpenAI API key through the environment and select an explicit model or snapshot:

```shell
npm run build
OPENAI_API_KEY=... npm run benchmark:skills -- \
  --provider openai \
  --model gpt-5.6-luna \
  --reasoning low \
  --runs 10 \
  --output /tmp/serve-tools-skill-eval
```

The output path produces `.json` raw evidence and a `.md` summary.
Raw records include routes, selected documents, generated answers, generated files, deterministic grades, token usage, request count, context characters, and latency.
API keys and request authorization headers are never written.

Use `--task ID` or `--kind selection|composition|usage` repeatedly for narrower experiments.
Use `--variants baseline`, `--variants skill`, or the default paired conditions.
Use `--no-compile` only when measuring routing independently from implementation correctness.

Run `node benchmark/skills/run.mjs --help` for every option.

## Interpreting results

The report provides per-condition pass rates with Wilson 95% confidence intervals and paired Skill-minus-baseline differences for score, pass rate, tokens, and latency.
Paired difference intervals are withheld below five pairs.
Use at least 10 repetitions for candidate decisions, retain the same task set and model snapshot, and compare more than one execution order seed before removing or expanding Skill content.

Treat a change as an improvement only when correctness is preserved or improved and its token or latency reduction is credible across repeated paired runs.
Inspect individual failures before accepting an aggregate result; a cheaper route that selects the wrong ownership or cleanup semantics is not a win.

## Extending the corpus

Add tasks to [`tasks.mjs`](./tasks.mjs) only when they represent a distinct package choice, compatibility boundary, or observed author failure.
Every new runtime package must have at least one selection task.
Usage tasks should point to a compile-checked package recipe and add semantic terms that distinguish a merely compilable answer from the intended contract.

Keep expected answers deterministic and minimal.
Do not add an LLM judge unless a task cannot be graded from package choice, document choice, public imports, compilation, or explicit contract terms.
