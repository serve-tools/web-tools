# Composite reduction results — 2026-09-01

These are historical measurements of the September 1 source, not the current release-preparation tree.
The September 3 verification pass restored intrinsic captures after the getter-replacement regression test failed; no performance or size comparison was rerun for that repair.

The selected implementation keeps the hardened public contract while removing 79 bytes (5.7%) from the full minified executable entry and 118 bytes (1.8%) from the packed package.
Runtime performance is inconclusive across all ten final Chromium workloads: no throughput or batch-tail interval establishes a practical win or loss beyond the declared 2% threshold.
The reduction is accepted for code weight and simpler control flow, not as a speed improvement.

## Corrected baseline

The original untracked package was not a valid optimization baseline.
Its options getter-order test failed, a clean build left stale TypeScript build state and omitted the public export, fresh declarations failed mutable-array inference, and source getters could replace uncaptured intrinsics to corrupt identity and freezing.

Before measuring reductions, the baseline was repaired to:

- read `preserveNegativeZero` once before source snapshotting;
- generate fresh declarations with sound object, tuple, and mutable-array inference;
- capture every intrinsic used after user code can run;
- preserve proxy descriptor/get observation order while resisting getter-time intrinsic replacement;
- clean away stale `Composites.*` output and rebuild the actual `Composite.*` entry.

Those correctness changes are not counted as reduction gains.
They made the valid baseline larger than the original unsafe implementation, so this report does not claim an overall size reduction against broken input.

## Selected reduction

- Replace the temporary `{ Composite, isComposite }` method object and destructuring with inferred-name arrow declarations.
- Use a labeled candidate loop instead of a mutable match flag.
- Read a snapshotted property directly instead of retaining a captured `Reflect.get` helper.
- Inline number canonicalization and use the proposal's direct `value !== value` NaN check.
- Inline null-prototype object creation instead of retaining a one-line factory.

No method, option, export, runtime target, package dependency, identity rule, liveness rule, or proposal boundary was removed.
The two weak collections and duplicate comparison table remain because collapsing them measurably regressed unique creation.

## Size and structure

| Metric                                                                              | Hardened baseline | Selected |        Change |
| ----------------------------------------------------------------------------------- | ----------------: | -------: | ------------: |
| Full minified executable entry, raw bytes                                           |             1,375 |    1,296 |   -79 (-5.7%) |
| Emitted `Composite.js`, raw bytes                                                   |             3,648 |    3,237 | -411 (-11.3%) |
| Authored implementation lines in `Composite.ts`, excluding blank/comment-only lines |               121 |      108 |  -13 (-10.7%) |
| Source modules                                                                      |                 2 |        2 |     Unchanged |
| Packed tarball bytes                                                                |             6,737 |    6,619 |  -118 (-1.8%) |
| Unpacked published bytes                                                            |            20,436 |   19,444 |  -992 (-4.9%) |
| Published files                                                                     |                13 |       13 |     Unchanged |
| Runtime dependencies                                                                |                 0 |        0 |     Unchanged |
| Weak registries                                                                     |                 2 |        2 |     Unchanged |

The executable measurement uses the package's TypeScript build followed by identical Rolldown ESM bundling with `minify: true`.
It excludes source maps, declarations, comments, and transport compression.
Packed size uses `npm pack --ignore-scripts --json` and therefore includes declarations, maps, README, license, and the package Skill.

## Final Chromium throughput

Each workload used five independent paired fresh-Chromium runs with alternating baseline/candidate order.
Every process ran 5 unrecorded warmup batches and 15 recorded batches.
The table reports geometric mean public operations per second and paired log-ratio two-sided 95% Student-t intervals with a predeclared 2% practical threshold.

| Workload                        | Baseline | Candidate | Improvement |       95% interval | Verdict      |
| ------------------------------- | -------: | --------: | ----------: | -----------------: | ------------ |
| fresh-create-hit                |  7.039e6 |   7.086e6 |      +0.66% |   -4.95% to +6.60% | inconclusive |
| reordered-key-hit               |  4.141e6 |   4.138e6 |      -0.07% |   -4.38% to +4.44% | inconclusive |
| property-count-1-hit            |  7.945e6 |   8.404e6 |      +5.78% |  -0.93% to +12.94% | inconclusive |
| property-count-8-hit            |  1.652e6 |   1.672e6 |      +1.22% |   -3.65% to +6.33% | inconclusive |
| property-count-32-hit           |  3.730e5 |   3.770e5 |      +1.08% |  -7.85% to +10.87% | inconclusive |
| unique-miss-registry-8          |  1.226e4 |   1.223e4 |      -0.20% |   -2.24% to +1.88% | inconclusive |
| unique-miss-registry-4096       |     4973 |      5047 |      +1.50% |   -1.89% to +5.00% | inconclusive |
| negative-zero-normalization-hit |  1.116e7 |   1.130e7 |      +1.18% | -14.09% to +19.17% | inconclusive |
| preserve-negative-zero-hit      |  1.009e7 |   1.051e7 |      +4.14% |  -8.46% to +18.48% | inconclusive |
| nan-canonicalization-hit        |  1.093e7 |   1.124e7 |      +2.84% |  -6.81% to +13.49% | inconclusive |

All p95 batch-duration comparisons were also inconclusive.
The closest interval to a decision boundary was the 4,096-entry unique-miss workload at +0.41% with a 95% interval of -2.47% to +3.37%.
These p95 values describe the slowest of 15 complete batch durations in each process, not individual-operation latency.

The evidence supports neither a speed win nor equivalence.
It establishes that this experiment detected no decision-grade final regression while still allowing practical losses in several noisy workloads.

## Candidate decisions

| Candidate                                           | Evidence                                                                                    | Decision                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Arrow declarations instead of method-object wrapper | -50 minified bytes; removes one module-startup object                                       | Keep for weight and structure                                                        |
| One WeakMap for branding and keys                   | -84 additional minified bytes, but unique misses regressed 6.35% and 5.45% in isolated runs | Reject and restore two weak collections                                              |
| Labeled candidate loop                              | -5 additional minified bytes; two unique-miss effects inconclusive                          | Keep for flatter control flow                                                        |
| Direct property read and inline normalization       | -2 additional minified bytes; hit and miss effects inconclusive                             | Keep for smaller source and fewer concepts                                           |
| Lazy live-reference compaction                      | +54 minified bytes; one large-growth workload improved 5.34%, hits were inconclusive        | Reject as disproportionate for the durable modest-registry suite                     |
| Direct `create(null)` and `value !== value`         | -22 additional minified bytes; five affected workload effects inconclusive                  | Keep for weight and proposal-aligned normalization                                   |
| Hash-indexed registry                               | Requires materially more hashing, identity, collision, and weak-liveness machinery          | Reject before implementation as disproportionate to this ponyfill's documented scope |

## Boundary and environment

One operation creates its fresh source, calls the compiled public `Composite` entry, and verifies identity or output inside the timed batch.
Registry fixtures, prepopulation, result-storage capacity, module imports, Chromium startup, reporting, application work, rendering, I/O, forced garbage collection, and retained-memory profiling are outside timing.
The results apply to Chromium component overhead only, not application latency, Node, Firefox, WebKit, or a native implementation.

Revision: `348a053ac8a644bd38f9f66b42a02793aeeb515e`, plus the pre-existing untracked Composite package and unrelated dirty worktree changes.
Environment: Apple M5 Max with 64 GB memory, macOS Darwin 25.6.0 arm64, Node 24.16.0, npm 12.0.2, TypeScript 7.0.2, Rolldown 1.2.6, Vitest 4.1.11, Playwright 1.62.1, and Chromium/headless-shell 151.0.7922.34 revision 1234.

The table above is the preserved comparison output for the 100 exact paired logs under `/tmp/composite-reduction.xdLfkB/true-final`.
The benchmark subjects were `/tmp/composite-reduction.xdLfkB/hardened-baseline/dist/ponyfill-composites.js` with implementation SHA-256 `51ddabd941a855b6de3c85b9b7c4a324f87aaa98ec4f8a504d767708cb60333c` and `/tmp/composite-reduction.xdLfkB/final2/dist/ponyfill-composites.js` with implementation SHA-256 `b914800562e832567347e3d1134c9b14c15f54a6aba60d3f4d6f237b8702e8a0`.
Those hashes identify each entry's sibling `Composite.js`; the tiny re-export entry itself is byte-identical between subjects.
Use [the benchmark methodology](README.md) to reproduce the suite.
