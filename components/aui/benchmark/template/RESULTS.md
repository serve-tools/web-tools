# Cached template prototype results

Historical experiment before the production migration.
See [the migration review](../../design/template-migration.md) for the current implementation and acceptance results.
The original prototype and test source are retained with the durable experiment artifacts.

## Decision

Keep the candidate isolated; do not migrate the public renderer or claim the fastest implementation.
Cached preparation is a credible improvement for repeated creation in this fixture: creating 1,000 equivalent template-backed elements took approximately 48% less time than the current renderer.
Update, reconnect, and region-movement process medians satisfy the declared 5% regression bound, but cached region movement has a concerning descriptive tail and the benchmark bundle grows by 1,820 raw bytes.
Cold single-element observations are below the precision requirement and do not establish a cold-start advantage.
The direct DOM reference remains faster to mount but implements only these fixed fixtures, not the general template contract.

No public component, public export, or existing renderer implementation was changed.
The experimental tag returns an inert description without an owner argument; fragment instantiation supplies the owner separately.
The base-element API that consumes returned layout descriptions, nested description ownership, and the separate DisposableElement migration remain outside this experiment.

## Primary evidence

Six balanced trios used fresh Chromium processes for current, cached, and direct implementations.
Each non-cold workload had three warmups and twelve recorded samples; cold creation used twelve fresh pages per condition with no warmups.
The same current AUIElement and binding-scope implementation served all three conditions.
The table reports the median of six process medians in milliseconds per complete block, not individual interaction latency.
Ratios are paired geometric current/cached ratios with two-sided 95% log Student-t intervals, five degrees of freedom.
Higher ratios favor cached preparation.

| Workload                     |   Current |   Cached | Direct reference | Current/cached, 95% interval | Median-based result                                 |
| ---------------------------- | --------: | -------: | ---------------: | ---------------------------- | --------------------------------------------------- |
| Mount 1,000 elements         | 10.525 ms | 5.500 ms |         3.950 ms | 1.926, 1.894–1.958           | Credible improvement beyond 5%                      |
| 10,000 completed updates     |  8.900 ms | 8.925 ms |         8.800 ms | 1.005, 0.985–1.025           | Within 5% regression budget; improvement unresolved |
| 1,000 reconnect cycles       |  3.200 ms | 3.250 ms |         3.050 ms | 0.984, 0.967–1.002           | Within 5% regression budget; improvement unresolved |
| 1,000 region movement cycles |  3.550 ms | 3.525 ms |         3.300 ms | 1.002, 0.975–1.030           | Within 5% median budget; tail warning below         |

All steady recorded observations passed the twenty-clock-quanta requirement and all final semantic sinks matched across conditions.
Each update changes two signals and waits for completion.
Each reconnect changes a signal while detached and checks edited-input identity/state after reattachment.
Each movement reverses three PersistentFragments, toggles one region's visibility, and checks preserved input state.
The mount workload is a simple template-backed counter, not the full AUI Checkbox or a Base UI component comparison.

Cold single-element process medians were approximately 1.0 ms for current and cached, and 0.575 ms for the specialized direct reference.
All 72 cold observations per condition were below twenty clock quanta and are descriptive only.
Neither equal cold medians nor the direct reference's smaller number establishes a decision-grade cold performance result.

## Tail behavior and memory

With twelve samples, the nearest-rank empirical p95 is the maximum sample in each process.
The following are medians of those six per-process maxima, in milliseconds per complete block.
These are descriptive summaries without a predeclared inferential tail comparison.

| Workload         | Current | Cached | Direct reference |
| ---------------- | ------: | -----: | ---------------: |
| Mount 1,000      |   14.60 |   6.60 |             5.25 |
| 10,000 updates   |    9.45 |   9.35 |             9.35 |
| 1,000 reconnects |    3.60 |   3.60 |             3.60 |
| 1,000 movements  |    4.20 |   9.15 |             3.50 |

Cached movement has a larger slow sample in every paired process.
This needs investigation before promotion, even though its process medians meet the 5% budget.
The experiment did not profile garbage collection or isolate movement into separate fresh processes, so it cannot identify the mechanism or distinguish workload-history effects from movement-specific overhead.
No outliers were removed.

CDP DOM counters and JSHeapUsedSize were captured after recorded blocks and after cleanup without forcing garbage collection.
For the mount block, median heap observations were 31,695,296 bytes before cleanup and 33,825,682 after cleanup for current, versus 26,471,986 and 28,602,558 for cached.
These observations include collectible objects and runtime history; they are not retained-memory measurements, allocation counts, or evidence of a memory-leak improvement.
Correctness tests separately establish synchronous subscription suspension and explicit retirement.

## Executable weight

| Production benchmark bundle | Raw minified |  gzip | Brotli |
| --------------------------- | -----------: | ----: | -----: |
| Current                     |       19,216 | 6,840 |  6,168 |
| Cached                      |       21,036 | 7,347 |  6,611 |
| Direct reference            |       16,119 | 5,538 |  4,968 |

Cached adds 1,820 raw bytes, 507 gzip bytes, and 443 Brotli bytes in these fixtures.
These totals include benchmark machinery and are not standalone consumer or whole-package sizes.
The caching mechanism adds prepared-template metadata, target resolution, and descriptor handling; this experiment has not minimized that implementation.

Separately rebuilding the exact preserved one-checkbox application fixtures with Rolldown 1.2.7 produced AUI at 17,278 raw bytes, Base UI plus React at 205,515, and native React at 191,039.
The resulting Base UI increment is 14,476 bytes; the original fixed target remains 14,477 bytes from Rolldown 1.2.6.
AUI remains 2,801 bytes above that fixed target.
The one-checkbox smoke checks passed for initial form submission, enabled activation, and disabled activation blocking.
Public Checkbox does not use the experimental renderer, so neither this weight check nor the counter timing establishes a prototype-versus-Base-UI victory.

## Validation and experiment history

- The complete AUI browser suite passed: 1,754 tests and one skipped test across Chromium, Firefox, and WebKit, including 60 new differential/mechanism checks.
- AUI package typechecking and standalone strict checking of the prototype fixture passed.
- Full repository `npm run verify` passed, including package, browser, Skill, and compiler-adapter checks.
- The subsequent runner-only batch-count/metadata changes passed scoped lint, syntax checks, revised three-condition smoke, and the complete formal run.
- Analysis self-checks verify known improvement, practical-equivalence, and regression classifications.
- Production-input hashes matched before and after measurement; exact input contents, prototype source, runner source, and bundles are preserved in the artifact directory.

Revision 1 stopped in the first condition of the first trio: a 1,000-update block took 1 ms, below the approximately 2 ms precision floor.
It has no complete comparative trio and contributes no performance conclusion.
Revision 2 increased update blocks tenfold to 10,000 and reconnect/movement blocks tenfold to 1,000 equally for all conditions, without changing the precision or practical-effect thresholds.
Both protocols and the incomplete first result are retained.
An earlier test expectation incorrectly assumed template descendants already belonged to the live document; it was corrected for both current and cached implementations to check inert ownership before insertion and document adoption afterward.
Initial harness failures involving a generated Rolldown module ID and top-level-await helper initialization were repaired before formal measurement; the smoke failure artifact is preserved.

Environment: Apple M5 Max, 18 logical CPUs, 64 GiB RAM, Darwin 25.6.0, Node 24.16.0, Chromium 151.0.7922.34, Rolldown 1.2.7.
Revision: f11bd335d149d9a0c9d750e714ffd952ad9cdd2d with existing unrelated dirty work and the new isolated experiment.
All task-owned builds, tests, and browser automation finished before each formal timing attempt.
OS-wide CPU process inspection was unavailable because the sandbox denied `ps`; ordinary user application activity was not controlled.

External artifact root: `aui-template-prototype-2026-09-04/`.
The main raw result is `measurement-v2/results.json`; paired analysis is `analysis.json`; full verification is `verify-complete.log`.
The original protocol/source snapshot is `experiment-source`; the revised snapshot is `experiment-source-v2`; exact production inputs are indexed by `source-closure.json`.
See [the protocol and commands](README.md) to reproduce the experiment.
