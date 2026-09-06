# PersistentFragment baseline

The standalone implementation passes its cross-browser contract and establishes the following Chromium baseline.
There is no comparative speedup claim: the existing signal `group()` combines subscription/disposal work with a different region contract.

## Environment and method

Measured August 31, 2026 on an Apple M5 Max, 18 cores, 64 GiB RAM, macOS 26.6.1.
Node 24.16.0, npm 12.0.2, Playwright 1.62.1, and Chromium 151.0.7922.34.
The worktree was based on `348a053ac8a644bd38f9f66b42a02793aeeb515e` with the new package and unrelated existing changes uncommitted.

Build with `npm run build --workspace @serve-tools/client-dom-fragment`, then run `npm run benchmark --workspace @serve-tools/client-dom-fragment` three times sequentially.
Each invocation starts a fresh browser, imports the compiled `dist` entry, and records 15 samples after 5 warmup samples per workload.
Batch sizes are recorded in [results.json](./results.json); the initial pilot was discarded before recording because its smallest batches were too close to timer resolution.
No other builds or tests ran during the recorded measurements.

Fixtures use connected, otherwise empty elements.
One toggle operation hides and restores a region; one move operation moves it to another parent and back.
Creation includes constructing one span and its region, insertion, and removal.
Identity, element count, and destination cleanup are checked outside the timed batches.
The boundary covers synchronous JavaScript and DOM work, excluding layout, paint, application callbacks, and rendering latency.

## Recorded timings

All values are microseconds per operation.
The median range spans the three independent runs; the last column is the largest within-run p95 batch duration divided by its iteration count, not individual-operation tail latency.

| Operation                      | Nodes |  Median range | Maximum batch p95 per operation |
| ------------------------------ | ----: | ------------: | ------------------------------: |
| Hide and restore               |     0 |   0.172–0.179 |                           0.198 |
| Hide and restore               |     1 |   0.346–0.349 |                           0.371 |
| Hide and restore               |    10 |   1.580–1.600 |                           1.765 |
| Hide and restore               |   100 | 13.850–14.000 |                          14.650 |
| Move and return                |     0 |   0.608–0.636 |                           0.694 |
| Move and return                |     1 |   0.970–0.986 |                           1.158 |
| Move and return                |    10 |   3.560–3.600 |                           4.220 |
| Move and return                |   100 | 28.700–28.900 |                          31.700 |
| Unchanged visibility, hot loop |     0 | 0.0029–0.0031 |                          0.0037 |
| Create, insert, remove         |     1 |   0.790–0.825 |                           0.893 |

The emitted entry bundles to 2,099 raw minified executable bytes using Rolldown 1.2.6 with ESM output and `minify: true`, excluding declarations and source maps.
The package has no runtime dependencies.
These are baseline measurements, not confidence intervals or evidence of equivalence to another implementation.

## Implementation decision and validation

The initial reusable-Range approach was rejected for correctness: Firefox left a region's boundary comments in its ShadowRoot during whole-region extraction.
One direct sibling-transfer implementation handles both hidden content and whole-region detachment across all three engines.
It avoids per-move snapshot arrays and retained Range state; custom-element callbacks can observe intermediate extraction and must defer overlapping structural edits.

All 13 tests passed in each of Chromium, Firefox, and WebKit (39 test executions), covering identity, live iterables, nesting, dynamic edits, adoption, shadow roots, invalid destinations, damaged boundaries, and synchronous reentry.
Typechecking, build, package-shape checks, Skills validation, formatting, and release-planning tests passed.
Root `npm run verify` stopped at unrelated Knip findings.
A final recheck leaves the existing Base `.experiment.ts` file and `captureError` export as blockers outside this package.
