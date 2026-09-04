# Public template migration benchmark

This suite compares the frozen pre-migration public renderer with the final public `html` plus `AUIElement.layout()` return path.
It does not compare the isolated prototype with current source and does not reuse the prototype's formal timing as migration evidence.

The baseline is the exact `current.bundle.js` named and hashed by the frozen pre-migration manifest.
The candidate is rebuilt from `fixture.ts` against the current production `dist` entrypoints.
The build copies the verified baseline bundle into a new output directory so a formal result is self-contained without overwriting historical evidence.

## Workloads and invariants

Both conditions create the same counter and persistent-region DOM, set the same attributes and properties, attach the same owner-bound event, and expose the same benchmark API and semantic sinks.
The candidate counter uses the public owner-free `html\`...\``tag and returns its`TemplateResult`from`layout()`;`AUIElement` creates and owns the fragment.
The candidate smoke also checks a directive reference, event receiver, signal suspension while detached, and reconciliation of the same nodes on reconnect.

The base class has no terminal public disposal method.
The frozen baseline fixture explicitly disposes its `TemplateFragment` after removal, while the candidate can only remove its host and synchronously suspend the base-owned binding scope.
Teardown is outside all clocks, and the suite makes no retained-memory, allocation, or terminal-retirement equivalence claim.
This asymmetry is part of the shipped lifecycle change and must remain visible when interpreting later samples within one process.

| Workload      | Timed operation                                                                   | Recorded samples per process |
| ------------- | --------------------------------------------------------------------------------- | ---------------------------: |
| `first-mount` | Construct and connect one counter in a fresh page                                 |         40, descriptive only |
| `mount-1000`  | Construct and connect 1,000 counters                                              |                           40 |
| `update`      | Change two signals and await 10,000 completed updates                             |                           40 |
| `reconnect`   | Remove, update while detached, and reconnect the same edited counter 10,000 times |                           40 |
| `move`        | Reverse three persistent regions and toggle one hidden region 10,000 times        |                           40 |

Cheap exact output checks remain inside every timed operation.
Full DOM, identity, value, and active-sink checks run after warmups and after the recorded block.
The cold workload uses a new page per observation, so its full validation cannot warm the next observation.

## Frozen revision-4 protocol

Revision 3 stopped during pair 0 before either reconnect condition completed.
Candidate reconnect sample 0 took 1.8 milliseconds, below twenty observed clock quanta of approximately 2 milliseconds.
The incomplete attempt, its progress file, and its failure log are preserved under the migration artifact's original `formal` directory and contribute no comparative conclusion.
Its completed mount and update observations show both conditions comfortably above the precision floor: the minimum mount result was 2.65 times the floor and the minimum update result was 4.1 times the floor.

Revision 4 is a precision-only correction made before any complete pair existed.
It increases reconnect and movement blocks from 1,000 to 10,000 operations equally for both conditions.
Mount, update, condition ordering, pair count, warmups, recorded observations, correctness checks, practical thresholds, and analysis remain unchanged.

Every workload and condition in each pair runs in a fresh Chromium process.
This prevents update, reconnect, or earlier mount history from contaminating the movement workload that produced the prototype experiment's unstable tail.
Eight independent pairs are counterbalanced separately for every workload.
Steady workloads use three warmups and forty recorded observations; cold mount uses forty new pages and no warmup.
Forty samples make nearest-rank p95 the second-slowest observation rather than the maximum.

Inference uses paired process summaries, never the forty nested observations as independent runs.
The analyzer reports paired geometric baseline/candidate ratios and two-sided 95% Student-t intervals over log ratios with seven degrees of freedom.
Values above one favor the candidate.

The primary `mount-1000` median interval must be entirely above 1.05.
Update, reconnect, and movement median intervals must be entirely above `1 / 1.05` to rule out a material regression.
Every acceptance workload's p95 interval must be entirely above `1 / 1.10` to rule out a material tail regression.
An interval crossing a boundary is inconclusive.
Cold one-element timing is always descriptive because one operation may remain below twenty measured clock quanta.
No outlier is discarded and no threshold or sample count may change after results are observed.

If the isolated movement p95 regression reproduces, profile it only in a separate diagnostic run after preserving the formal result.
Do not add profiler overhead to the formal samples or claim a garbage-collection cause from latency alone.

The suite measures JavaScript completion in headless Chromium.
It excludes paint, input-to-screen latency, assistive technology, forced garbage collection, retained memory, and whole-application performance.
Allow approximately four to eight minutes for the eighty fresh Chromium processes and the cold-page observations on the recorded Apple M5 Max environment.

## Commands

Build AUI and Signal DOM before building the fixture.
Smoke and weight checks are not formal timing and may run before the quiet slot.

```sh
MIGRATION_ARTIFACT=/path/to/aui-template-migration-2026-09-04
HISTORICAL_ARTIFACT=/path/to/aui-comparison-aggregate-2026-08-28

node components/aui/benchmark/template/build.mjs \
  --baseline-manifest "$MIGRATION_ARTIFACT/baseline/template/manifest.json" \
  --output-dir "$MIGRATION_ARTIFACT/build-v4"

node components/aui/benchmark/template/run.mjs \
  --smoke \
  --build "$MIGRATION_ARTIFACT/build-v4/manifest.json" \
  --output-dir "$MIGRATION_ARTIFACT/smoke-v4"

node components/aui/benchmark/template/run.mjs \
  --precision \
  --build "$MIGRATION_ARTIFACT/build-v4/manifest.json" \
  --output-dir "$MIGRATION_ARTIFACT/precision-v4"

node components/aui/benchmark/template/weight.mjs \
  --baseline-distribution "$MIGRATION_ARTIFACT/baseline/distribution" \
  --historical-artifact "$HISTORICAL_ARTIFACT" \
  --output-directory "$MIGRATION_ARTIFACT/weights"
```

Run the formal comparison only after correctness work, builds, indexing, tests, and other agents are idle and the primary agent confirms the quiet slot.

```sh
node components/aui/benchmark/template/run.mjs \
  --confirmed-quiet-slot \
  --build "$MIGRATION_ARTIFACT/build-v4/manifest.json" \
  --output-dir "$MIGRATION_ARTIFACT/formal-v4"

node components/aui/benchmark/template/analyze.mjs \
  "$MIGRATION_ARTIFACT/formal-v4/results.json" \
  --output "$MIGRATION_ARTIFACT/analysis.json"
```

## Corrected AUI versus Base UI mount comparison

The preserved aggregate Checkbox acceptance harness is not suitable for a new mount claim as written.
Both preserved mount paths capture their duration before full semantic validation, but they still perform that validation after every mount; prior diagnostics showed that repeated full validation changes later AUI mount measurements.
The corrected comparator separates block-final validation from the per-operation completion path in both fixtures.
Reusing its historical numbers would also compare different source states rather than a contemporaneous pair.

A corrected production comparison should rebuild the current public AUI Checkbox and the pinned Base UI 1.7.0 plus React 19.2.8 fixture together, use fresh counterbalanced processes, keep only cheap retained-reference output checks inside each mount, and run equivalent full semantic validation once after warmups and once after the recorded block.
It should preserve separate 100-control and 1,000-control workloads, use at least eight pairs and forty observations for p95, and keep the same 5% median and 10% p95 bounds used here.
That comparison remains a separate experiment because framework lifecycle and DOM shape differ from the template fixture.

`weight.mjs` does perform the bounded production weight comparison without making a runtime claim.
It rebuilds the exact preserved one-checkbox input against both the frozen AUI distribution and the current candidate, plus Base UI and native React from the pinned closure.
The fixed raw-minified target remains Base UI's 14,477-byte increment over native React.
The candidate-minus-baseline AUI delta reports the shipped cost of the public API and migrated Checkbox together; it cannot attribute bytes to a single internal helper.
