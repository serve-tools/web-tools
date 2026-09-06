# Base retained-heap evidence

Status: the September 4 production-template experiment passes its deterministic cleanup, positive-control sensitivity, and post-GC criteria independently.
Historical foundation and Checkbox captures remain below with their original source and sensitivity limits.
This evidence applies to the exact production bundles, Chromium version, and exercised fixture paths; it is not proof that every component graph is leak-free.

## Production template migration, September 4, 2026

The repeated complete-component experiment uses the unchanged five-pair protocol and exercises all 36 public constructors with the migrated returned-template layout.
All 20 predeclared checks pass, and the analysis marks the result decision-grade.
Every normal checkpoint returns external listeners, observers, timers, and Signal sinks to baseline, with no detached Signal writes or remaining top-layer state.
The independent post-GC checks find zero additional DOM nodes, event listeners, and documents in every normal run.
Median JavaScript heap growth is 362,748 bytes, within the fixed 2 MiB limit; median DOM-node slope is zero.

The intentionally leaking condition retains 64 external roots and Signal sinks, adds 27,968 DOM nodes and 1,920 CDP event listeners in every run, and produces 6,705,920 bytes of median heap growth.
It passes the unchanged sensitivity thresholds, so the normal result is not being accepted against an insensitive harness.
Browser instrumentation resources remain identified separately from Base resources.

The final retention source closure is `f3b8bcd7ecd2a7403ecfefbb41f7473eb9d3c1f49980e1ab76a49a1f86ebb1b7`.
The [raw captures](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/acceptance/retention/results/raw.json), [analysis](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/acceptance/retention/results/analysis.json), and [acceptance status](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/acceptance/STATUS.md) record the exact fixture, environment, source hashes, and limitations.
This does not compare retained memory with Base UI and does not certify unexercised graphs or manual assistive technology.

## Final complete-component experiment, August 28, 2026

Five independent fresh-Chromium pairs alternated normal and intentionally leaking conditions.
Each condition used two warmup batches of four fixtures and eight measured batches of eight fixtures.
Each fixture exercised all 36 public constructors and the ten required activation paths, including active overlay, delay, repeat, menu, and pointer-session teardown paths.
Every normal host tree was deliberately reconnected three times while an external Signal remained alive.
Constructors were registered once outside fixture closures so the custom-element registry could not retain individual fixtures through the harness.

All 20 predeclared checks passed without a threshold change.
Every synchronous removal check returned active external listeners, observers, timeouts, intervals, animation frames, and Signal sinks exactly to the browser baseline.
There were no detached Signal writes or remaining open dialogs/popovers, and each normal run balanced 256 probe connection starts with 256 stops.
The 40 recorded normal batch checkpoints preserve those counters and the bounded authored-node counts.
Thirteen baseline window listeners and one document observer were identified by creation stack as Playwright InjectedScript resources, not Base resources.

The independent post-GC check passed in all five normal runs:

| Metric                         | Final normal result |    Predeclared limit |
| ------------------------------ | ------------------: | -------------------: |
| Added DOM nodes                |      0 in every run |          At most 200 |
| Added CDP event listeners      |      0 in every run |            At most 5 |
| Added documents                |      0 in every run |            At most 1 |
| Median absolute DOM-node slope |         0 per batch | At most 10 per batch |
| Median JavaScript-heap growth  |       354,772 bytes |        At most 2 MiB |

The normal JavaScript-heap range was 354,768–354,772 bytes, with 24,592 added embedder-heap bytes in every run.
These nonzero heap deltas do not justify a zero-allocation or zero-retained-byte claim.

Every intentionally leaking run retained 64 additional document-root listeners, 64 external Signal sinks, 26,240 added DOM nodes, and 1,920 added CDP listeners.
Its median JavaScript-heap growth was 6,401,912 bytes, above the unchanged 1 MiB sensitivity minimum.
The predeclared positive-to-normal DOM comparison also passed its 10:1 minimum, using the one-node denominator floor when the normal median is zero.
The normal run-one heap snapshot contained four detached infrastructure nodes and no named Base fixture native elements; the positive snapshot contained 11,835 detached nodes including the expected fixture graph.

The durable artifact is `/Users/jonathan/Documents/Codex/outputs/aui-retention-2026-08-28`, including `PROTOCOL.md`, `plan.json`, source and bundle snapshots, rerun scripts, heap snapshots, and `results/STATUS.md`.
The final source SHA-256 is `c6cc4a9333d05e53ab1d45b7fe2d3068f8c99cc1bb6f4cccc75da18730a6053d` across its 75 runtime/package inputs.
The production fixture bundle SHA-256 is `2dc2b278c4d59d58dc9575a669ae04eab7126b31d4808d8ca9fdc9c388288dc7`.
The formal raw and analysis SHA-256 values are `85b0cdb8943e8d5900d5b9ffa3932f6952ab3ed30e717defec0192ff0e6ad5c0` and `3cd2d268c98b4f18dd25887474ffcdd3b9b047df1da9d1a084a3e347e6d5ca40`.

The exact counters establish synchronous cleanup for the exercised paths; forced collection only checks whether the browser's retained graph agrees with those counters.
Drawer and Scroll Area use an explicit fixture-local pointer-capture shim to exercise active-session teardown because synthetic PointerEvents cannot establish native capture.
Native pointer-capture integration, other compositions, cross-browser collection behavior, and universal leak freedom remain outside this result.
The earlier bounded smoke is preserved separately and does not contribute formal replications or substitute for sensitivity checks.

## Historical base lifecycle soak

The August 27 captures below measured checkpoint `0457b0f` before the Checkbox label-activation correction and subsequent component families.
They are historical evidence for those exact sources, not measurements of the final package.

Five fresh counterbalanced Chromium pairs exercised closed shadow roots, hidden groups, nested independently owned Base elements, external long-lived signals, and repeated reconnection of the same hosts.
Each normal run completed eight measured batches and 2,560 connection intervals after two warmup batches.
After every batch, the harness checked exact signal-sink and resource counters, forced collection through CDP, and recorded JavaScript heap, embedder heap, DOM nodes, and event listeners.

Every normal run ended at zero added DOM nodes, zero added event listeners, zero active external signal sinks, and 2,560 balanced resource starts and stops.
The normal final JavaScript-heap delta had a five-run median of 28,924 bytes.
The intentionally leaking control ended at 4,960 added DOM nodes, 1,040 added listeners, 1,360 active signal sinks, 1,040 resource starts with no stops, and a 1,754,932-byte JavaScript-heap delta in every run.
The normal heap snapshot had three detached browser-infrastructure nodes, while the leaking snapshot had 4,003 detached nodes in the expected fixture graph.
Every predeclared normal and positive-control criterion passed.

## Historical Checkbox lifecycle soak

The Checkbox extension used the production Checkbox inside native labels with checked, indeterminate, disabled, and read-only state variants.
Each host had one connection-scoped document listener and cleanup counter.
The positive control intentionally omitted the inherited disconnection lifecycle.

In the initial five-pair experiment, every normal run retired 800 Checkboxes with zero added DOM nodes, zero added listeners, 800 balanced resource starts and stops, and a final JavaScript-heap delta of 18,940 bytes.
The control retained 6,400 DOM nodes, 4,000 listeners, and 800 active resources, but its median 737,248-byte JavaScript-heap delta missed the predeclared 1 MiB sensitivity minimum.
The initial strict composite sensitivity verdict is therefore false even though every normal criterion and the other positive-control criteria passed.

A separately predeclared follow-up doubled only the fixture count to 200 per batch and preserved all thresholds.
Every normal follow-up run retired 1,600 Checkboxes with zero added DOM nodes, zero added listeners, 1,600 balanced resource starts and stops, and a final JavaScript-heap delta of 19,268 bytes.
The follow-up control retained 12,800 DOM nodes, 8,000 listeners, 1,600 active resources, and 1,374,680 JavaScript-heap bytes in every run, so every unchanged normal and positive-control criterion passed.
Normal snapshots in both Checkbox experiments contained only seven detached browser or automation infrastructure nodes; the corresponding controls contained 5,607 and 11,207 detached nodes in the expected label, shadow-root, slot, and Checkbox graphs.

The Checkbox entry tests one connection interval per created host and does not extend the base experiment's same-host reconnection coverage.
The first Checkbox run overlapped a separate Vite-triggered in-app-browser reload near the end, and an unresponsive in-app-browser tab may have remained active during the separately predeclared follow-up.
The exact lifecycle, DOM, and listener counts remain direct observations, while ambient load makes the heap readings supporting evidence rather than an absolute-memory-performance claim.
Neither experiment measures latency or compares Base with Base UI.

## Historical Chromium accessibility-tree check

A separate production Checkbox fixture was inspected through Chromium 151 `Accessibility.getFullAXTree`.
The control was exposed as a non-ignored `checkbox` named from its enclosing native label, with false, true, mixed, and disabled states represented in the corresponding cases.
Chromium did not serialize a read-only property for the Base Checkbox, a native checkbox with both its `readOnly` property and `aria-readonly` set, or an explicit ARIA checkbox with `aria-readonly` set.
The omission is therefore not isolated to ElementInternals by this evidence and does not justify adding duplicate ARIA attributes.
This is one Chromium accessibility-tree capture, not a claim about every browser, platform accessibility API, screen reader, or assistive technology.

## Historical evidence and shared limits

The historical artifact is `/Users/jonathan/Documents/Codex/outputs/aui-retention-2026-08-27`.
Its `base/` and `checkbox/` directories contain the predeclared plans, machine-readable samples, analyses, heap snapshots, exact source snapshots, captured production bundles, byte-identical rebuilt bundles, executable rerun harnesses, and detailed limitations.
The base raw result SHA-256 is `7f3f92d3be94505a5b299d5a60ed7444680fa5850dfafc8ad923e5f1f81e8800`.
The initial and follow-up Checkbox raw result SHA-256 values are `c0a435293d8bce5ed8005fbbe0beaa5c41a9c7357cc86bbebfe3bfe070c488fb` and `e818075d36ba13e98f9d49af7890f7a2e9c4192e5edaedfe82c263d20c70e650`.
The final Checkbox source SHA-256 is `4615bed85b49099411e52e7daee67cdecaa0a92fa9f3516d3eb53eb87954bcb1`.

Forced collection is used only in these explicitly labeled retention experiments.
It is not part of the runtime cleanup contract.
The decision depends first on synchronous deterministic cleanup and exact ownership counters, with post-GC heap and retained-DOM evidence used to check that browser retention follows the ownership model.
Small positive normal heap slopes mean the result supports bounded behavior for these workloads, not zero retained bytes or universal leak freedom.
