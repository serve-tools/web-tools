# Base / pinned Base UI Tabs and Dialog interaction benchmark

This suite compares the current production `@serve-tools/base-components` Tabs and Dialog implementations with pinned `@base-ui/react` 1.7.0, React 19.2.8, and React DOM 19.2.8.
It repairs the archived September 15 multi-component experiment whose React commit boundary preceded final Base UI Tabs panel visibility.

The completed September 15 run is reported in [RESULTS.md](./RESULTS.md).

## Scope

Each fixture is a separate minified production IIFE so a Tabs measurement does not load Dialog and a Dialog measurement does not load Tabs.
Runtime measurements include each condition's complete required runtime: Base includes its imported foundations, while Base UI includes React, React DOM, scheduler, and Base UI.
Framework-excluded component size remains a separate metric in `../comparison/size.mjs`; no runtime framework cost is subtracted here.

The matched public workloads are:

| Workload               | Timed operation                                               | Warmups | Recorded observations |
| ---------------------- | ------------------------------------------------------------- | ------: | --------------------: |
| `tabs-mount-30`        | Construct, connect, and initialize 30 three-panel tab sets    |       3 |                    30 |
| `tabs-switch-30`       | One completed selection change across 30 tab sets             |       6 |                    30 |
| `tabs-teardown-30`     | Disconnect 30 initialized tab sets                            |       3 |                    30 |
| `dialog-mount-25`      | Construct, connect, and initialize 25 closed nonmodal dialogs |       3 |                    30 |
| `dialog-open-close-25` | One completed open/close cycle across 25 dialogs              |       6 |                    30 |
| `dialog-teardown-25`   | Disconnect 25 initialized dialogs                             |       3 |                    30 |

Both sides keep all three tab panels and each dialog popup mounted.
Both move focus from the same external button to the same first focusable dialog button on open and restore focus to the external button on close.
Base uses native dialog focusing steps and Base UI uses its documented `initialFocus` and `finalFocus` refs.
Both use public controlled state operations and public CSS with `animation: none` and `transition: none`.
The harness does not use React `flushSync`, Base UI's internal animation-disable global, forced garbage collection, or a skipped transition path.

## Completion and measurements

The harness installs completion observers, focus listeners, promises, and timeouts before the primary clock starts.
The primary duration begins immediately before the public state operation and ends only when every affected public `hidden` or `open` attribute and the dialog focus target have their final values.
This includes Base UI's documented transition-status lifecycle when it defers the outgoing panel or popup's final hidden state beyond the React commit.
Mount waits for every initial tab, panel, and popup state inside the clock, while a constant-size first/last retained-reference invariant runs before the end timestamp.
Observer, listener, and timer cleanup occurs after the semantic end timestamp.
Full DOM validation runs after each warmup and recorded block, and teardown settles all removals before another mount begins.

The secondary duration ends at the first `requestAnimationFrame` callback requested after that final DOM state.
It is a browser render-opportunity boundary, not a paint measurement: an animation-frame callback runs before paint, headless Chromium may not paint, and the harness performs no visual readback.
Semantic completion and render-opportunity latency are analyzed independently.

Each formal condition/workload/pair uses a fresh headless Chromium process.
Five independent pairs are counterbalanced separately for every workload.
Thirty observations make nearest-rank p95 the second-slowest observation.
Every recorded block must span at least 20 observed `performance.now()` quanta before division.
No outlier is discarded.

The analyzer reports geometric Base UI / Base latency ratios with two-sided 95% Student-t intervals over the five paired process summaries.
The predeclared no-material-regression bounds are 5% for run medians and 10% for run p95 values.
The nested observations describe each process; the five paired processes are the independent units.

Build metadata hashes every emitted production bundle, every transformed production input, every benchmark control and fixture source, the pinned package manifest and lockfile, the repository revision, and the dirty diff.
Preflight rechecks the complete closure, timer precision, cross-origin isolation, console errors, final visibility, stable node identity, accessible roles and names, and matched semantic sinks.
Formal timing writes one JSON file plus SHA-256 sidecar for every condition/workload/pair, progress, and final results.

## Commands

Build and preflight after the current Base distribution is final:

```sh
node components/base/benchmark/interactions/build.mjs \
  --closure-dir /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/closure \
  --output-dir /path/to/interaction-artifacts

node components/base/benchmark/interactions/preflight.mjs \
  --build /path/to/interaction-artifacts/build-metadata.json \
  --output /path/to/interaction-artifacts/preflight.json
```

Run formal timing only in a confirmed quiet window with dependency installation, builds, tests, other browsers, indexing, and unrelated workloads idle:

```sh
node components/base/benchmark/interactions/run.mjs \
  --confirmed-quiet-slot \
  --build /path/to/interaction-artifacts/build-metadata.json \
  --preflight /path/to/interaction-artifacts/preflight.json \
  --output-dir /path/to/interaction-artifacts/formal

node components/base/benchmark/interactions/analyze.mjs \
  --input /path/to/interaction-artifacts/formal/results.json \
  --output /path/to/interaction-artifacts/analysis.json
```

Do not claim actual paint, input-to-screen latency, assistive-technology behavior, retained-memory behavior, or performance outside these fixed production fixtures from this suite.
