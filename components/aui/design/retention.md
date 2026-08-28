# AUI retained-heap evidence

Status: the measured AUIElement, Signal DOM, and Checkbox workloads returned to their post-warmup DOM, listener, signal, and connection-resource baselines after forced collection.
Positive leaking controls retained the expected component graphs.
This evidence is bounded to the exact production bundles, Chromium version, and workloads below and is not proof that every component graph is leak-free.

## Base lifecycle soak

Five fresh counterbalanced Chromium pairs exercised closed shadow roots, hidden groups, nested independently owned AUI elements, external long-lived signals, and repeated reconnection of the same hosts.
Each normal run completed eight measured batches and 2,560 connection intervals after two warmup batches.
After every batch, the harness checked exact signal-sink and resource counters, forced collection through CDP, and recorded JavaScript heap, embedder heap, DOM nodes, and event listeners.

Every normal run ended at zero added DOM nodes, zero added event listeners, zero active external signal sinks, and 2,560 balanced resource starts and stops.
The normal final JavaScript-heap delta had a five-run median of 28,924 bytes.
The intentionally leaking control ended at 4,960 added DOM nodes, 1,040 added listeners, 1,360 active signal sinks, 1,040 resource starts with no stops, and a 1,754,932-byte JavaScript-heap delta in every run.
The normal heap snapshot had three detached browser-infrastructure nodes, while the leaking snapshot had 4,003 detached nodes in the expected fixture graph.
Every predeclared normal and positive-control criterion passed.

## Checkbox lifecycle soak

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
Neither experiment measures latency or compares AUI with Base UI.

## Chromium accessibility-tree check

A separate production Checkbox fixture was inspected through Chromium 151 `Accessibility.getFullAXTree`.
The control was exposed as a non-ignored `checkbox` named from its enclosing native label, with false, true, mixed, and disabled states represented in the corresponding cases.
Chromium did not serialize a read-only property for the AUI Checkbox, a native checkbox with both its `readOnly` property and `aria-readonly` set, or an explicit ARIA checkbox with `aria-readonly` set.
The omission is therefore not isolated to ElementInternals by this evidence and does not justify adding duplicate ARIA attributes.
This is one Chromium accessibility-tree capture, not a claim about every browser, platform accessibility API, screen reader, or assistive technology.

## Evidence and limits

The durable artifact is `/Users/jonathan/Documents/Codex/outputs/aui-retention-2026-08-27`.
Its `base/` and `checkbox/` directories contain the predeclared plans, machine-readable samples, analyses, heap snapshots, exact source snapshots, captured production bundles, byte-identical rebuilt bundles, executable rerun harnesses, and detailed limitations.
The base raw result SHA-256 is `7f3f92d3be94505a5b299d5a60ed7444680fa5850dfafc8ad923e5f1f81e8800`.
The initial and follow-up Checkbox raw result SHA-256 values are `c0a435293d8bce5ed8005fbbe0beaa5c41a9c7357cc86bbebfe3bfe070c488fb` and `e818075d36ba13e98f9d49af7890f7a2e9c4192e5edaedfe82c263d20c70e650`.
The final Checkbox source SHA-256 is `4615bed85b49099411e52e7daee67cdecaa0a92fa9f3516d3eb53eb87954bcb1`.

Forced collection is used only in these explicitly labeled retention experiments.
It is not part of the runtime cleanup contract.
The decision depends first on synchronous deterministic cleanup and exact ownership counters, with post-GC heap and retained-DOM evidence used to check that browser retention follows the ownership model.
Small positive normal heap slopes mean the result supports bounded behavior for these workloads, not zero retained bytes or universal leak freedom.
