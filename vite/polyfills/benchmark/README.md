# Vite polyfills benchmarks

This harness measures the compiled public `@serve-tools/vite-polyfills` entry in Node.js.
It reports plugin creation separately from no-hit, single-hit, and multi-hit transforms through the public transform hook.
Each transform reparses a short application module, walks its real Oxc AST, produces its real MagicString result, and validates the expected imports inside the measured operation.

Build the package before running the warmed workloads:

```shell
npm run build --workspace @serve-tools/vite-polyfills
npm run benchmark --workspace @serve-tools/vite-polyfills
```

Select one workload with `--workload`:

```shell
npm run benchmark --workspace @serve-tools/vite-polyfills -- --workload transform-single-hit
```

The `cold-import-plugin-create` workload must run alone in a fresh Node.js process.
It records one target-module import plus one validated plugin creation, without JavaScript warmup; repeated fresh processes are the independent samples.
OS file caches may remain warm between paired runs.

```shell
npm run benchmark --workspace @serve-tools/vite-polyfills -- --workload cold-import-plugin-create
```

Set `VITE_POLYFILLS_BENCH_ENTRY` to compare another compiled production entry, such as a frozen baseline:

```shell
VITE_POLYFILLS_BENCH_ENTRY=/path/to/baseline/dist/vite-polyfills.js \
	npm run benchmark --workspace @serve-tools/vite-polyfills -- --workload transform-multi-hit
```

Warmed workloads use 5 unrecorded warmup batches and 15 recorded batches.
The output uses the repository's `[benchmark]` JSON format so independent paired logs can be compared with the benchmark-performance Skill tooling.
