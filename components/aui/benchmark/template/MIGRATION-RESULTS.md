# Production template migration results, September 4, 2026

The owner-free template migration passes the revision-4 template latency criteria.
It improves repeated mounting and reconnection in this fixture; it does not establish a whole-library advantage over Base UI.
The standalone Checkbox bundle is materially larger.

## Template latency

Eight independent counterbalanced pairs ran each condition and workload in a fresh Chromium process, with 40 recorded observations per process.
The baseline is the exact frozen pre-migration bundle; the candidate uses the shipped `html` tag and returned `TemplateResult` layout.
The [protocol](README.md) fixes a 5% median regression bound and a 10% p95 regression bound, and requires a greater-than-5% mounting improvement.
Intervals are two-sided 95% Student-t intervals over the eight paired log ratios; nested observations are not treated as independent processes.

Ratios divide baseline latency by candidate latency, so values above one favor the candidate.
Absolute times are medians of process medians and represent the complete operation block in the first column.

| Workload                      | Baseline ms | Candidate ms | Median ratio, 95% interval | p95 ratio, 95% interval |
| ----------------------------- | ----------: | -----------: | -------------------------- | ----------------------- |
| Mount 1,000 elements          |        10.1 |          5.8 | 1.727 [1.697, 1.757]       | 1.473 [1.379, 1.573]    |
| 10,000 updates                |         8.6 |          8.7 | 0.986 [0.973, 0.999]       | 1.028 [1.005, 1.051]    |
| 10,000 reconnections          |        33.2 |         13.5 | 2.458 [2.436, 2.480]       | 2.441 [2.354, 2.532]    |
| 10,000 state-preserving moves |        33.9 |         34.3 | 0.988 [0.983, 0.994]       | 1.036 [0.996, 1.078]    |

The paired estimates correspond to approximately 42% less mounting time and 59% less reconnection time.
Update and movement medians are slightly slower, but their complete intervals remain within the fixed 5% bound.
Every acceptance workload clears the p95 bound.
The earlier prototype movement-tail regression did not reproduce in this isolated production experiment.

All 320 first-mount observations per condition remain below the twenty-quantum precision requirement.
They are descriptive only and support no cold-mount speed claim.
The baseline explicitly disposes its legacy standalone fragment during final cleanup while the candidate follows natural base-element suspension; this occurs outside timed work and prevents a memory claim from this comparison.
The experiment excludes layout, paint, native input latency, assistive technology, and other component workloads.

## Precision correction and retained evidence

Revision 3 stopped before completing its first pair because a candidate 1,000-reconnection block measured 1.8 ms against a 2 ms minimum.
The failed run remains intact and is not pooled with the new experiment.
Revision 4 increases reconnect and movement blocks to 10,000 operations equally for both conditions, leaves the inferential thresholds unchanged, and restarts all eight pairs.
Its separate precision preflight passed all eight condition/workload cases; the smallest recorded block was 3.05 times its required minimum.

The [raw results](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/formal-v4/results.json), [analysis](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/analysis-v4.json), [precision preflight](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/precision-v4/precision.json), and [build manifest](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/build-v4/manifest.json) retain exact bundles, source inputs, environment, and hashes.

## Executable weight

The matched one-Checkbox consumer grew from 17,278 to 26,665 raw minified bytes, from 5,752 to 9,088 gzip bytes, and from 5,196 to 8,171 Brotli bytes.
It is 12,188 raw bytes above the fixed 14,477-byte Base UI incremental target.
The new runtime fast path for static templates avoids binding allocations, but the generic materializer remains reachable in the bundle.
The [reproducible weight builds](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/weights/build-metadata.json) and [bounded size investigation](/Users/jonathan/Documents/Codex/outputs/aui-template-migration-2026-09-04/size-review/README.md) do not establish a safe small change that closes the gap.

See the [migration review](../../design/template-migration.md) for correctness, distribution, release holds, and the separate current Base UI comparison.
