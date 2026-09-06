# Contemporary Base / pinned Base UI Checkbox comparison

This suite contemporaneously compares the current production `@serve-tools/base-components/checkbox` bundle with pinned `@base-ui/react` 1.7.0 and production React and React DOM 19.2.8.
It replaces no historical artifact and makes no whole-library claim.

## Final revision-3 result

Revision 3 completed all eight pairs and passed the fixed 5% median and 10% block-mean p95 regression bounds for all five workloads.
Ratios below are Base UI / Base JavaScript-completion latency, so values above one favor Base in this fixture.

| Workload           | Base run median ms | Base UI run median ms | Median ratio and 95% interval | P95 ratio and 95% interval |
| ------------------ | -----------------: | --------------------: | ----------------------------: | -------------------------: |
| `mount-100`        |             1.1925 |                2.1700 |            1.827, 1.792–1.863 |         1.981, 1.930–2.033 |
| `mount-1000`       |             8.4087 |               50.9138 |            6.041, 5.893–6.193 |         3.030, 2.346–3.913 |
| `update-one-1000`  |           0.000995 |              0.069516 |         70.876, 68.932–72.874 |      61.650, 59.675–63.690 |
| `update-100-1000`  |            0.06725 |               2.50831 |         36.332, 34.361–38.416 |      33.684, 31.437–36.091 |
| `update-1000-1000` |             0.6575 |               20.4812 |         30.708, 29.708–31.742 |      30.368, 28.376–32.501 |

The isolated-update values are exact-1,000 sequential block means, and the 100-control update values are exact-20 sequential block means.
Their p95 values describe block means, not individual operation tails.
The raw result SHA-256 is `0a77f0fb8345d746ea1338dcbcc17a22f086f8f217e2a0f447450e8a67bc0f99`.
The production closure hash was `a8e273236743a3f9881ba566cc9742fcd4bcac3afd3ef48dc7af7f7b6626939f` before and after all timing.

The one-checkbox production Base application is 26,665 raw minified bytes.
It exceeds the unchanged 14,477-byte historical Base UI increment target by 12,188 bytes.
The contemporary Rolldown 1.2.7 Base UI increment is 14,464 bytes and is descriptive; it does not move the target.

Revision 1 and revision 2 remain preserved as failed precision experiments without comparative analyses.
Revision 1 stopped on an individual 100-control batch, while revision 2 stopped on an exact-100 isolated block.

The August aggregate harness fixed each `durationMs` before full validation, but both fixtures still performed a full validation after every observation before the next observation could start.
In Base UI, mount promise resolution itself also waited for that validation even though its recorded duration excluded it.
The repeated-mount diagnostic showed that this validation history materially perturbed later Base mounts.

This corrected harness gives both mount fixtures the same boundary: caller setup, construction and connection or React commit, one completion microtask, and a cheap retained-reference invariant.
The end timestamp follows that invariant.
Full semantic and DOM traversal runs only once after the warmup block and once after the recorded block for each condition, workload, and pair.
Update fixtures likewise use cheap per-operation retained-state checks and the same block-final full validation schedule.

## Frozen revision-3 protocol

The five historical workloads are preserved.
Revision 1 stopped after one complete pair when an individual Base `update-100-1000` observation measured 0.0900 ms against a 0.0050 ms timer quantum, below the fixed 20-quantum precision minimum.
The incomplete experiment was preserved without a comparative analysis; revision 2 changed only that workload to blocks of exactly 20 sequential completed 100-control batches divided by 20.
Revision 2 then stopped after four complete pairs when an exact-100 isolated Base block totaled 0.0950 ms, below the same 20-quantum minimum.
Revision 3 changes only isolated updates to blocks of exactly 1,000 sequential completed operations divided by 1,000.
Both grouped workloads use 8 warmup and 10 recorded preflight blocks to establish steady-state precision without supporting a performance inference.
Preflight performs full actual-control and form validation after warmups, after the ninth recorded grouped block while the parity is odd, and after all ten recorded blocks.
The odd checkpoint makes a skipped public-state assignment observable even when the even warmup and recorded totals restore the initial vector.

| Workload           | Timed operation                                                                 |  Warmups | Recorded observations |
| ------------------ | ------------------------------------------------------------------------------- | -------: | --------------------: |
| `mount-100`        | Construct and connect 100 labeled controls                                      |        3 |                    40 |
| `mount-1000`       | Construct and connect 1,000 labeled controls                                    |        3 |                    40 |
| `update-one-1000`  | Mean cost of exactly 1,000 sequential completed one-control updates among 1,000 | 8 blocks |             40 blocks |
| `update-100-1000`  | Mean cost of exactly 20 sequential completed 100-control batches among 1,000    | 8 blocks |             40 blocks |
| `update-1000-1000` | One completed batch update of all 1,000 controls                                |        8 |                    40 |

Each condition, workload, and pair uses a fresh headless Chromium process.
Eight independent pairs are counterbalanced separately for each workload.
Forty recorded observations make nearest-rank p95 the second-slowest observation rather than the maximum.
Every recorded block or individual operation must span at least twenty measured clock quanta before division.

Inference uses the eight paired process medians and p95 values, never the forty nested observations as independent runs.
The analyzer reports geometric Base UI / Base latency ratios and two-sided 95% Student-t intervals over paired log ratios.
The whole median interval must exceed `1 / 1.05` to resolve no material regression at the predeclared 5% bound.
The whole p95 interval must exceed `1 / 1.10` to resolve no material tail regression at the predeclared 10% bound.
Crossing either boundary is inconclusive.
No outlier is discarded and the protocol must not change after formal results are observed.

Both fixtures retain the historical enabled binary Checkbox contract, direct native labels, name and value vectors, initial checked vector, exact `FormData` validation, and CSS.
Base UI uses documented native-button Checkbox Roots, hidden form inputs, local React state, normal public setters, and normal React scheduling without `flushSync`.
Base uses its public Checkbox subclass and public `checked` property.
The isolated and 100-control update values are sequential-block means.
Their p95 values are p95s of block means, not individual interaction or batch latency.

The build hashes every final production input in the emitted bundle closure and records raw minified, gzip, and Brotli bytes separately.
The fixed weight reference remains Base UI's historical 14,477 raw-minified-byte increment over the native React fixture built with Rolldown 1.2.6.
The contemporary build may use a newer repository-pinned Rolldown and is reported separately; the target does not move.

The suite measures JavaScript completion in headless Chromium.
It excludes layout, paint, click-to-screen latency, manual assistive technology, forced garbage collection, retained memory, and performance of other components.

## Commands

Copy the pinned dependency closure before the build if the artifact is new:

```sh
cp -R \
  /Users/jonathan/Documents/Codex/outputs/aui-comparison-aggregate-2026-08-28/closure \
  /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/closure
```

Build and preflight may run after the current Base and Signal DOM distributions are final:

```sh
node components/base/benchmark/comparison/build.mjs \
  --output-dir /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison

node components/base/benchmark/comparison/preflight.mjs \
  --build /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/build-metadata.json \
  --output /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/preflight-result.json
```

Run formal timing only after the primary agent confirms the machine is quiet:

```sh
node components/base/benchmark/comparison/run.mjs \
  --confirmed-quiet-slot \
  --build /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/build-metadata.json \
  --preflight /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/preflight-result.json \
  --output-dir /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/formal-v3

node components/base/benchmark/comparison/analyze.mjs \
  --input /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/formal-v3/results.json \
  --output /Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/comparison/analysis.json
```
