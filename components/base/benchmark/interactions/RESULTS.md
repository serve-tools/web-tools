# Base / pinned Base UI Tabs and Dialog interaction results

## Result

The September 15, 2026 formal run resolves every semantic-completion comparison in favor of Base at both the median and p95 thresholds.
The geometric Base UI / Base median ratios range from 3.977× to 35.547× across mount, state change, and teardown.
Ratios above 1 favor Base.

The combined analyzer result is `passed: false` because the secondary render-opportunity median gate classifies the two mount workloads as material regressions: 0.916× for Tabs and 0.943× for Dialog.
This secondary measurement is the first animation-frame callback requested after semantic completion.
Base completes both mounts several milliseconds earlier and then waits longer for the next frame boundary, so this result is sensitive to where completion falls within a frame.
It is not evidence of actual paint time or input-to-screen latency.

## Semantic completion

Each cell is a run-level median in milliseconds or a geometric Base UI / Base ratio across five paired fresh-process summaries with a two-sided 95% Student-t interval.

| Workload             | Base median | Base UI median |   Median ratio [95% CI] | Base p95 | Base UI p95 |      p95 ratio [95% CI] |
| -------------------- | ----------: | -------------: | ----------------------: | -------: | ----------: | ----------------------: |
| Tabs mount 30        |       1.108 |          4.877 |    4.599 [4.343, 4.871] |    1.335 |       6.255 |    4.902 [4.560, 5.270] |
| Tabs switch 30       |       0.520 |         18.415 | 35.547 [34.519, 36.605] |    0.675 |      19.295 | 29.788 [27.320, 32.479] |
| Tabs teardown 30     |       0.360 |          1.490 |    3.977 [3.378, 4.681] |    0.440 |       1.765 |    4.003 [3.406, 4.704] |
| Dialog mount 25      |       0.483 |          2.962 |    5.974 [5.128, 6.959] |    0.675 |       3.855 |    5.974 [5.213, 6.845] |
| Dialog open-close 25 |       2.032 |         35.162 | 16.896 [15.534, 18.378] |    2.465 |      35.905 | 15.075 [14.054, 16.170] |
| Dialog teardown 25   |       0.228 |          0.983 |    4.190 [3.897, 4.504] |    0.310 |       1.210 |    4.149 [3.466, 4.966] |

The predeclared no-material-regression limits allow at most 5% at the median and 10% at p95.
All twelve semantic median and p95 intervals resolve above their applicable thresholds.

## Subsequent render opportunity

This metric spans the same public operation and final-state completion, then ends at the first `requestAnimationFrame` callback requested after that state.
It measures one batch-level browser render opportunity per observation and is not divided into a per-component or per-interaction value.

| Workload             | Base median | Base UI median | Median ratio [95% CI] | Base p95 | Base UI p95 |   p95 ratio [95% CI] |
| -------------------- | ----------: | -------------: | --------------------: | -------: | ----------: | -------------------: |
| Tabs mount 30        |      14.678 |         13.485 |  0.916 [0.905, 0.927] |   15.345 |      14.555 | 0.940 [0.910, 0.971] |
| Tabs switch 30       |      15.225 |         31.830 |  2.088 [2.071, 2.104] |   16.095 |      32.535 | 2.031 [2.008, 2.055] |
| Tabs teardown 30     |      15.080 |         14.570 |  0.972 [0.961, 0.984] |   15.625 |      15.295 | 0.985 [0.952, 1.020] |
| Dialog mount 25      |      15.082 |         14.250 |  0.943 [0.935, 0.952] |   15.820 |      15.260 | 0.961 [0.951, 0.971] |
| Dialog open-close 25 |      15.262 |         48.560 |  3.187 [3.155, 3.219] |   16.005 |      49.265 | 3.082 [3.039, 3.125] |
| Dialog teardown 25   |      15.453 |         15.262 |  0.986 [0.975, 0.997] |   16.000 |      15.865 | 0.999 [0.984, 1.015] |

The Tabs and Dialog mount median intervals resolve below the 0.952 no-regression threshold.
The other ten render-opportunity median and p95 comparisons pass their applicable thresholds.

## Matched contract

Each condition runs as a separate minified production IIFE with its complete runtime.
The Base UI conditions use pinned `@base-ui/react` 1.7.0, React 19.2.8, and React DOM 19.2.8.

Both Tabs fixtures keep all panels mounted and wait for every selected and hidden state.
Both Dialog fixtures use 25 closed, nonmodal, retained popups with the same title and first focusable button.
Native Base uses the browser's dialog focusing steps; Base UI uses documented `initialFocus` and `finalFocus` refs to target the same button and external focus anchor.
The open and close clocks end only after the exact focus target and every popup visibility attribute match.
All fixtures preserve and validate initial tab, panel, popup, and title node identities.

Completion observers, focus listeners, promises, and timeouts are prepared before each semantic clock.
Only the public mutation, exact final-state wait, and constant retained-reference sink are timed; watcher cleanup occurs after the semantic timestamp.
Both conditions use public CSS `animation: none` and `transition: none` and no forced synchronous React commit or private transition bypass.

## Protocol and integrity

The run used five independent counterbalanced pairs and 30 observations per condition and workload.
Every condition, workload, and pair ran in a fresh headless Chromium process, producing 60 raw JSON records and 60 matching SHA-256 sidecars.
No observation was discarded.
The measured median `performance.now()` quantum was approximately 0.005 ms in every process, and every accepted semantic observation spanned at least 20 observed timer quanta.

The environment was macOS 25.6.0 on an Apple M5 Max with 18 logical CPUs and 64 GiB of memory, using Node.js 24.16.0.
Cross-origin isolation was enabled.
Preflight passed all 58 emitted checks for timer precision, console cleanliness, accessibility state, final DOM and focus state, stable identity, teardown, and matched sinks.

| Artifact                         | SHA-256                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| Frozen build metadata            | `c7ea68074695f10bbe9d267b7c90440b09570b43f9141ed787f57df34f57614c` |
| Frozen benchmark control closure | `d445f3789b2f47d8a7873ae65c86a475c899b744bb7053972f0ad13f090bd04b` |
| Frozen production/source closure | `fddd2ceea262538843496dfe2e5f50f512848b2846d6f62bd5f8aa653699ae10` |
| Passing preflight                | `9f5f9a1ab105528fa34f15418ce0c1ccac040d363ef55e14b10d8ea7dff4ff95` |
| Formal results                   | `3a0d9bfa353d10318d94990b71ec875b7726d93b13f0fd26a5f9f339bf16bd27` |
| Analysis                         | `0ab9e7abb5b648e9e84875cea1d4bb310a7c3eb3a5ca7302c992ef358a3ab945` |

Artifacts are under `/Users/jonathan/Documents/Codex/outputs/base-components-interactions-2026-09-15`.
The earlier focus-boundary failure and the completed run with the invalid mount boundary remain preserved there and are excluded from this analysis.

After formal timing, Biome required only sorting the `node:fs/promises` named imports in `build.mjs`.
The frozen run records the pre-format file hash `ba04d78bd42dd98c1aa4b8b791f37f8ef5bffbdc224bc9c77e09bbb38528e7e4`; the formatted file hash is `cc3773160286a6c5cdf3ca1d67fbc2dc223a1ee336df7ce6a44d68e4828a1fdc`.
This source-order-only edit occurred after timing and does not change the emitted fixtures or recorded results.

## Limits

The fixed batches characterize these production fixtures on one machine and browser configuration.
They do not establish single-component latency, interactive input latency, actual paint, assistive-technology behavior, retained-memory cost, or performance across other hardware and browsers.
The 95% intervals use five fresh-process pairs, so they quantify between-pair uncertainty for this protocol rather than all deployment variability.
Framework-excluded component size is intentionally outside this runtime suite.
