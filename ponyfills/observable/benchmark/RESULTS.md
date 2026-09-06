# Observable reduction results — 2026-08-29

The selected change reduces the full minified entry by 50 bytes (1.0%) and improves throughput in 10 of 12 measured Chromium workloads.
The size gain is modest; the larger benefit is avoiding callback copying and notification closures on hot paths.
No supported method, operator, source protocol, export, dependency, or runtime target was removed.

## Selected implementation

- Replace per-callback `Object.assign()` temporary objects with direct assignments while preserving dictionary getter order and captured callback identity.
- Invoke `next` directly inside its error-reporting boundary instead of creating a notification closure per value.
- Pass each execution's Subscriber to a recipe-owned operator callback instead of constructing a second callback through a setup factory on every consumption.
- Reuse the operator's reserved input index for `take()` and explicitly handle `take(0)` without starting its source.
- Collapse generic assertion/error wrappers, remove an unused enum and empty-error factory, and only trim error stacks where the runtime supports it.

Keep the original active flag, observer cleanup object, abort unlink callbacks, terminal finish closures and error notification wrapper.
A more aggressive lifecycle variant had attractive throughput but failed the batch-tail checks and was not retained.

The original package was untracked and initially did not typecheck: its constructor assertion was malformed, it contained a stray untyped `z` member, and its Subscriber factory bypassed private-field initialization with `Object.create()`.
Those were minimally repaired before establishing the working baseline; their repair is not counted as an optimization gain.
The declaration now accepts `PromiseLike<T>`, matching the runtime's pre-existing structural thenable support; README and Skill guidance were corrected with matching runtime/type fixtures.
`take()` still uses the documented unsigned-64-bit conversion; exact equivalence after enormous numbers of emissions above `Number.MAX_SAFE_INTEGER` is not claimed because the documented number-precision limitation applies.

## Size and structure

| Metric                                                    | Repaired baseline | Selected |       Change |
| --------------------------------------------------------- | ----------------: | -------: | -----------: |
| Full minified executable entry, raw bytes                 |             4,924 |    4,874 |  -50 (-1.0%) |
| Observable-only export bundle, raw bytes                  |             4,667 |    4,617 |          -50 |
| Subscriber-only export bundle, raw bytes                  |             1,013 |    1,004 |           -9 |
| when-only export bundle, raw bytes                        |             4,892 |    4,842 |          -50 |
| Authored source lines, excluding blank/comment-only lines |               543 |      526 |  -17 (-3.1%) |
| Source modules                                            |                 6 |        6 |    Unchanged |
| Packed tarball bytes                                      |            17,615 |   17,387 | -228 (-1.3%) |
| Unpacked published bytes                                  |            72,434 |   71,657 | -777 (-1.1%) |
| Published files                                           |                25 |       25 |    Unchanged |
| Runtime dependencies                                      |                 0 |        0 |    Unchanged |

Size uses the actual TypeScript package build followed by identical Rolldown ESM bundling with `tsconfig: false`, `minify: true`, and `comments: false`.
Executable bytes exclude maps, declarations, comments, and transport compression.
Export bundles are synthetic import boundaries, not measurements of an application bundle.
Packed size uses `npm pack --ignore-scripts --json`; it includes the shipped README, Skill, declarations and source maps.
Source-line counts cover only the six library TypeScript files; new tests, benchmarks and evidence documentation are separate validation assets.

## Final isolated throughput comparison

Each workload had five independent paired runs, with a fresh Chromium process for each condition/workload and alternating baseline/candidate order.
The existing shared harness ran 5 warmup batches and 15 recorded batches per process, with identical iteration counts and output/lifecycle checks.
The final four targeted workloads and remaining eight workloads were collected in consecutive series using the same candidate, suite, settings and machine.
The table shows geometric mean operations per second and paired log-ratio two-sided 95% Student-t intervals, with a predeclared 2% practical threshold.
An operation is one complete consumption or event-listener lifecycle, not one emission.

| Benchmark                    | Baseline geometric mean | Candidate geometric mean | Improvement |         95% interval | Verdict      |
| ---------------------------- | ----------------------: | -----------------------: | ----------: | -------------------: | ------------ |
| async-iterable-completion    |               1.741e+05 |                1.879e+05 |      +7.92% |    +4.62% to +11.33% | credible win |
| error-teardown               |               1.956e+06 |                2.524e+06 |     +29.01% |   +22.10% to +36.31% | credible win |
| first-cancels-source         |               2.114e+05 |                2.413e+05 |     +14.15% |   +12.53% to +15.79% | credible win |
| map-filter-drop-take         |               5.862e+04 |                7.431e+04 |     +26.77% |   +24.56% to +29.01% | credible win |
| promise-completion           |               2.629e+05 |                2.808e+05 |      +6.80% |     +5.79% to +7.82% | credible win |
| reduce-256                   |               9.617e+04 |                1.189e+05 |     +23.66% |   +20.11% to +27.31% | credible win |
| subscribe-1-emissions        |               2.999e+05 |                  3.1e+05 |      +3.39% |     -2.00% to +9.08% | inconclusive |
| subscribe-1024-emissions     |               8.681e+04 |                2.091e+05 |    +140.88% | +136.23% to +145.62% | credible win |
| subscribe-32-emissions       |               2.594e+05 |                2.895e+05 |     +11.59% |   +10.90% to +12.29% | credible win |
| to-array-256                 |               9.173e+04 |                1.122e+05 |     +22.36% |   +16.91% to +28.07% | credible win |
| when-external-cancellation   |                4.87e+05 |                4.824e+05 |      -0.93% |     -2.93% to +1.11% | inconclusive |
| when-take-listener-lifecycle |               1.497e+05 |                1.616e+05 |      +7.91% |    +5.39% to +10.49% | credible win |

Single-value subscription and external cancellation are inconclusive; their point estimates are not evidence of equivalence.
The cancellation throughput interval still allows a small regression.
Do not generalize these component results to whole applications, Node, Firefox, or WebKit performance.

## Batch tails

These values are milliseconds per batch, not individual-operation latency.
With 15 samples, the shared helper's nearest-rank p95 is the maximum batch duration.
The improvement column is the baseline/candidate timing ratio minus one, not a percentage reduction in milliseconds.

| Benchmark                    | Baseline geometric mean | Candidate geometric mean | Improvement |         95% interval | Verdict      |
| ---------------------------- | ----------------------: | -----------------------: | ----------: | -------------------: | ------------ |
| async-iterable-completion    |                   21.53 |                    19.69 |      +9.30% |    +5.01% to +13.77% | credible win |
| error-teardown               |                   19.72 |                    16.24 |     +21.43% |   +11.21% to +32.58% | credible win |
| first-cancels-source         |                   27.48 |                    28.29 |      -2.86% |   -16.57% to +13.10% | inconclusive |
| map-filter-drop-take         |                   40.65 |                    37.83 |      +7.44% |    +1.43% to +13.81% | inconclusive |
| promise-completion           |                   16.66 |                    15.76 |      +5.73% |     +1.86% to +9.75% | inconclusive |
| reduce-256                   |                   14.26 |                    13.03 |      +9.40% |    +5.18% to +13.79% | credible win |
| subscribe-1-emissions        |                   39.41 |                    37.16 |      +6.05% |    -1.36% to +14.01% | inconclusive |
| subscribe-1024-emissions     |                   15.47 |                     7.02 |    +120.44% | +111.56% to +129.69% | credible win |
| subscribe-32-emissions       |                   28.81 |                    26.35 |      +9.33% |    +6.41% to +12.34% | credible win |
| to-array-256                 |                   13.66 |                    11.15 |     +22.46% |   +12.43% to +33.38% | credible win |
| when-external-cancellation   |                   23.74 |                    23.18 |      +2.41% |   -11.24% to +18.16% | inconclusive |
| when-take-listener-lifecycle |                   39.14 |                    39.28 |      -0.36% |     -9.02% to +9.13% | inconclusive |

No selected-workload throughput or batch-tail interval establishes a loss beyond the 2% threshold in this final matrix.
Several tails remain inconclusive, so this is not a blanket claim of no performance regression.
No retained-memory profile, individual-operation latency distribution, or GC trace was collected.

## Candidate decisions and rejected work

| Candidate                                                    | Evidence                                                                                 | Decision                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| C1: assertion/error helper collapse                          | -15 bytes; five paired runs inconclusive for speed; portability regression test passes   | Keep for structure and correctness, not a speed claim           |
| C2: broad allocation/lifecycle reduction                     | Many throughput gains, but later isolated collection/cancellation batch-tail regressions | Keep only direct callback assignment and direct next invocation |
| C3: remove operator setup factory and duplicate take counter | -33 bytes relative to C2; isolated incremental speed effects inconclusive                | Keep the simpler operator model; final combination validated    |
| C4: remove default options objects                           | +9 minified bytes                                                                        | Reject before performance measurement                           |
| C5: narrow C2 while keeping C1/C3                            | 4,874 bytes; final isolated matrix above                                                 | Selected                                                        |

Earlier ten-pair all-workloads-in-one-process results showed a 1,024-emission batch-tail loss despite a large throughput gain.
A fresh-browser isolated check reversed that tail result, demonstrating workload-history sensitivity, without proving which GC or JIT mechanism caused it.
Isolating all workloads then exposed collection and cancellation tail losses in the broader candidate; those were addressed by restoring the original lifecycle bookkeeping before collecting the selected matrix.
All original results and slow runs are retained rather than discarded.
Historical artifact directory `final` contains the rejected broad candidate; `c5` contains the selected runtime.

Further reductions that bypass public `subscribe()` overrides, merge stage-owned signals, weaken protected cancellation, alter event-option getter/mutation boundaries, or merge sync/async iterator semantics were rejected as disproportionate behavioral risks.
The remaining code-size opportunities are small; larger reductions would require narrower supported behavior or API changes.

## Validation and environment

- Package typecheck, build, 42 Node tests and 126 browser tests pass; browser correctness ran in Chromium, Firefox and WebKit.
- Publint and Are the Types Wrong ESM package checks pass.
- Package Biome and Markdown formatting checks pass; 67 package Skills and the repository Skill validate.
- Root `npm run verify` was attempted before and after selection, but stops at unrelated `components/base/src/lib/DisposableElement.ts` lint.
- A separate root Knip check flags unrelated Base internal files; it reports no observable-package issue.
- Existing dependencies were reused; this is not clean-install validation. No git, GitHub or registry mutation was performed.

Revision: `348a053ac8a644bd38f9f66b42a02793aeeb515e`, plus the pre-existing untracked observable package and unrelated dirty worktree changes.
Environment: Apple M5 Max, 64 GiB RAM, macOS Darwin 25.6.0 arm64, Node 24.16.0, npm 12.0.2, TypeScript 7.0.2, Rolldown 1.2.6, Vitest 4.1.11 and Playwright 1.62.1.
Playwright's Chromium/headless-shell revision is 1234, version 151.0.7922.34.
Builds, installs and other agent-driven tests were kept outside measured runs; desktop/environment interference remains possible.

## Reproduction and evidence

See [benchmark methodology](README.md) for workload boundaries, batches and the baseline-entry override.
Raw logs, all candidate source/build snapshots, exact measurement/replay scripts, packed artifacts, comparison output and initial dirty-state evidence are preserved locally at:

`/Users/jonathan/Documents/Codex/2026-08-29/observable-reduction`

Use `replay-isolated.zsh` from the repository root with the preserved baseline and `c5` compiled entries and a fresh output directory.
`measure.mjs` reproduces source and raw bundle metrics with the installed Rolldown version.
The `evidence/accepted-*.log` files aggregate the independent per-workload runs by pair index for the benchmark Skill comparison script; each underlying `c5-<variant>-<run>-<workload>.log` preserves its actual process output.
