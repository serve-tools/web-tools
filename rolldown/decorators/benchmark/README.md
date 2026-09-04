# Decorator benchmarks

This harness measures mixed 8-entry and 32-entry decorator application through the compiled helper runtime.
Each operation creates a fresh class, its public member descriptors, and proposal-shaped decorator entries before applying them.
It validates the replacement identity and exact stable bucket order inside the measured operation.

The transform harness measures a large module whose only `@` characters occur in a string and comment, plus modules containing 8 and 32 decorated classes.
It calls the public plugin's real transform hook and validates no-hit and transformed output before sampling.

Build the package, then run the benchmark:

```shell
npm run build --workspace @serve-tools/rolldown-decorators
npm run benchmark --workspace @serve-tools/rolldown-decorators
npm run benchmark:transform --workspace @serve-tools/rolldown-decorators
```

Set `ROLLDOWN_DECORATORS_BENCH_RUNTIME` to compare another compiled `decorators.js` runtime, such as a frozen baseline:

```shell
ROLLDOWN_DECORATORS_BENCH_RUNTIME=/path/to/baseline/dist/decorators.js \
	npm run benchmark --workspace @serve-tools/rolldown-decorators
```

Set `ROLLDOWN_DECORATORS_BENCH_ENTRY` to compare another compiled plugin entry:

```shell
ROLLDOWN_DECORATORS_BENCH_ENTRY=/path/to/baseline/dist/rolldown-decorators.js \
	npm run benchmark:transform --workspace @serve-tools/rolldown-decorators
```

Each workload uses 5 unrecorded warmup batches and 15 recorded batches.
Run each candidate and baseline in at least five independent paired fresh Node.js processes, alternate their order, and compare the emitted `[benchmark]` JSON records.
