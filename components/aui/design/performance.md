# AUI performance and retention contract

Status: the measured existing-DOM regression check meets its latency budget; AUI versus Base UI comparisons and heap-retention experiments remain pending.
No AUI performance advantage has been demonstrated.

## Existing DOM result, August 27, 2026

Ten counterbalanced pairs of fresh Chromium processes compared minified production consumers against `b24edab960932b3dbd1683b691e46555f615ff20`.
Both conditions used identical Signal and effect sources, equal DOM output, and completed reactive updates.
No measured workload's 95% interval reached the predeclared 5% material latency regression threshold.

| Existing unscoped workload                 | Change in time | Paired 95% interval |
| ------------------------------------------ | -------------: | ------------------: |
| Static tree creation                       |         +2.42% |    +1.30% to +3.56% |
| Creation and disposal, one binding         |         +0.24% |    -1.13% to +1.62% |
| Creation and disposal, seven bindings      |         -0.50% |    -1.42% to +0.43% |
| Completed update, 1,000 text bindings      |         -2.69% |    -5.25% to -0.05% |
| Completed update, 1,000 attribute bindings |         -0.40% |    -2.69% to +1.94% |

Static creation has a small measured cost, even though it meets the budget.
The used-API bundle grew from 4,947 to 5,203 uncompressed minified bytes, an increase of 256 bytes; this is not a whole-package size measurement.
An earlier implementation and a six-pair candidate run were inconclusive at the threshold and are retained with the final raw evidence.
The measured follow-up removed a new callback allocation from every HTML, SVG, and MathML construction while preserving document context through construction, configuration, and insertion.
The final measurements cover JavaScript work in Chromium 151 on an Apple M5 Max, not layout, paint, native interaction, scoped AUI lifecycles, or heap retention.

## Meaning of better

Require equivalent behavior and accessibility before comparing speed.
Evaluate update latency, interaction latency, startup, retained memory, emitted JavaScript, and complexity separately.
Do not combine them into a score or describe an isolated benchmark as a whole-library speedup.

The design target is less work for isolated state changes, bounded reconnection work, and no active external subscriptions retained by disconnected components.
Use Base UI 1.7.0 and a pinned React production build as the comparison target.
Also compare the changed Signal DOM and effect machinery with the unchanged web-tools revision `b24edab960932b3dbd1683b691e46555f615ff20` so an AUI improvement cannot hide a regression for existing consumers.

## Workloads

| Workload             | Fixture and semantic completion                                               | Evidence                                                                                 |
| -------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Initial mount        | 1, 100, and 1,000 controls with equal labels, state, and behavior             | Setup latency, nodes, allocations, executable bytes                                      |
| Isolated update      | One changed item among 1,000 idle items; correct visible and accessible state | Work performed, completed-update latency, unrelated writes                               |
| Batch update         | 100 and 1,000 controls change in one turn                                     | Completed-update latency and scheduler behavior                                          |
| Checkbox interaction | Pointer/keyboard activation followed by correct value, events, and FormData   | Event ordering and interaction latency                                                   |
| Tabs navigation      | Repeated keyboard navigation and panel activation with stable contents        | Focus correctness, update latency, retained node identity                                |
| Dialog lifecycle     | Open/close, nested dialogs, cancellation, and focus restoration               | Interaction latency, style/layout work, active resources                                 |
| Detach and reconnect | Remove populated controls, update external stores, and reconnect              | Synchronous release, zero detached writes, current-value reconciliation, allocation cost |
| Permanent retirement | Repeated creation/removal while an external store remains alive               | Exact subscription/resource counts and retained-heap trend                               |
| Hidden regions       | Toggle conditions containing nested components and retained input state       | Ownership, state retention, and update cost                                              |
| Large collections    | 100, 1,000, and 10,000 options when collection components exist               | Navigation/search latency and per-item retained memory                                   |

Measure the normal public operation, including work the caller must perform.
Do not time only a signal assignment while timing React through its completed render.
Do not force only one implementation into synchronous rendering or compare development React with production AUI.
Verify the resulting DOM, form data, events, focus, and accessibility relationships around every measured workload.
Separate construction, connected layout/paint, and actual user interaction so each number has a clear boundary.

## Experimental controls

Record exact revisions, relevant dirty files, dependency versions, hardware, OS, browsers, build configuration, fixture size, warmup, iterations, samples, and execution order.
Preserve raw machine-readable results and the commands that produced them.
Run without concurrent installation, builds, other benchmarks, or profiling sessions.
Use a production bundle for both implementations and equivalent styles and content.

Use at least five independent paired browser runs, with counterbalanced ordering; use ten or more when effects are small or tails are unstable.
Treat independent runs as the statistical units, not repeated operations inside one browser process.
Report absolute values, paired ratios, and 95% intervals.
Name exclusions and retain failed or inconclusive experiments.

Predeclare a 5% material-regression threshold for primary workload latency.
Target at least a 20% improvement in isolated completed updates, while requiring no material regression in the other primary workloads.
These are acceptance targets, not current claims or justification for weakening behavior.
An interval that cannot resolve the threshold is inconclusive and requires more evidence or a narrower claim.

Report per-interaction tails using individual interaction observations.
The existing benchmark helper's p95 describes batch durations and must not be labeled as p95 user input latency.
Measure native-event-to-visible-update behavior separately from JavaScript-only scheduling costs.

## Retention and ownership

The [retention evidence](retention.md) records completed base-lifecycle and Checkbox experiments, including positive controls, retained-heap snapshots, and an initial Checkbox sensitivity failure followed by a separately predeclared larger workload.
Those results do not replace the matched Base UI latency and bundle comparisons required above.

First prove deterministic cleanup through exact counters for external signal subscriptions, global listeners, observers, timers, and active overlays.
Keep the external store alive during retirement tests.
Verify queued updates do not execute after suspension and that repeated reconnects do not accumulate registrations.
Exercise removal during an update, exceptions in setup and cleanup, hidden groups, nested components, shared sheets, and cross-document adoption.

Use a separate heap-retention experiment to check that the deterministic model matches browser behavior.
Register each component class once and keep instance references out of its constructor's surrounding scope, so the custom-element registry cannot retain the fixtures through the test itself.
Record retained DOM, binding objects, and resource owners over repeated mount/remove cycles after warmup.
Forced collection is allowed only in this explicitly labeled retention experiment; it is not a runtime cleanup mechanism or part of throughput measurement.
Do not use a single heap snapshot or nondeterministic finalizer callback as proof of leak freedom.

## Shipped weight and readable implementation

Measure a single component, the three-component example, and a representative multi-component application from real exported entrypoints.
Report uncompressed minified executable JavaScript first, then transfer compression, package size, and dependencies separately.
Compare both standalone application cost and incremental cost when React is already in the host application.
Confirm registration and framework adapters cannot enter unrelated component bundles accidentally.

Prefer a small ownership state machine and work proportional to owned bindings or changed state.
Require a concrete measured benefit before adding another scheduler, pooled object scheme, observer network, or public abstraction.
Reject a faster-looking design if it retains disconnected components, loses native state, defers necessary work outside the timed region, or makes behavior depend on garbage collection timing.
