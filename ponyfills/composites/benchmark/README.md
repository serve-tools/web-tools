# Composite benchmarks

See [the latest reduction results](RESULTS.md) for the selected candidate, rejected experiments, final paired intervals, and environment.

Build the package, then run this browser component suite from the repository root:

```sh
npm run build --workspace @serve-tools/ponyfill-composites
npm run benchmark --workspace @serve-tools/ponyfill-composites
```

The runner identifies the absolute compiled entry and its entry and sibling-JavaScript SHA-256 hashes in a leading `[benchmark-subject]` record.
It then starts one headless Chromium process and writes one `[benchmark]` JSON record per workload.
Each record has 5 unrecorded warmup batches and 15 recorded batches, with mean, median, nearest-rank p95 batch milliseconds, and operations per second.
The samples are descriptive measurements within one browser process, not independent repetitions.

To isolate one workload in a fresh process, pass its exact test name.

```sh
node ponyfills/composites/benchmark/run.mjs --workload unique-miss-registry-4096
```

The compiled entry is the default benchmark subject.
Set `COMPOSITES_BENCH_ENTRY` to an absolute or current-directory-relative compiled entry to compare a preserved baseline without changing source code.

```sh
COMPOSITES_BENCH_ENTRY=/absolute/baseline/dist/ponyfill-composites.js \
	node ponyfills/composites/benchmark/run.mjs --workload fresh-create-hit
```

## Workloads and boundary

| Workload                          | Iterations per batch | Distinct mechanism                                                           |
| --------------------------------- | -------------------: | ---------------------------------------------------------------------------- |
| `fresh-create-hit`                |               20,000 | Fresh source allocation and canonical matching against an existing composite |
| `reordered-key-hit`               |               20,000 | Key sorting before matching a canonical composite                            |
| `property-count-1-hit`            |               20,000 | One-property snapshot, sorting, and hit                                      |
| `property-count-8-hit`            |               10,000 | Eight-property snapshot, sorting, and hit                                    |
| `property-count-32-hit`           |                2,500 | Thirty-two-property snapshot, sorting, and hit                               |
| `unique-miss-registry-8`          |                  250 | Unique creation while a small live registry grows                            |
| `unique-miss-registry-4096`       |                  250 | Unique creation starting with a larger live registry and continuing to grow  |
| `negative-zero-normalization-hit` |               20,000 | Default `-0` to `0` normalization before a hit                               |
| `preserve-negative-zero-hit`      |               20,000 | Option-controlled `-0` preservation and distinct SameValue hit               |
| `nan-canonicalization-hit`        |               20,000 | NaN canonicalization before a hit                                            |

Each operation calls the public compiled `Composite` entry, creates its fresh source, and verifies the returned identity and observable result inside the timed batch.
Registry fixtures, target composites, result-storage capacity, imports, Chromium startup, and reporting are outside the timed region.
The unique-miss cases retain each result in a preallocated array because a growing _live_ registry is the workload under test; their setup populations are also outside timing.
The negative-zero and NaN workloads remain separate because they exercise different normalization paths: option-controlled zero preservation versus the NaN canonicalizer.

This is component-level coverage of composite construction and interning only.
It excludes application behavior, network or storage I/O, rendering, retained-memory profiling, garbage-collection forcing, package size, and performance in Firefox, WebKit, or Node.

For a decision-grade baseline/candidate comparison, build both entries first and run each named workload in its own fresh process at least five times, alternating baseline and candidate order.
Keep the browser, dependency tree, suite, workload, batch settings, and machine unchanged, preserve all raw JSON logs, and compare independent-run ratios rather than treating the 15 intra-process samples as replications.
