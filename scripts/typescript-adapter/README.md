# TypeScript adapter development harness

The reusable implementation is now the experimental [`@serve-tools/rolldown-typescript`](../../rolldown/typescript/) workspace.
The keyboard pilot, integration tests, and benchmarks import its public package entrypoint, which is also used by external consumers.
Normal repository builds continue to use TypeScript CLI artifacts.
See the package README for supported compiler and host versions, public options, lifecycle ownership, and limitations.

## Run the keyboard pilot

From the repository root after `npm ci --ignore-scripts`:

```sh
npm run dev:typescript-adapter
npm run build:typescript-adapter
```

Both commands first build the plugin package, then select `client/keyboard/demo/tsconfig.json` and its referenced keyboard package.
Compiler outputs may be missing or stale on disk.
Production writes the demo bundle to its normal output directory; referenced package outputs remain in memory.

`runPilot` in `pilot.mjs` is a repository harness, not a package export.
Its optional asynchronous `prepare` callback runs before Vite loads configuration, allowing existing scripts to build configuration dependencies and generate assets.
The keyboard pilot does not require preparation; a separate fixture covers both cases.

## Validate

```sh
npm run check:typescript-migration
npm run test:typescript-adapter:node
npm run test:typescript-adapter:browser
npm run test:typescript-adapter:distribution
npm run verify
```

The distribution suite packs the package and installs its tarball into external consumers; it must not resolve implementation files through repository workspace links.
The browser suite uses Playwright Chromium, Firefox, and WebKit, including the real keyboard demo.
Install them with `npx playwright install chromium firefox webkit` when needed; Linux CI also installs their system dependencies.
The focused CI matrix covers macOS/Linux/Windows on Node 24 and Linux on Node 22/26.
Browser servers and native watcher tests need local-server sandbox escalation on macOS.

Tests of private compiler/export logic import package source directly, while plugin integration tests use the built public entrypoint.
`watcher.mjs` remains a standalone test/benchmark helper and is not distributed.
Generation maps, programmatic refresh, and timing/statistics fields on the internal plugin API are diagnostic implementation details, not supported package exports.
The synchronous `typescript()` factory starts initialization immediately; host hooks await it before accessing compiler state.
The [migration plan](../../TYPESCRIPT-7.1-MIGRATION.md) records acceptance results and the decision to keep normal CLI defaults.

## Benchmark

```sh
npm run benchmark:typescript-adapter -- --run --runs 5 --output /absolute/path/to/results.json
```

Run measurements with other builds and browser tests stopped.
The harness alternates independent CLI/adapter processes, verifies behavior and production chunks, and retains raw samples, environment/source hashes, phase timings, process counts, sampled native compiler RSS, and paired intervals.
It measures a small referenced fixture, not repository-wide performance.
The CLI retains four builders and two checkers; the pinned native API does not expose those controls.
For comparable phase timing, the benchmark explicitly awaits the plugin's configuration hook before reading initial compiler statistics.
Packaging is not evidence of a speed or memory improvement; the recorded measurements still favor retaining CLI defaults.
