# Measured code reductions — September 3, 2026

Baseline: `f4da08e`, immediately after the Observable/Composites polyfill and Vite integration commit.
This pass preserves public exports, dependencies, behavior, and browser targets.
AUI remains private.
No packages were published.
Measurements below describe the reduction candidate before the later CI-preparation metadata changes.

## Accepted implementation changes

| Package             | Change                                                                                                 | Minified shipped modules, bytes | Representative entry bundle, bytes                       |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------- |
| Vite polyfills      | Replace 17 awaited definition imports with one synchronous module and shared detectors                 | 7,553 → 4,296                   | 7,437 → 4,053                                            |
| AUI                 | Share the equivalent overlay/numeric ownership implementation and 23 identical property-replay methods | 246,057 → 244,219               | 206,621 → 204,214                                        |
| Composites          | Remove the temporary method-container object without changing intrinsic captures or callable metadata  | 1,374 → 1,324                   | 1,340 → 1,290                                            |
| Rolldown decorators | Remove stable-sort decoration arrays and combine class/name discovery into one traversal               | 9,989 → 9,776                   | Plugin: 6,743 → 6,567; decorated consumer: 3,049 → 3,012 |

The shipped-module total falls by 5,358 raw executable bytes.
Across those four packages, implementation files fall from 75 to 61 and physical nonblank source lines after parser-based comment removal fall from 15,776 to 15,309 (467 fewer).
Test, benchmark, and documentation additions are excluded from that implementation-only count.
These numbers are not compressed transfer sizes and do not include declarations, source maps, or documentation.
Dependencies and public export maps are unchanged.

AUI's shared implementation is deliberately narrow.
Field's redundant-write protection and Toggle/Collapsible/Tabs' distinct ownership and release behavior remain local.
NumberField and Slider's transactional property-upgrade recovery also remain local.
Individual AUI subpaths range from 83 bytes smaller to 25 bytes larger; the umbrella saving must not be presented as a win for every subpath.
Two small private modules are added to remove repeated implementations.

## Exact package artifacts

Real `npm pack --ignore-scripts` artifacts, after complete workspace builds and before CI preparation relocated the private AUI Skill out of its package:

| Package             | Tarball bytes     | Unpacked bytes        | Packed files |
| ------------------- | ----------------- | --------------------- | ------------ |
| Vite polyfills      | 15,397 → 12,561   | 67,775 → 44,479       | 74 → 26      |
| AUI, private        | 324,952 → 321,655 | 1,686,887 → 1,666,349 | 171 → 177    |
| Composites          | 7,370 → 7,310     | 22,330 → 21,811       | 13 → 13      |
| Rolldown decorators | 16,530 → 16,118   | 66,072 → 64,042       | 12 → 12      |

The root TypeScript-only build originally omitted the decorators runtime asset.
The baseline was completed using its actual workspace build before measuring it.
The candidate exposes the existing copy step as `build:assets`, so the root `build:extras` path now includes that required runtime file too.
This is a packaging correction, not an optimization claim.

## Performance evidence

Environment: Apple M5 Max, 64 GiB RAM, macOS 26.6.2, Node 24.16.0, npm 12.0.2, Rolldown 1.2.7, Vite 8.2.2, Playwright 1.62.1.
All timing windows excluded builds, tests, package checks, and competing benchmark processes.
Conditions were counterbalanced and each independent run used a fresh Node process or Chromium session.
The practical threshold was 2%, with paired geometric ratios and two-sided 95% Student-t intervals.
These are per-workload experimental intervals, not multiplicity-adjusted guarantees across every candidate explored.

| Workload                                             | Independent pairs | Throughput improvement | 95% interval       | Verdict      |
| ---------------------------------------------------- | ----------------- | ---------------------- | ------------------ | ------------ |
| Vite cold import + plugin creation                   | 10                | +3.95%                 | +2.62% to +5.29%   | Credible win |
| Decorator transform, 8 classes                       | 10                | +11.18%                | +10.57% to +11.80% | Credible win |
| Decorator transform, 32 classes                      | 10                | +3.37%                 | +2.39% to +4.35%   | Credible win |
| Decorator application, 32 entries                    | 10                | +4.39%                 | +3.33% to +5.46%   | Credible win |
| Decorator application, 8 entries                     | 10                | +2.01%                 | +1.29% to +2.74%   | Inconclusive |
| Decorator transform, large false-positive `@` module | 10                | +0.97%                 | +0.05% to +1.89%   | Inconclusive |

Vite's warmed creation/transform cases, all measured Composites cases, and the AUI ownership lifecycles do not establish a practically meaningful speed improvement.
Those changes are accepted for their measured size and structural benefits, not described as faster or equivalent.
Vite cold import plus creation was approximately 46.9 → 45.1 ms; OS file caches were not flushed.
The decorator application test includes class/descriptor/entry construction and validates decorator order.
The transform tests use the real parser and public transform hook, including the no-decorator countercase.
The AUI fixture includes construction, authored mutation, replacement, explicit owned-node removal, microtask delivery, and cleanup checks.
Results do not establish application-wide latency, retained-memory improvements, screen-reader support, or Firefox/Safari performance.

Batch p95 is the tail of whole batch durations, not individual-operation latency.
Decorator application with 32 entries and transformation with 8 classes also improve batch p95; other measured tails are inconclusive.

## Rejected experiments and retained safeguards

- The universal six-family AUI ownership class grew affected subpaths by 166–448 bytes and blurred distinct redundant-write and live-Map release semantics.
  It was replaced with exact-duplicate sharing only.
- Removing `RuntimeRoute.serialization` was invalid: `acceptsNativePathValue` consumes that property structurally.
  A subsequent contract-reference rewrite needed own-property guards to preserve isolation from late prototype changes and saved only 6 bytes while adding dispatch checks.
  Both HTTP runtime candidates were rejected; `server.ts` is baseline-identical.
  Tests now cover href/native route discrimination, property-named request methods, and inherited supported methods added after handler construction.
- Fixed HTTP exchange IDs would change wire-observable behavior; shared transport bridges mostly move code while adding a cross-package API.
- A scheduler-array scratch prototype saved only 8 minified bytes while adding numeric encoding and repeated priority conversion.
  It was not integrated.
- Lazy Lit effect infrastructure added 56 public-bundle bytes (153 independently minified module bytes) and 14 source lines.
  Five isolated pairs per workload measured effect-free mount +3.40% (95% interval +1.48% to +5.36%), one-effect mount +0.12% (−2.38% to +2.68%), and dense effect-free updates +10.59% (+5.33% to +16.12%).
  The dense-update improvement is credible, but the predeclared primary mount interval did not clear the 2% practical threshold.
  The candidate was not retained; changing the primary acceptance rule after seeing the result would overstate the experiment.
  The candidate source and built bundles are preserved for a deliberate future experiment, and the new reentrant/error lifecycle tests and calibrated harness remain.
- Prior Composites weak-registry collapsing and broad Observable lifecycle simplifications were not repeated: their earlier regression evidence and lifecycle requirements remain relevant.

The combined Composites pilot was stopped because its module-local intern registry accumulated across cases.
Accepted measurements isolate fresh hits, 32-property hits, and large-registry misses in separate browser processes.
The initial AUI fixture incorrectly expected host detachment to release still-owned toggle children; both baseline and candidate failed.
The corrected fixture explicitly removes owned nodes, and both pass the same smoke check.
Neither invalid pilot contributes accepted timing evidence.
The Lit fixture also initially mixed current and snapshot Signal runtimes; this was caught by its baseline smoke check before any timing.
Both conditions were then built against one exact Signal runtime, with matching runtime hashes.
A subsequent short-batch combined pilot was superseded by 100-iteration batches and separate fresh processes for each Lit workload; its apparent effect-user slowdown did not reproduce in the final isolated comparison.

## Validation and release boundary

The required `npm ci --ignore-scripts` preparation, builds, lint, formatting, unused-code checks, project-reference checks, and workspace typechecks passed.
Node validation passed 1,382 Vitest tests, 12 native tests, and 28 Signal DOM scope tests.
The consolidated browser run passed 4,678 tests with one skipped across Chromium, Firefox, and WebKit.
The previously observed Firefox menubar failure did not recur in this final run.
After rejecting the Lit candidate, its production source and built watcher were verified baseline-identical, and all 48 focused Lit browser tests passed with the three new regression cases retained.
The reduction-phase root verification passed lint, unused-code checks, formatting, reference checks, typechecks, and all Node tests before stopping at the private-AUI metadata gate described below.
Release-script tests, complete extra builds, and all public package checks passed.
An independent read-only review checked the accepted changes and exposed the rejected HTTP structural/prototype dependencies.

Initial `npm run verify` runs stopped at pre-existing private-AUI metadata inconsistencies:

- AUI retains a package Skill even though the validator disallows package Skills in private workspaces.
- The release workflow still lists private `@serve-tools/aui`.
- The separate public-Skill benchmark corpus still expects AUI despite its exclusion from the public catalog.

Those metadata issues were resolved during commit preparation: the AUI Skill moved to `.agents/skills/serve-tools-aui`, its reference and compile-checked recipe validation remains enabled, and AUI was removed from public benchmark tasks and release choices.
The metadata budget was preserved by shortening the maintainer Skill description.
Full `npm run verify` then passed, including 4,687 browser tests with one existing skip; the extra nine executions are the three retained Lit regressions across three engines.
An existing Node 22 router test failure was also reproduced (21 failures) and fixed by directly importing its ponyfill constructor instead of deleting a global and expecting a cached installer to rerun.
The fixed router tests passed on Node 22 and 24, and the full Node 22 Vitest suite passed 1,379 tests with three existing platform-dependent skips.
That change is test-only, with an explicit development dependency and TypeScript reference; router production code is unchanged.
The first remote CI run then exposed a separate Node 22 gap in the native HTTP interoperability fixture, which created routes without installing `URLPattern`.
Adding conditional polyfill setup and an explicit private test dependency fixed that failure; the complete Node 22 test command passed 1,379 Vitest tests, 12 native tests, and 28 Signal DOM tests, with three existing Vitest skips.
The interoperability fixture also passed on Node 24 without loading the polyfill.
The first remote Node 26 job spent five minutes installing dependencies and reached its ten-minute workflow limit while browser tests were still progressing without reported failures.
Its full-verification allowance was increased to twenty minutes, retaining all checks and the shorter limits for the other jobs.
The next run exposed a cold-start race in the client-router document reload fixture: readiness polling began before the iframe finished loading.
Waiting for each actual iframe `load` event preserves all readiness, document-replacement, and render-count assertions without increasing the test timeout.
A temporary 1.5-second fixture-response delay reproduced six failures before this test-only fix and passed all eighteen focused cross-browser tests afterward.
This report is not a claim that the repository is ready to publish unchanged.
This reduction pass does not advance package versions or refresh the release plan for newly changed packages; those must be reviewed before a future release.
Automated browser tests are also not manual assistive-technology verification.

## Reproduction

Package-local harnesses are in `vite/polyfills/benchmark`, `rolldown/decorators/benchmark`, `components/aui/benchmark/ownership`, `ponyfills/composites/benchmark`, and `lit/signals/benchmark/lazy-effects`.
They accept explicit baseline/candidate distribution paths.
The HTTP benchmark now also selects built distributions through `HTTP_CONTRACT_BENCH_ROOT`, uses longer batches and observable sinks, and logs a deterministic subject hash.
Its rejected experiment is not included among retained speed claims.

Raw logs, source/module inventories, every public-entry bundle measurement, exact tarballs, comparison output, snapshot selectors, and orchestration scripts are preserved in the local evidence directory:

`/Users/jonathan/Documents/Codex/outputs/web-tools-reduction-2026-09-03/`

The final four-package comparisons comprise 60 independent pairs (120 fresh processes).
Another 15 isolated pairs (30 fresh processes) evaluated the rejected Lit candidate.
Invalid or superseded pilots and pre-format AUI reruns are excluded.

To rerun a selected comparison with the frozen snapshot still present:

```shell
node /Users/jonathan/Documents/Codex/outputs/web-tools-reduction-2026-09-03/run-pairs.mjs decorator-transform 10
python3 /Users/jonathan/Documents/Codex/outputs/web-tools-reduction-2026-09-03/analyze.py
```

Do not run timing commands concurrently with builds, tests, or other benchmarks.
The same script supports `decorator-runtime`, `vite-cold`, `vite-warm`, `aui-lifecycle`, isolated `composites-<workload>` cases, and isolated `lit-lazy-effects-<workload>` cases.
The Lit comparison must use the preserved rejected-candidate bundle, not the restored current production source.

Further candidates require more evidence rather than another mechanical extraction: media-type parsing needs a differential quoting/escaping corpus; route pre-sorting needs adversarial precedence workloads; shared Checkbox/Switch or composite-host controllers need paired component coverage and subpath size controls.
No global optimum is claimed.
