# Base Checkbox repeated-mount diagnostic results

## Verdict

The current Base fixture is materially sensitive to whether the derived full validation sink runs after every mount.
Across five counterbalanced pairs of fresh Chromium processes, the paired geometric ratio of within-process mount medians was `3.931` for `validate-each / validate-final`, with a two-sided 95% interval of `3.067–5.037`.
The complete interval exceeds the predeclared `1.10` diagnostic threshold.

This is evidence that out-of-clock validation history perturbs later mount measurements in this diagnostic fixture.
It rejects this diagnostic's per-sample full-sink scheme, not the historical Base UI result itself.
It does not attribute the effect specifically to garbage collection, prove that the historical comparison's result was caused by validation, compare current Base with Base UI, or establish that Base meets the release gate.

## Results

The table reports each fresh-process condition's median and p95 across twelve recorded mounts of 1,000 labeled Checkboxes.
The p95 values describe correlated samples within one process and are not independent-run intervals.

| Pair | Order       | Validate each median | Validate each p95 | Validate final median | Validate final p95 | Paired ratio |
| ---: | ----------- | -------------------: | ----------------: | --------------------: | -----------------: | -----------: |
|    1 | each, final |             129.9 ms |          321.4 ms |               37.3 ms |            38.9 ms |        3.483 |
|    2 | final, each |             132.9 ms |          294.5 ms |               36.9 ms |            38.9 ms |        3.602 |
|    3 | each, final |             132.1 ms |          289.8 ms |               36.5 ms |            37.9 ms |        3.619 |
|    4 | final, each |             208.1 ms |          298.8 ms |               37.1 ms |            40.4 ms |        5.609 |
|    5 | each, final |             136.0 ms |          290.6 ms |               36.9 ms |            39.1 ms |        3.686 |

Median teardown remained `2.0–2.1 ms` in both conditions.
Each derived full validation took approximately `24–26 ms`, and the final exact sinks matched across conditions.
Every sink asserted 1,000 controls, 1,000 labels, 334 checked values and exact form entries, 3,000 light-DOM elements, 1,000 shadow roots, and 3,000 shadow elements.

The `validate-each` samples rose in a repeating sawtooth before dropping sharply, while `validate-final` samples remained around `37 ms` before falling to `8–10 ms` late in the run.
That pattern is consistent with browser runtime history affecting the mount clock, but this experiment did not profile or identify the responsible browser subsystem.

## Environment and artifacts

- Revision: `348a053ac8a644bd38f9f66b42a02793aeeb515e` with 26 dirty Base paths recorded in the raw result.
- Hardware: Apple M5 Max, 18 logical CPUs, 64 GiB memory.
- Runtime: macOS `25.6.0`, Node `v24.16.0`, Chromium `151.0.7922.34`, Rolldown `1.2.7`.
- Production diagnostic bundle: 19,131 raw minified bytes, SHA-256 `c6055e1b76892bd71f48b3f1962c73f9a78d5b77ce2fade56582f3ab5e281655`.
- Repository-formatted observations: [`results.json`](results.json), SHA-256 `d55573a5279ae7c73fbfc5b5d71df7b8926792cece4c47d695abd3bc80e7ceff`.
- Original raw JSON, bundle, and build metadata: `/Users/jonathan/Documents/Codex/outputs/aui-mount-diagnostic-2026-09-02`; original raw SHA-256 `ac1ef9f98956a892e0021aec5cea4f346176613bd8cdcba0bb2073b8f9feb530`.

The repository copy differs only in formatting; a deep comparison of the parsed data passed against the preserved original.

Executed commands:

```sh
npm run build --workspace @serve-tools/base-components
node components/base/benchmark/build.mjs
node components/base/benchmark/run.mjs --confirmed-quiet-slot /private/tmp/base-mount-diagnostic.json
node components/base/benchmark/analyze.mjs /private/tmp/base-mount-diagnostic.json
```

The first sandboxed browser launch failed before measurement because macOS denied Chromium's Mach port registration.
The formal run was then executed outside the sandbox in the granted quiet window; no partial result from the failed launch was retained.

## Candidate ledger

| Candidate                                                                       | Predicted mechanism and workload                                                           | Evidence                                                                                                          | Verdict                                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Run the derived full sink after every sample                                    | Exact semantic validation remains out of the clock but may perturb the next repeated mount | `3.931×`, 95% interval `3.067–5.037×` versus final-only validation                                                | Reject for the next acceptance harness                                          |
| Use a cheap exact invariant after each mount and the full sink after each block | Keeps per-mount correctness coverage while limiting full-tree sink history                 | Current Base-only diagnostic; the cheap invariant is not designed yet                                             | Best bounded next experiment                                                    |
| Optimize Checkbox or `BaseElement` construction                                 | Could reduce true mount work                                                               | Historical redundant `name`/`tabindex` syncs are already removed; current remaining dominant cost is not isolated | Defer until a corrected comparison or profile identifies a production mechanism |

The next decision-grade experiment should rebuild both current public implementations, use fresh counterbalanced processes, keep equivalent cheap exact invariants after every mount and equivalent full exact sinks after each block, and compare current Base with Base UI under a frozen protocol.
Only after that result should production mount-path candidates be ranked.
