# Base internals and field sharing

This experiment compares the same production registration fixtures against two built Base package directories.
The baseline and candidate must use the same pinned workspace dependencies, Node version, and Rolldown version.
Retain the baseline package's `src`, `dist`, manifest, README, and license before changing source.
Make the workspace dependencies resolvable from the copied baseline directory, for example with a `node_modules` symlink to the unchanged workspace installation.

## Size

```sh
node components/base/benchmark/centralization/measure.mjs /path/to/baseline /path/to/results/baseline-sizes
node components/base/benchmark/centralization/measure.mjs components/base /path/to/results/candidate-sizes
```

Each single or mixed component fixture registers all selected classes, retaining their runtime behavior.
`full-library` retains every public barrel export and is a library-wide bound, not a typical application bundle.
The primary metric is raw uncompressed minified JavaScript with comments and source maps excluded.
The report records executable hashes, tool versions, dependency-lock hash, hardware, and source line counts including comments and blanks.
Package tarball bytes are measured separately with `npm pack --dry-run --ignore-scripts --json` against matching package contents.

## Runtime

Build both conditions completely, finish all tests, and run without concurrent builds, tests, or other automated browser work.
Use five independent counterbalanced pairs, alternating baseline/candidate and candidate/baseline order.
Predeclare a 5% practical latency threshold; an interval crossing the threshold is inconclusive.

```sh
node components/base/benchmark/centralization/run.mjs /path/to/results/baseline-sizes
node components/base/benchmark/centralization/run.mjs /path/to/results/candidate-sizes
```

Each invocation starts a fresh Chromium process and fresh pages for bare Base, Checkbox, and Number Field construction.
Each workload measures 10,000 disconnected creations per sample, ten warmup samples, and thirty recorded samples.
Every recorded batch must exceed twenty observed clock quanta; otherwise the run fails.
The final element is checked after measurement, and any browser error fails the run.
These measurements include the now-shared internals allocation but exclude connection, layout, rendering, and form interaction.
Reported p95 values describe batches of 10,000 creations, not individual input latency.

Also run the existing [ownership lifecycle benchmark](../ownership/README.md) against both frozen distributions.
Its Field, Toggle, Number Field, and Menu workloads exercise attribute mutation, participant replacement, and restoration on release.
Keep the fixture identical for both conditions; it checks final author state inside each lifecycle operation.
Use `benchmark-performance/scripts/compare_benchmarks.py` with `--metric medianMilliseconds --minimum-effect 0.05`, then repeat with `--metric p95Milliseconds` for tail evidence.
Preserve all raw logs, including inconclusive results.

The results do not establish overall library performance or accessibility readiness.
