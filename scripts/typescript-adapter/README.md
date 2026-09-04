# Opt-in TypeScript compiler adapter

This internal pilot uses TypeScript `7.1.0-dev.20260904.1` to supply compiler-emitted workspace JavaScript and source maps directly to Vite or Rolldown.
It keeps package exports pointing to `dist` and leaves the repository's ordinary build, development, packaging, and release commands intact.
The exact nightly is checked because this code uses `typescript/unstable/async`; a newer compiler needs the migration probe and these acceptance tests before changing that check.

## Run the keyboard pilot

From the repository root after `npm ci --ignore-scripts`:

```sh
npm run dev:typescript-adapter
npm run build:typescript-adapter
```

These commands select `client/keyboard/demo/tsconfig.json` and automatically load its referenced package.
Referenced compiler outputs can be missing or stale on disk.
The production pilot writes the demo bundle to its usual output directory; package compiler outputs remain in memory.
The CLI path remains available through the existing workspace commands.

## Integrate an invocation

```js
import { typescriptProject } from "./scripts/typescript-adapter/plugin.mjs";

const plugin = await typescriptProject({
	configFile: "/absolute/path/to/tsconfig.json",
	cwd: "/absolute/path/to/project",
});

// Pass plugin to Vite or Rolldown's plugins array.
// If setup fails before the host owns it, await plugin.api.dispose().
```

Configurations and references establish the compiler graph; each package's `exports` establishes its public import addresses.
Public subpaths, export conditions, package side-effect metadata, and explicit bundler externals remain significant.
Declaration files are emitted for comparison but never served as runtime modules.
Ordinary query/hash postfixes preserve module identity, and `?raw` returns the compiler's JavaScript text.
Asset URL and worker query modes (`?url`, `?worker`, `?sharedworker`) are outside this pilot and fail explicitly; use the existing artifact workflow for those imports.
The adapter excludes referenced packages from Vite's dependency optimizer and returns compiler source maps with source text from the same snapshot.
Compilation errors reject new loads and appear in Vite's overlay; the browser can retain its last successfully executed state while the error is visible.
Successful updates conservatively re-emit the complete configured graph and invalidate its loaded modules, including transitive consumers of inlined constants.
Production builds pin one successful generation throughout module loading even if another refresh finishes concurrently.
Native hook filters select supported specifier forms and absolute JavaScript paths; handlers check the actual current project graph.
These coarse filters allow newly referenced packages and changed output directories without silently falling back to stale disk files, at the cost of more JavaScript hook calls than filters fixed to the initial graph.

One invocation reuses a single asynchronous compiler API for ordinary edits.
The host closes it when a build or server ends; explicit `plugin.api.dispose()` is also idempotent.
`plugin.api.refresh({ created, changed, deleted })` accepts absolute or cwd-relative filenames for programmatic updates.
`plugin.api.generation` exposes the last successful generation, including output text, project metadata, snapshot source content, and phase timings.
Treat its maps as read-only.
`plugin.api.error` records the last failed refresh, and `plugin.api.statistics` reports refresh and hook counts.

The session compares freshly parsed root files with each native snapshot.
If they disagree, it closes the API and retries once in a fresh session; ordinary edits retain the existing API.
A second mismatch fails before publishing output, and timing reports include any restart.

Vite supplies watcher events directly.
The pilot defaults Vite's `awaitWriteFinish` to 50 ms of stability with 10 ms polling before delivering an event to the compiler.
This prevents Chokidar's change-event throttle from losing the final write after a truncate/write save; it adds approximately 50–60 ms of watcher latency.
Explicit user watcher settings remain honored, including disabling this protection.
Standalone consumers can use `watchCompilerProject` from `watcher.mjs`, which uses cancellable native Node watchers, reconciles file contents, serializes compiler updates, and coalesces event bursts.
It watches directories individually and reattaches replaced directories so later writes remain observable after atomic saves on Linux.
Close the returned watcher when finished.
Native watcher tests need to run outside the macOS workspace sandbox, which can report `EMFILE` despite the same test passing outside it.

## Prepare configuration dependencies and assets

A plugin cannot compile a dependency needed to load the configuration that creates it.
Use `runPilot` from `pilot.mjs` with an asynchronous `prepare` callback to build configuration tools and generate or copy assets before Vite loads its configuration.
This callback should invoke the relevant existing build or asset scripts.
The keyboard pilot has no such preparation dependency.
The acceptance fixture separately compiles a configuration dependency and generates an asset before bundling.

## Validation

```sh
npm run check:typescript-migration
npm run test:typescript-adapter:node
npm run test:typescript-adapter:browser
npm run verify
```

The browser suite uses installed Playwright Chromium, Firefox, and WebKit.
Install them with `npx playwright install chromium firefox webkit` when needed; Linux CI also installs their system dependencies.
The focused CI matrix exercises native watchers on macOS, Linux, and Windows and Node compatibility on 22, 24, and 26.
The real keyboard demo test compares complete production chunk text and import graphs against ordinary CLI artifacts, then exercises keyboard input before and after a live compiler-source edit.
The [migration plan](../../TYPESCRIPT-7.1-MIGRATION.md) records actual completed runs, remaining limits, and the adoption decision.
An available CI job is not itself evidence that a platform passed.

The pilot covers ordinary Vite development and production builds plus direct Rolldown bundling.
Experimental bundled development and replacing package artifact builds are outside this pilot.
Performance measurements are separate from correctness tests; eliminating disk writes alone does not establish a speed or memory improvement.

```sh
npm run benchmark:typescript-adapter -- --run --runs 5 --output /absolute/path/to/results.json
```

Run measurements with other builds and browser tests stopped.
The harness alternates independent CLI/adapter processes, verifies behavior and production chunks, and retains raw samples, source hashes, phase timings, process counts, sampled native compiler RSS, and paired intervals.
It measures the small referenced fixture, not a repository-wide performance result.
The CLI retains `--builders 4 --checkers 2`; the native API uses its own defaults because the selected API does not expose those CLI controls.
