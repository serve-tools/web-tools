# AUI performance and retention contract

Status: the existing-DOM regression check meets its latency budget, and the complete-component retention experiment passes its bounded criteria.
The final Checkbox comparison does not meet the complete performance acceptance gate because both mount workloads fail to establish the required regression bound.
Completed-update workloads show a measured advantage within the scope below; no overall AUI advantage over Base UI is established.

## Final Checkbox comparison, August 28, 2026

Ten independent counterbalanced pairs compared the final public AUI Checkbox with Base UI 1.7.0 and production React/React DOM 19.2.8 in fresh Chromium 151 processes.
Both fixtures used the same enabled binary state, direct native labels, name/value vectors, styles, and exact FormData checks.
Every mount created a new populated form under a persistent root container.
Both update clocks included the public operation and its completion microtask; React used normal scheduling through the final expected layout-effect commit, without `flushSync`.
Fixture validation and symmetric watchdogs remained outside the clocks.

The table reports the median of ten condition-run medians, with Base UI/AUI paired geometric ratios and two-sided Student-t 95% intervals over the paired log ratios.
The no-material-regression requirement is an entire ratio interval above `1 / 1.05`, approximately 0.95238.
The isolated-update target requires the entire interval to reach 1.25, corresponding to at least a 20% cost reduction.

| Workload                              |   AUI ms | Base UI ms | Base UI/AUI | Paired 95% interval | Result                           |
| ------------------------------------- | -------: | ---------: | ----------: | ------------------: | -------------------------------- |
| Mount 100                             |   9.2013 |     8.4288 |       0.966 |         0.801–1.165 | Regression bound not established |
| Mount 1,000                           | 222.1288 |   128.6788 |       0.655 |         0.450–0.954 | Regression bound not established |
| Isolated update, exact-100 block mean |  0.00125 |   0.086625 |      78.354 |       66.111–92.865 | Mean-cost target met             |
| Batch 100 among 1,000                 |   0.1100 |     3.1400 |      32.907 |       24.681–43.876 | No material regression resolved  |
| Batch 1,000 among 1,000               |   0.6675 |    23.0475 |      39.142 |       31.784–48.203 | No material regression resolved  |

The Mount 1,000 interval ends at approximately 0.9541, narrowly crossing the fixed 0.95238 boundary.
That is inconclusive at the 5% acceptance threshold, not evidence that mounting is equally fast.
Both observed mount medians were slower for AUI, but the later validation-history diagnostic below shows that the repeated-mount harness itself needs correction before those absolute values guide runtime optimization.

Each isolated observation covers exactly 100 sequential completed updates, with one operation completed before the next begins, divided by 100.
These are mean completed-update costs within blocks, not individual interaction latencies or interaction p95 values.
Every block remained nonzero and at least 20 observed clock quanta; the fresh-page quantum was approximately 0.005 ms.
All ten pairs passed the declared form, accessibility-tree, identity, precision, source-integrity, isolation, and error checks.
The measurements cover JavaScript completion in this fixture, not native input latency, layout, paint, manual assistive technology, or other components.

### Prior results and the optimization boundary

The original ten-pair experiment recorded a material Mount 1,000 regression: AUI 205.9500 ms, Base UI 136.1750 ms, ratio 0.743 with a 0.615–0.899 interval.
Its isolated update reached the original timer floor and was inconclusive.
The original AUI fixture reused its connected form while React created a new form subtree; the later experiment matched that ownership and attachment boundary.

A separate instrumented diagnostic identified 2,000 redundant full state synchronizations among 1,000 Checkbox constructions and connections, triggered by `name` and `tabindex` writes.
The final implementation skips those synchronizations while preserving focus ownership, live form naming, and authored tab order across disabling and late upgrade.
Instrumented platform-call counts are diagnostic evidence, not a latency improvement measurement.
The final mount result does not establish that this patch resolves the performance problem.

An individual-timing follow-up then passed its precision preflight but stopped during its first formal AUI condition: eight of 50 durations were zero, exceeding the fixed 5% limit.
It contains no complete pair and supports no comparative result.
The separate aggregate experiment used the exact-100 block size specified before that failure, preserved both earlier artifacts, and changed neither effect thresholds nor the fixed ten-pair count.
These experiments are not contemporaneous candidate-versus-original pairs; their absolute times must not be used to claim a patch speedup.

### Executable weight

These are functional one-control application bundles from public entrypoints, measured independently of timing.

| Application                   | Raw minified bytes | gzip bytes | Brotli bytes |
| ----------------------------- | -----------------: | ---------: | -----------: |
| AUI standalone                |             17,031 |      5,700 |        5,152 |
| Base UI plus React standalone |            205,516 |     64,822 |       55,912 |
| Native React baseline         |            191,039 |     59,255 |       51,160 |

Base UI's raw increment over the native React baseline is 14,477 bytes.
The compressed differences, 5,567 gzip and 4,752 Brotli bytes, are descriptive because compression is not additive.
The standalone AUI application is smaller, but its 17,031 bytes do not establish an incremental advantage when React is already present.
These values do not measure the whole library, a three-component consumer, or a representative multi-component application.
DOM counts distinguish light DOM from shadow elements and roots; a light-DOM-only count must not be presented as total DOM cost.

### Evidence

The final report, frozen protocol, source closure, bundles, preflight, raw samples, and analysis are in `/Users/jonathan/Documents/Codex/outputs/aui-comparison-aggregate-2026-08-28`.
The formal raw SHA-256 is `74df3bf356cd787bdeffaf6e71974409efd0b8ea786b004a14e927a12647a381`.
The build metadata SHA-256 is `1e237a9df15ce8d5933001392dfaa159dbbc2efc6e860d2591483d5377b34637` and closes over 95 runtime and bundle inputs.
The earlier primary, diagnostic, and individual-precision artifacts remain at `aui-comparison-2026-08-28`, `aui-checkbox-mount-diagnostic-2026-08-28`, and `aui-comparison-followup-2026-08-28` under the same outputs directory.
All measurements used an Apple M5 Max, macOS release 25.6.0, Node 24.16.0, Rolldown 1.2.6, and Playwright 1.62.1 without concurrent builds or automated browser work.

## Repeated-mount validation diagnostic, September 2, 2026

The [durable AUI-only diagnostic](../benchmark/RESULTS.md) tested whether running a derived version of the full post-mount validation sink after every sample perturbs the next mount.
Five counterbalanced pairs of fresh Chromium processes compared `validate-each` with the same exact sink run only after the warmup and recorded blocks.
Both conditions timed the same public production AUI operation, kept teardown and validation outside the mount clock, and ended with identical exact form, label, identity, light-DOM, shadow-root, and shadow-element sinks.

The paired geometric ratio of within-process medians was `3.931` for `validate-each / validate-final`, with a two-sided 95% interval of `3.067–5.037`.
Median teardown remained `2.0–2.1 ms`, and the full validation itself took approximately `24–26 ms`.
The result clears the diagnostic's fixed 10% sensitivity threshold and rejects this diagnostic's per-sample full-sink scheme for the next acceptance harness.

This does not identify garbage collection or another browser subsystem as the cause, compare current AUI with Base UI, or satisfy the release gate.
It also does not erase the frozen historical experiment.
The next comparison must use current production bundles in fresh counterbalanced processes, an equivalent cheap exact invariant after every mount, and equivalent full exact validation after each block.
Production mount-path changes should wait for that corrected comparison or a profile that identifies a bounded runtime mechanism.

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

The [retention evidence](retention.md) records the final five-pair experiment across all 36 public constructors, plus historical base-lifecycle and Checkbox experiments.
Exact cleanup, positive-control sensitivity, and post-GC criteria passed for the final fixture.
The historical Checkbox sensitivity failure and its separately predeclared larger follow-up remain documented.
Retention results do not replace the latency and bundle comparisons above or resolve the remaining mount-performance gate.

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
