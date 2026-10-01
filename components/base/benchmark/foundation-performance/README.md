# Foundation lifecycle performance

Compare identical production component bundles before and after a foundation change.
Build both using `benchmark/reduction/measure.mjs`; each directory must contain matching `sizes.json` and `full-library.standalone.min.js`.
The runner verifies the bundle hash and byte length before starting.

```sh
node components/base/benchmark/foundation-performance/run.mjs /path/to/before --smoke
node components/base/benchmark/foundation-performance/run.mjs /path/to/after --smoke
```

## Timing protocol

Run five independent counterbalanced before/after pairs in a quiet window, with no concurrent builds, tests, or other browser automation.
Each condition starts a fresh Chromium process and each workload a fresh page/context.

```sh
node components/base/benchmark/foundation-performance/run.mjs /path/to/before --timing
node components/base/benchmark/foundation-performance/run.mjs /path/to/after --timing
```

The primary comparison is paired median batch latency with a predeclared 5% practical threshold; inspect mean and p95 independently.
Record pair identity, order, runner hash, and each raw process log.
Five warmup batches precede thirty recorded batches.
Construction batches contain 100,000 elements so occasional collection work is less likely to move a median between short timing bands.
This is an allocation-heavy diagnostic, not a typical application mount.
Lifecycle batches contain 1,000 create/connect/remove operations; reconnect batches contain 1,000 append/remove operations on a previously initialized Checkbox; update batches contain 10,000 public checked-property changes.
The batch boundary includes two promise checkpoints, covering queued observers; output checks follow the clock.
No garbage collection is forced during timing.
Every recorded batch must span at least twenty observed clock quanta.

The lifecycle cases guard against merely moving construction work into connection.
The reconnect and update cases guard already-initialized paths.
The boundary measures JavaScript and observer completion, not painting or physical-input latency.

## Retained JavaScript heap

Run this diagnostic separately from timing, in five independent counterbalanced pairs:

```sh
node components/base/benchmark/foundation-performance/run.mjs /path/to/before --memory
node components/base/benchmark/foundation-performance/run.mjs /path/to/after --memory
```

For each component, capture Chrome's JavaScript heap after explicit garbage collection, retain 10,000 disconnected elements, collect again, release references, and collect once more.
The retained increase measures live JavaScript heap attributable to that fixture; it excludes native DOM/browser memory and is not a total-memory or leak proof.
Explicit GC is appropriate only for this retained-object diagnostic and never affects timing runs.
Report release residuals separately, since runtime caches can outlive the fixture.
