# Field shell cost check — 2026-09-15

## Decision

The final bare-field refresh comparison is **inconclusive against the predeclared 2% practical threshold**.
It is neither a performance win nor proof of equivalence.
The shell adds authoring capabilities, with a measured component-only package cost of 3,295 minified JavaScript bytes.

## Runtime

| Candidate                                         | Baseline / candidate mean batch time | Improvement | 95% interval       | Verdict at 2% |
| ------------------------------------------------- | ------------------------------------ | ----------- | ------------------ | ------------- |
| Initial shell with repeated participant scans     | 10.34 / 12.02 ms                     | −14.04%     | −14.83% to −13.23% | Credible loss |
| Single participant pass, retaining child snapshot | 10.26 / 10.99 ms                     | −6.70%      | −8.84% to −4.51%   | Credible loss |
| Named slot flags and derived section visibility   | 10.41 / 10.57 ms                     | −1.51%      | −2.62% to −0.38%   | Inconclusive  |

Each batch performs 5,000 operations.
Improvement is the geometric baseline/candidate latency ratio minus one, so negative values mean slower.
Final elapsed time increased approximately 1.53%, or 0.032 microseconds per operation.
The interval excludes zero but crosses the practical threshold; it does not establish a meaningful regression or equivalence.

## Executable size

Component mode externalizes BaseElement, templating, and signals through the existing reduction measurement harness.
Standalone mode includes their runtime cost.
These are uncompressed minified executable JavaScript bytes, excluding declarations and source maps.

| Entry        | Mode       | Baseline |   Final |  Delta |
| ------------ | ---------- | -------: | ------: | -----: |
| field        | component  |    8,524 |  11,886 | +3,362 |
| field        | standalone |   27,173 |  30,544 | +3,371 |
| full-library | component  |  184,229 | 187,524 | +3,295 |
| full-library | standalone |  202,990 | 206,287 | +3,297 |

## Method and scope

Used the existing `reduction/field-refresh` workload in `run.mjs`, changing only the outer workload selection and resolving Playwright from the repository for the retained external harness.
Each operation toggles an authored native input's value, calls `field.refresh()`, and asserts `field.filled`; that getter also refreshes, consistently in both versions.
Each batch includes the existing two Promise microtask drains.
Each fresh Chromium process ran five warmup batches and thirty recorded batches, with unchanged timer-resolution and correctness checks.
Five independent pairs were counterbalanced B/C, C/B, B/C, C/B, B/C for each candidate; every round used fresh baseline runs.
The paired Student-t comparison used mean batch milliseconds and a 2% minimum practical effect.
All assertions passed, with no page errors.
The coordinator stopped competing build, test, and browser work during each measurement slot.

This checks existing synchronous refresh behavior, not mounting, layout, paint, new feature interactions, or application performance.
Environment: Chromium `153.0.8010.12`, Node `v24.16.0`, Rolldown `1.2.7`, `Apple M5 Max`, `darwin 25.6.0`.
The baseline source snapshot exactly matched the preceding parity measurement's source hashes, and fresh baseline full-library artifacts matched its bytes and hashes.

## Reproduction and evidence

Artifacts: `/Users/jonathan/Documents/Codex/outputs/base-field-shell-2026-09-15`.
Top-level logs and `candidate-bundles` contain final results; `first-candidate` and `single-pass-candidate` preserve previous rounds.
The directory retains `field-refresh.mjs`, the experiment plan, five raw logs per condition, comparison output, and both bundle directories' `sizes.json` with complete source, artifact, dependency-lock, and tool metadata.

```sh
node components/base/benchmark/reduction/measure.mjs PACKAGE_DIRECTORY OUTPUT_DIRECTORY
node /Users/jonathan/Documents/Codex/outputs/base-field-shell-2026-09-15/field-refresh.mjs OUTPUT_DIRECTORY --confirmed-quiet-slot
```

Analyze matching logs with the benchmark-performance skill's `compare_benchmarks.py`, using `--metric meanMilliseconds --minimum-effect 0.02` and five matching `--baseline` / `--candidate` paths.

| Artifact                 | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| Baseline full standalone | `9f66f6e43c6461f25b0aaaa768bbfb39f0caee937e252d4a50118aba52bc326a` |
| Final full standalone    | `ef2b124c267d6ee1d9480845c30ecb11feb8acc6a28a2d8298131ae06f725e34` |
| Final full component     | `bf88fa4d4df24e2f2963fab11c470476ad5d9228faa8ff8e9902434f458cd526` |
| Final Field source       | `b05d9de39fb90977235758dc7419b5d8b1265d27a15625a5957baa738e92e40b` |
| Package lock             | `0baa309ece9bbd67dee7c45920b7b7f96ee0dd72f5a84b101cb6089f61bfe178` |
