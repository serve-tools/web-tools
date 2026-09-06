# Base attribute-ownership lifecycle benchmark

This benchmark measures public Field, Toggle, Number Field, and Menu component lifecycles that capture authored attributes, observe external writes, replace owned nodes, and restore the latest author state on release.
Number Field and Menu cover the two ownership families consolidated by this experiment.
Field and Toggle retain their distinct ownership implementations and catch accidental broadening of the extraction.
Every operation checks the expected final DOM state inside the timed lifecycle so a faster condition cannot skip author-state preservation or cleanup.

Build each baseline or candidate distribution before the quiet timing window:

```sh
node components/base/benchmark/ownership/build.mjs --label baseline --dist /path/to/baseline/components/base/dist --output /private/tmp/base-ownership-baseline
node components/base/benchmark/ownership/build.mjs --label candidate --dist components/base/dist --output /private/tmp/base-ownership-candidate
```

Run each build in a fresh browser process in counterbalanced baseline/candidate order.
Each run uses 500 lifecycle operations per sample, five warmup samples, and fifteen recorded samples, and writes the repository-standard `[benchmark]` JSON lines for the existing comparison script.
Do not run builds, tests, other benchmarks, browser automation, or profiling concurrently.

Smoke-check each frozen bundle without collecting timing samples before the formal run:

```sh
node components/base/benchmark/ownership/run.mjs --smoke /private/tmp/base-ownership-baseline.build.json
node components/base/benchmark/ownership/run.mjs --smoke /private/tmp/base-ownership-candidate.build.json
```

```sh
node components/base/benchmark/ownership/run.mjs --confirmed-quiet-slot /private/tmp/base-ownership-baseline.build.json
node components/base/benchmark/ownership/run.mjs --confirmed-quiet-slot /private/tmp/base-ownership-candidate.build.json
```

Use at least five independent counterbalanced pairs and preserve each process log.
Compare them with `benchmark-performance/scripts/compare_benchmarks.py`; treat an interval crossing the predeclared practical threshold as inconclusive.
The result applies only to these component ownership lifecycles and does not establish general Base mount performance.
