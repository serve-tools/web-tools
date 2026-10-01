# Whole-package reduction

This suite compares frozen builds of the entire Base components workspace with identical dependencies and production bundler settings.
It retains every public export, including the separate template entrypoint, and measures every individual subpath.
The baseline must be copied before editing source; retain its `src`, `dist`, package manifest, README, license, and the dependency lockfile.

## Size

```sh
node components/base/benchmark/reduction/measure.mjs /path/to/baseline /path/to/results/before
node components/base/benchmark/reduction/measure.mjs components/base /path/to/results/after
```

`standalone` includes all reachable foundations.
`component` externalizes BaseElement, the template entrypoint, and signal packages, using canonical external names for comparable import bytes.
The latter follows the component-only accounting used for framework comparisons; it is not a complete application download size.
Both modes preserve exported classes and their methods, rather than measuring an empty import that tree-shaking can delete.
`full-library` retains the root barrel; `all-public` additionally retains every subpath as a namespace.
Individual module totals minify emitted JavaScript with imports externalized and tree-shaking disabled; they include internal modules and are distinct from application bundle size.
Raw uncompressed JavaScript bytes exclude comments, declarations, and source maps.
Source physical-line counts include comments and blank lines.

Measure actual package tarballs independently with `npm pack --ignore-scripts --json --pack-destination /path/to/results` from the package directory.
Do not compare an old distribution against newly edited source, leave orphan generated files in `dist`, or count test/documentation deletion as executable savings.

## Runtime

Finish builds and tests before starting a quiet measurement window.
Smoke-check both conditions first:

```sh
node components/base/benchmark/reduction/run.mjs /path/to/results/before --smoke
node components/base/benchmark/reduction/run.mjs /path/to/results/after --smoke
```

Run five independent pairs, alternating before/after and after/before order, with no concurrent builds, tests, or automated browser activity.
Each invocation starts a fresh Chromium process and isolates each workload in a fresh page/context.
The runner verifies bundle bytes and SHA-256 against the measurement metadata before launch.

```sh
node components/base/benchmark/reduction/run.mjs /path/to/results/before --confirmed-quiet-slot
node components/base/benchmark/reduction/run.mjs /path/to/results/after --confirmed-quiet-slot
```

The fixed workloads exercise Calendar month rendering, Field state refresh, selection among 100 options, disconnected Checkbox/Option creation plus disabled reflection, and separate construction-only batches with a retained instance sink.
Setup is outside timing; each operation checks its output, and each batch drains two promise turns for the component observers.
Five warmup batches precede thirty recorded batches, whose raw durations are retained.
Every measured batch must exceed twenty observed clock quanta.
The boundary includes JavaScript and observer completion but not paint, physical input latency, or general application performance.

Use the benchmark-performance skill's comparison script with `--metric medianMilliseconds --minimum-effect 0.05`, then inspect `p95Milliseconds` separately.
Treat fresh processes as independent observations; do not treat batches inside one process as independent runs.
An inconclusive result is neither a speedup nor proof of equivalence.

## Candidate decisions

| Candidate                           | Mechanism and risk                                                                                    | Gate                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Unused DisposableElement experiment | Remove an unexported, unconsumed candidate explicitly excluded from supported bases                   | Consumer search, package and public export checks                             |
| ScrollArea rail ownership           | Reuse existing value/priority ownership instead of parallel machinery                                 | Author edits, priority, replacement, disconnect/adoption tests                |
| Field refresh                       | Remove one-use state object and wrapper; preserve atomic reads before participant mutation            | Reentrant and throwing getter regression                                      |
| Collection commits                  | Remove duplicate scans between consecutive synchronous checks; flatten identical Set updates          | Existing cancellation/reentrant transaction tests                             |
| NavigationMenu resolution           | Reverted a 147-byte saving: snapshot reuse missed synchronous author retargeting during popup cleanup | Added two reentrant native-event regressions                                  |
| Listbox synchronization             | Consume existing records instead of temporary arrays and invalid-option Sets                          | Live values after ID reactions, duplicates, selection and form tests          |
| Calendar render                     | Reuse render-local formatters and eliminate redundant render/writes                                   | Gregorian labels, bounds, locale, focus, runtime comparison                   |
| Popover event forwarding            | Merge duplicate forwarding while preserving cancellation and popup identity checks                    | Synthetic cancelable toggle and native opening/closing tests                  |
| Shared disabled base                | Share identical reflection without adding it to BaseElement                                           | Public types, construction/reflection workload, individual-entry bytes        |
| Tabs attribute owner                | Retain local owner: shared implementation would add roughly 330–430 bytes to standalone Tabs          | Rejected on entrypoint weight, despite possible aggregate savings             |
| Avatar event settlement             | Share load/error generation and source validation without weakening stale-request guards              | Loading, failure, adoption, external-src and fallback tests                   |
| Meter/Progress reflection           | Share identical native attribute-copy policy                                                          | Native numeric conversion and state tests                                     |
| Generic selection/group controller  | Retain distinct transaction and ownership models                                                      | Rejected: configuration and callbacks would move complexity and risk behavior |

See the [September 15 results](RESULTS-2026-09-15.md) for accepted changes, measured tradeoffs, and remaining boundaries.
