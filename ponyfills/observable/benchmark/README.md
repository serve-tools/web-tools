# Observable component benchmarks

Run from the repository root with the pinned npm version and existing workspace dependencies:

```sh
npm run build --workspace @serve-tools/ponyfill-observable
npm run benchmark --workspace @serve-tools/ponyfill-observable
```

The suite imports the compiled package entry, uses the shared browser benchmark helper and reporter, and starts a fresh headless Chromium process per command.
It records 15 sample batches after 5 separate warmup batches, with output and lifecycle checks included in every operation.
Each JSON record reports iterations, mean, median, p95 batch milliseconds, and operations per second.
With 15 samples, the nearest-rank p95 is the largest batch duration, not an estimate of individual-operation p95 latency.
The unit is one complete public consumption or listener lifecycle, not one emitted value.

## Workloads and boundaries

| Workload                | Iterations per batch | Work included                                                                        |
| ----------------------- | -------------------: | ------------------------------------------------------------------------------------ |
| Subscribe, 1 value      |               10,000 | Subscription, notification, completion, output checks                                |
| Subscribe, 32 values    |                6,000 | Same, with 32 synchronous emissions                                                  |
| Subscribe, 1,024 values |                1,250 | Same, with 1,024 synchronous emissions                                               |
| Map/filter/drop/take    |                2,000 | Four operator stages, 72 upstream emissions, 16 outputs, early cleanup               |
| toArray, 256 values     |                1,000 | Iterator creation, collection, completion, Promise settlement                        |
| reduce, 256 values      |                1,000 | Iterator creation, reduction, completion, Promise settlement                         |
| first                   |                5,000 | First value, immediate upstream cancellation, teardown, settlement                   |
| Async iterator          |                2,500 | Fresh 32-value async generator, collection and settlement                            |
| Promise                 |                3,000 | Consumption of an already settled Promise and settlement                             |
| when/take               |                5,000 | Operator creation, listener registration, two Event allocations/dispatches, teardown |
| External cancellation   |                6,000 | Controller, listener, two Event allocations/dispatches, abort and removal            |
| Error/teardown          |               25,000 | Subscription, one value, error notification and teardown                             |

Reusable recipes, source arrays, the settled Promise, error object, and EventTarget are created outside timing.
Subscription state, iterator state, operator state, consumer callbacks and cleanup remain inside timing.
The checks include result counts and values, completion, early source stopping, teardown counts, and listener removal.
This is component coverage; it excludes UI rendering, network/server latency, scheduler delays, retained-memory profiling, and full application performance.
It does not establish performance on Firefox, WebKit, or Node.

## Comparing a candidate

Preserve a built baseline before editing, including all relative `dist` files.
An absolute compiled entry can be selected without changing either implementation:

```sh
OBSERVABLE_BENCH_ENTRY=/absolute/baseline/dist/ponyfill-observable.js \
  npm run benchmark --workspace @serve-tools/ponyfill-observable
```

For comparisons, isolate each named workload in its own fresh browser so previous workloads do not change its heap and JIT history:

```sh
npm run benchmark --workspace @serve-tools/ponyfill-observable -- --testNamePattern '^subscribe-1024-emissions$'
```

Run each command in a fresh process and alternate baseline/candidate order across at least five pairs.
Keep the suite, browser, batching, minifier, dependencies and machine identical, and do not run builds or other tests during collection.
Preserve all raw logs, including slow samples.
Use independent runs for inference; the 15 samples within one process are not 15 independent experiments.
Report each workload separately with a paired log-ratio confidence interval and a declared practical threshold.

The package build emits unminified ESM with declarations and source maps.
For runtime size, bundle the same compiled entry using Rolldown with `tsconfig: false`, `format: "es"`, `minify: true`, and `comments: false`, then count raw JavaScript bytes.
Do not count source maps, declarations or compressed tarball bytes as executable code.
Synthetic export-entry sizes are not an application bundle measurement.
