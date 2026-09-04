# TypeScript 7.1 migration plan

Prepared September 4, 2026.
Status: Phases 0 and 1 complete and merged on September 4, 2026; the separate internal Vite/Rolldown pilot passed validation and evaluation, with CLI defaults retained.
The user subsequently authorized extracting the pilot into an experimental distributable package; the packaging record below supersedes the earlier internal-only placement decision while retaining CLI defaults.
The user subsequently authorized completing the remaining steps, landing the compiler migration, and including the accompanying package updates in that commit.
Publication remains outside this task.

## Intended outcome

Upgrade the repository from TypeScript 7.0.2 to a TypeScript 7.1 release locked to an exact tested version while preserving package behavior, declaration contracts, and existing verification coverage.
Then evaluate a compiler-backed Vite/Rolldown adapter that supplies compiled workspace JavaScript from memory, using TypeScript project references and Node's native watcher.
The compiler upgrade must be independently usable and reversible before the adapter becomes a default.

The adapter is a follow-on workstream within this strategy, not a prerequisite for accepting the compiler upgrade.
Keep normal package exports and published files pointing to `dist`.
Retain the CLI build path for package output, packaging checks, and an explicit fallback.
Once the adapter is enabled for a root TypeScript project, it must automatically derive workspace source/output associations from that project and its references.

## Implementation handoff

Start with the standalone tools in [`scripts/typescript-migration`](scripts/typescript-migration/README.md):

```sh
node scripts/typescript-migration/inventory.mjs
node --test scripts/typescript-migration/*.test.mjs
node scripts/typescript-migration/probe.mjs
```

The inventory reads compiler pins, dependency-build scripts, and project references without building or installing anything.
The probe generates a disposable fixture and can select an isolated compiler using `--compiler /absolute/path/to/typescript`.
Require adapter capabilities explicitly with `--require-adapter` when testing the Phase 2 candidate.
The tools leave workspace dependencies and build defaults untouched.
The [fixture validation record](scripts/typescript-migration/VALIDATION.md) identifies the tested compilers, outcomes, and probe source hash.

Use this plan as the durable task record and give each implementer only the relevant section, owned files, exact dependency-source pointers, and acceptance commands.
Keep current status, unresolved failures, and the next executable step in the resume checklist; link detailed command output from the migration workspace.
Record verified behavior separately from assumptions about an unstable API.

After authorization, run at most three initial workstreams: compiler/API compatibility, fixture and behavioral verification, and bundler integration discovery.
Give each stream disjoint file ownership; keep manifest and lockfile changes with the integration owner.
Share the selected API contract and fixture expectations before implementing the adapter.
Delegate an independent review of resolution, invalidation, and lifecycle behavior after the first complete fixture works.
Reviewers should reproduce failures with executable fixtures and browser observations.
The integration owner reconciles findings and runs the required checks on the combined result.

Build the adapter in this order: compiler capability probe, one-shot referenced-package bundle, repeated snapshot updates, then Vite HMR.
Each step must execute real emitted code before expanding to the next boundary.
Keep the first pilot on ordinary Vite development and production bundling; evaluate experimental bundled development separately against the selected Vite version.

## Verified starting point

These facts describe the checkout inspected on September 4 and must be refreshed when implementation begins.

| Area                     | Starting point                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Local runtime            | Node 24.16.0; root package manager is `npm@12.0.2`                                               |
| Compiler                 | TypeScript 7.0.2 at the root and in demo manifests                                               |
| Bundlers                 | Vite 8.2.2; Rolldown 1.2.7                                                                       |
| Build                    | `tsc --build tsconfig.build.json --builders 4 --checkers 2`                                      |
| Workspace inventory      | 82 workspaces, 10 demo bundle scripts, 35 explicit `build:dependencies` scripts                  |
| Dependency graph         | `scripts/sync-tsconfig-references.mjs` derives references from package dependencies              |
| Existing API use         | Async API for batched workspace diagnostics; sync API for editor benchmarks                      |
| Nightly inspected        | `7.1.0-dev.20260904.1`, source commit `e73c923cb58e9ea8cd75ba41c51b8d8886af3076`                 |
| API status               | Programmatic emit is available in that nightly; entrypoints remain under `typescript/unstable/*` |
| Current work to preserve | `signals/signals/README.md` was already modified before this plan                                |

The tested nightly is evidence, not an instruction to install a moving `next` tag later.
Prefer an appropriate stable 7.1 release if available at the start; otherwise record and lock the exact selected prerelease.
Keep compiler client code and its native executable on the same version.
Verify the selected release supplies the required native package on every supported host; downloading the JavaScript wrapper alone does not install its optional native dependency.
Do not change the declared Node support range merely because the preparation machine uses Node 24.

### Compiler-session validation fixture

Use `scripts/typescript-migration/probe.mjs` as the executable A → B → C fixture, with ordinary bare package imports, project references, a public exported subpath, and package exports pointing to `dist`.
Start with none of the packages having a `dist` directory.
Use canonical filesystem paths, obtain diagnostics from the API project session, and use `emitToString()` to produce JavaScript and declarations in memory.
Bundle the emitted JavaScript and execute the result.
Change a cross-package `const enum` value and verify that the consuming package's inlined value and executed result update.
General package resolution, Vite HMR, platform support, and performance require the separate acceptance tests below.

The fixture probes the exact compiler version for config parsing, project references, diagnostics, in-memory emit, filesystem updates, and disposal.
It compares emitted files with CLI output and checks stale `dist`, transitive type-dependent emit, type-error recovery, and source creation/deletion.
Its small test resolver supports the fixture's string exports; the production adapter still needs the export and host-integration rules below.
Run compatibility probes for APIs used by existing consumers before migrating them.
Record the full adapter probe separately in the isolated migration workspace and reuse it as the adapter's first regression test.
Report the failing capability and compiler version directly.
Failures in optional emit or adapter capabilities gate Phase 2; Phase 1 depends on the CLI and APIs its existing consumers require.
Use real workspace files as compiler inputs initially and keep emitted outputs in the adapter cache.
Place unstable compiler calls behind a small internal client boundary so version-specific adaptation stays localized.

## Phase 0: refresh and record the baseline

Begin only after the user's go-ahead.

1. Read current repository and package instructions, inspect `git status --short`, and identify work that must remain untouched.
2. Re-inventory compiler pins, direct compiler consumers, project references, and current scripts.
3. Resolve the chosen 7.1 version from official release information and registry metadata; inspect its actual exported API and native platform packages.
4. Record Node, npm, TypeScript, Vite, and Rolldown versions, platform, architecture, and the source revision being tested.
5. Establish a clean build and verification baseline under the current compiler in an isolated filesystem copy or another explicitly authorized checkout.
6. Preserve emitted JavaScript, declarations, source maps, export maps, and packed-file inventories for comparison.
7. Capture modest cold-build, no-change-build, and representative dependency-edit timings with the existing builder/checker settings.

Identify the critical path for a representative demo, including configuration bootstrap, asset preparation, type checking, and bundling.
Capture its production JavaScript sizes and loaded chunks alongside timings.
Record tracked-file changes before and after baseline commands so generated fixture churn is visible.

Use the same source snapshot for the old/new compiler comparison.
Record failures as failures, with their scope; do not weaken checks to obtain a migration baseline.
Do not install into or clean the shared checkout while unrelated work is still active.
Do not create commits or worktrees without the repository's required authorization.

## Phase 1: upgrade the compiler without changing build architecture

### Edit inventory

| Files or area                                                                                     | Required action                                                                                                |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Root `package.json`                                                                               | Use `7.1.0-0 - 7.1.0`; retain initial builder/checker settings                                                 |
| Ten demo `package.json` files                                                                     | Use the same TypeScript range as the root                                                                      |
| `package-lock.json`                                                                               | Regenerate with the pinned npm version; inspect native platform packages and unrelated churn                   |
| `scripts/typecheck-workspaces.mjs`                                                                | Check the async API, diagnostics ordering/gating, config overlays, CLI fallback, and disposal                  |
| `benchmark/typescript/harness.mjs`                                                                | Check sync API resolution, snapshot lifecycle, timing shapes, and extended-diagnostics parsing                 |
| `client/{keyboard,router}/benchmark/types.mjs`, `core/{router,http-contract}/benchmark/types.mjs` | Exercise all four editor benchmark consumers and their diagnostic/metric assumptions                           |
| `lit/signals/demo/vite.config.ts`                                                                 | Verify package-relative CLI lookup and decorator compilation; retain its implementation initially              |
| `benchmark/skills/agentic/`                                                                       | Check compiler launch paths, temporary fixture dependency resolution, and deterministic compiler-based grading |
| `scripts/sync-tsconfig-references.mjs`, `scripts/clean-build.mjs`                                 | Verify build-config selection, graph coverage, and output/build-info cleanup                                   |
| `.github/workflows/ci.yml`, `pages.yml`, `release.yml`                                            | Check runtime matrix and invocation compatibility; no workflow dispatch or publishing                          |

The demo manifests are under `client/{context,db,input,interaction,keyboard,messaging,shared-db,storage}/demo`, `client-signals/dom/demo`, and `lit/signals/demo`.
Recheck that list rather than assuming it stays complete.

Preserve the intentionally separate TypeScript 5.9.3 compiler in `core/http-contract-interop`.
Its test explicitly checks that version to validate an external generated-client consumer.
Do not globally replace all TypeScript version strings or historical benchmark results.

### Compatibility decisions

- Verify compiler methods against the selected release's exported declarations and implementation.
- In the inspected nightly, `project.parsedCommandLine.options` replaces the deprecated `project.compilerOptions` view; inspect before changing consumers.
- The sync API now exposes many methods as getter-returned callable functions with a `.gen` companion; existing `object.method(...)` calls remain valid, but verify timing calls, completions, heap profiling, diagnostics, and cleanup through the actual clients.
- Verify async diagnostics against CLI diagnostics on both valid and deliberately invalid fixtures.
- Cover config errors, syntax errors, semantic errors, and declaration errors; a changed API must not silently turn a failure into success.
- Preserve command-line `--noEmit` behavior in the batched typecheck runner and verify temporary config/reference resolution.
- Verify resource disposal on successful checks and failures so API worker processes do not leak.
- Audit direct and transitive tools that load the compiler API, including dev-only checker plugins and declaration generators; exercise their actual startup paths.
- Run the pinned `core/http-contract-interop` generation/consumer test to confirm its separate compiler still resolves correctly.
- Treat changed diagnostic text as distinct from changed error detection.
- Review any JavaScript or declaration differences; do not accept a broad snapshot rewrite without understanding its cause.
- Keep public API changes, unrelated source refactors, concurrency tuning, and dependency-script consolidation out of this phase.

### Validation sequence

Run the following in the migration workspace, with the pinned npm version and the selected compiler installed through the updated lockfile:

```sh
npm ci --ignore-scripts
npm run build:fresh
npm run typecheck:workspaces
npm run check:skills
npm run benchmark:types --workspace @serve-tools/client-keyboard -- --usages 25 --editor
npm run benchmark:types --workspace @serve-tools/client-router -- --routes 25 --editor
npm run benchmark:types --workspace @serve-tools/router -- --routes 25 --editor
npm run benchmark:types --workspace @serve-tools/http-contract -- --operations 25 --editor
npm run verify
npm run build:pages
```

Run focused API parity fixtures before the full verification command.
Start representative Vite demos through their supported build/dev workflow, load them in a browser, edit and rebuild a referenced dependency as required, and verify the displayed result and error recovery under the selected compiler.
A successful production build alone does not validate dev-server plugins.
Use local-server sandbox escalation on the first `npm run verify` attempt, as required by `AGENTS.md`; apply the same rule to any browser-test or benchmark commands that bind a loopback server.
The small type benchmarks above are compatibility smoke tests, not evidence of a performance win.
`verify` covers package checking and the deterministic Skill benchmark/test machinery; do not launch paid or externally connected agent evaluations for this migration.
The inspected CI runs on Ubuntu with Node 22, 24, and 26; full verification runs on Node 26, while Node 22 and 24 run the TypeScript build and Node tests.
Preserve that coverage and recheck the current matrix before adding or removing jobs.
Cross-platform watcher validation belongs to the adapter phase and is not already supplied by this CI matrix.
Do not push or dispatch workflows solely to run them without authorization.

Phase 1 is complete when the compiler specifications agree, required checks pass, intentional older compiler fixtures remain intact, output differences are explained, and diagnostics/API consumers preserve their behavior.
The existing on-disk build remains the default at this point.

## Phase 2: build an opt-in compiler-backed adapter

Start with one demo and a small referenced dependency chain after Phase 1 is green.
Use a plain TypeScript package first, then a package with transitive dependencies and a transform-sensitive case.
Do not decide a public package name or publish a new tool before the implementation demonstrates a useful shared boundary.

### Ownership

| Component                                   | Responsibility                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Existing workspace inventory and references | Identify local packages, build configs, and dependency roots                                                       |
| Persistent TypeScript API session           | Parse configurations, load projects, supply diagnostics and compiler-emitted outputs, update snapshots             |
| Adapter output cache                        | Associate canonical emitted filenames with JavaScript, declarations, source maps, and originating source files     |
| Vite/Rolldown adapter                       | Resolve supported workspace exports into the emitted-output cache, serve contents, and invalidate affected modules |
| Native Node watcher or host watcher         | Report filesystem changes to the session coordinator                                                               |
| Existing build/asset scripts                | Prepare tools needed to load configuration and any generated/copied assets                                         |

Use the async API in the live adapter to avoid blocking the bundler event loop on synchronous compiler requests.
Keep one active API session per coordinated build/dev invocation and reuse it for ordinary edits, rather than starting a compiler per file or transform.
If fresh parsed roots disagree with a native snapshot, close that API and retry once in a fresh session; a second mismatch fails before emission.
Derive source/output associations from TypeScript's parsed configs, references, and emitted output filenames.
The API does not itself provide a complete public solution-builder, watch host, or bundler package-resolution service in the inspected nightly.
Our integration still owns the connection between those pieces.

### Resolution and output rules

The configuration surface should be the root TypeScript project, discovered from the bundler root or supplied explicitly.
Load its reference graph through TypeScript's parsed configuration and associate each project's compiler-emitted filenames with its source files.
Use the existing package inventory and normal package `exports` to identify which public import addresses which output.
Serve that output from the compiler session without requiring the physical file to exist.
References establish project relationships and source/output associations; `exports` continues to define package names and public entrypoints.
This automatic behavior belongs to the adapter; TypeScript references alone do not change Vite/Rolldown's resolver.

- Preserve bare package imports and existing `exports`; do not expose arbitrary private source subpaths.
- Derive mappings for transitive referenced projects as well as direct dependencies.
- Use the same derived mappings for supported development and build invocations; the presence of old physical `dist` files must not change which compiler output is consumed.
- Restrict interception to known local workspaces and supported public entrypoints.
- Use native Rolldown hook filters for supported workspace specifiers and emitted-output paths, retaining handler checks for correctness; unrelated modules must not trigger compiler requests.
- Respect export conditions, subpaths, package side-effect metadata, and explicit bundler externalization.
- Resolve missing emitted files through the adapter before treating the absence of physical `dist` as a failure.
- Use a single canonical path identity for package roots, source files, configs, and emitted files, including symlinked workspaces.
- Return compiler-generated source maps with correct source locations; verify them through the bundler's map composition.
- Keep declaration-only outputs out of the runtime module graph.
- Detect errors before accepting new outputs; do not silently serve stale code as if compilation succeeded.
- Handle config/package metadata changes and deleted outputs, not only text edits in existing `.ts` files.
- Do not double-transform TypeScript-emitted decorators or other lowered syntax.
- Bootstrap any dependency imported by the bundler configuration before that configuration loads.
- Continue explicit generation/copy steps for assets the compiler does not produce.

### Watcher design

Use Node's built-in `fs.watch` with cancellation for the standalone coordinator.
Discover and watch directories individually: hosted Linux testing showed that Node's recursive watcher can retain a replaced file's old inode and miss subsequent writes.
Reuse host watcher events in Vite integration where that avoids duplicate subscriptions; keep the snapshot-update logic independent of event ownership.
Do not add a third-party watcher or require a TypeScript watch API.

Watch the necessary workspace inputs and configuration paths; exclude emitted outputs, caches, `.git`, and irrelevant dependency trees to avoid feedback loops.
Batch event bursts and reconcile them into created, changed, and deleted paths for `updateSnapshot({ fileChanges })`.
Treat rename events as a reason to inspect current filesystem state rather than a portable rename description.
Rescan the relevant scope when an event lacks a filename.
Serialize updates so changes arriving during compilation are processed in the next update and cannot be lost or publish older results after newer ones.
Stage each affected set of outputs under its compiler-snapshot generation and publish it atomically only after required diagnostics succeed.
Replace outputs and remove deleted entries before notifying the bundler; do not let one rebuild or HMR transaction read a mixture of generations.
Make failed updates visible and prevent failed or superseded generations from being announced as successful.
Close owned watchers, API sessions, snapshots, and other resources when the build/server stops.

Filesystem notifications and semantic invalidation are separate responsibilities.
A change in B may require new JavaScript from A even when A's source did not change, as the tested cross-package `const enum` demonstrates.
Start with a conservative correct invalidation policy over the loaded reference graph; narrow it only after proving correctness and measuring a benefit.
Do not report native watcher support as proof of complete cross-platform event equivalence.

### Acceptance tests

| Scenario                                                      | Required result                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Clean A → B → C fixture with no `dist`                        | Expected bundle executes; runtime outputs are supplied from memory      |
| Root TypeScript project and its references                    | Direct and transitive public imports resolve automatically              |
| Missing versus stale physical `dist` files                    | Both cases consume the same current compiler-session outputs            |
| Direct and transitive source edit                             | Dependent output and executed behavior update                           |
| Cross-package `const enum` or other type-dependent emit       | Consumers are re-emitted when required                                  |
| Exported subpath and forbidden private import                 | Public subpath works; private import remains rejected                   |
| Conditional export, external package, side-effect-only import | Normal bundler semantics are preserved                                  |
| Nested new file, atomic save, rename, delete, delete/recreate | No missed final state; removed outputs disappear                        |
| Edit during compilation and rapid successive edits            | Final output corresponds to the latest source state                     |
| Importer and dependency changed together                      | Each rebuild/HMR transaction reads one successful output generation     |
| `tsconfig`, extended config, or `package.json` change         | Relevant project/resolution state is refreshed                          |
| Symlink or equivalent canonical path                          | One module identity; no duplicate singleton or broken project reference |
| Compile error followed by repair                              | Error is visible; recovery produces current output                      |
| Generated asset and config-time package dependency            | Preparation happens before the dependency is needed                     |
| Source map and transformed decorator fixture                  | Debug locations and runtime behavior match the expected compiler output |
| Server/build shutdown                                         | No remaining owned watcher or compiler process                          |
| On-disk versus in-memory mode                                 | Equivalent public behavior and explained emitted-output differences     |

Run the watcher tests on macOS, Linux, and Windows before claiming portable support.
Exercise Vite development separately from Rolldown production bundling; success in one does not establish success in the other.
Run the same behavioral assertions through the CLI-produced artifacts and the in-memory adapter with the same compiler and inputs.
Check that each acceptance-table row has an executable case or an explicit unresolved status.
Use bounded waits for observable output and browser state, with failure diagnostics, rather than fixed sleeps.
Enable Vite's `server.forwardConsole` explicitly in the pilot harness to collect browser errors with compiler and bundler logs.
Assert the actual browser result after initial load, HMR, and error recovery; forwarded logs are supporting evidence.

## Phase 3: measure, then adopt deliberately

Compare the existing CLI build/watch path and the adapter on the same source revision, compiler version, machine, and concurrency settings.
Measure cold startup, no-change startup, direct edit, transitive edit, config edit, time until the browser observes the new behavior, and retained memory/process counts.
Separate type-checking time, emit time, bundling time, and end-to-end latency.
Record native compiler-process peak memory separately from the Node host, and count compiler requests and intercepted hook calls.
Compare production JavaScript size and initial loaded chunks so faster builds do not obscure delivery regressions.
Use repeated alternating runs and report the spread; do not infer a runtime or developer-experience win merely from eliminating disk writes.

Keep the adapter opt-in until correctness is green and measurements justify adopting it for the pilot.
Expand across the remaining demos only after validating packages with copied assets, decorators, side effects, and multiple exports.
Consolidate redundant dependency-build scripts in a later change using the existing inventory/reference machinery.
Update package documentation and consumer Skills together if a new public tooling contract is introduced.
Keep artifact-based package verification even if application development uses in-memory outputs.

## Reversal and completion

If the compiler upgrade cannot preserve required behavior, restore only the migration-owned manifest, lockfile, and API-consumer changes to their recorded baseline.
Reinstall from that lockfile and regenerate outputs/build-info files with the original compiler in the migration workspace.
Do not use destructive repository-wide resets or remove unrelated edits.
If only the adapter fails, disable it and use the retained CLI build path without undoing a successful compiler upgrade.

The migration is complete when Phase 1's criteria pass.
The adapter is complete only when its pilot and platform tests pass, its output semantics are demonstrated, and its measured tradeoffs are accepted.
Record these as separate outcomes so an unfinished adapter does not obscure a completed compiler migration.

## Phase 0/1 execution record — September 4, 2026

The authorized migration uses exact TypeScript `7.1.0-dev.20260904.1`, source commit `e73c923cb58e9ea8cd75ba41c51b8d8886af3076`.
The official iteration plan still schedules 7.1 stable for November 10, and registry metadata reports `latest: 7.0.2`; querying stable `typescript@7.1` returned no match.
The selected nightly is locked explicitly rather than installing the moving `next` tag.
The later range-only follow-up below changes the allowed manifest versions without changing the tested compiler.

Evidence and isolated copies are preserved in [`typescript-7.1-migration-20260904`](/Users/jonathan/Documents/Codex/typescript-7.1-migration-20260904).
The `baseline` and `candidate` directories began with identical tracked and untracked source snapshots from revision `3e0e933c090af18b91755d67b9a0dc43f19a84a6`, including the initial unrelated `signals/signals/README.md` edit.
This task did not modify git history, the index, branches, or worktrees.
The shared checkout later received concurrent CDN documentation edits, committed independently as `51cb25ec37f7d8b7c64111c3d8672792593b3fb9`; these were preserved.
The shared installed dependencies were not replaced while that work was active.
Baseline and candidate install, clean, build, browser, and package validation ran in the isolated copies.
After the concurrent documentation commit, `npm ci --ignore-scripts` refreshed the shared checkout from the validated lockfile; its prepared tests and compiler probe also passed.
The shared root now resolves `7.1.0-dev.20260904.1`, and the interop fixture still resolves `5.9.3`.

### Inventory and compatibility

- Runtime: Node `24.16.0`, pinned npm `12.0.2`, macOS Darwin `25.6.0`, arm64, Apple M5 Max; Vite `8.2.2`, Rolldown `1.2.7`.
- Inventory: 82 workspaces, ten demo bundles, 35 explicit dependency-build scripts, 153 validated TypeScript configurations, and 135 batched typecheck projects.
- The root and ten demo TypeScript specifications and the lockfile are migrated; `core/http-contract-interop` retains exact TypeScript `5.9.3` and its unchanged nested lockfile entry.
- The nightly exports the expected sync/async clients; the native executable and JavaScript client report the same exact version.
- Registry metadata verifies all seven declared native packages: Darwin x64/arm64, Linux x64/arm/arm64, and Windows x64/arm64.
- Compared with 7.0.2, the nightly omits native packages for AIX, FreeBSD, NetBSD, OpenBSD, SunOS, and Linux loong64/mips64el/ppc64/riscv64/s390x.
  No configured CI host is lost; availability on those omitted developer hosts is not claimed.
- CI remains Ubuntu with Node 22/24/26; full verification on 26 and build/Node tests on 22/24 are unchanged.
  Pages and release use Node 24; workflows were inspected, not dispatched.
  Executable results in this record are from macOS Node 24, not a claimed Linux or Node 22/26 run.
- The batched checker now reads `project.parsedCommandLine.options` instead of the deprecated alias.
  Diagnostic gating, order, command-line `--noEmit`, CLI fallback, builder/checker settings, and package exports are retained.

The prepared probes pass CLI/async/sync parity for valid, semantic-error, syntax-error, declaration-error, and config-error cases under both compilers.
The probe hash remains `8e9019aabe6331f87ac3394e9cfbc7eb1911dad8e9b87fe4f96df6b5f6ad1449`.
The old compiler reports optional emit support unavailable; the nightly passes the existing in-memory fixture checks as well.
Those fixture results do not implement or accept the optional adapter.

### Artifact and validation evidence

The initial clean-build comparison found byte-for-byte equality across 1,228 files: 407 JavaScript files, 399 declarations, 394 maps, and 28 other assets.
All workspace export maps match.
Packed inventories cover all 82 workspaces and differ only in the ten private demo `package.json` sizes, each increased by 15 bytes for the longer version string.
Public packed-file paths, sizes, and modes are unchanged.
The full output bytes, hashes, inventories, logs, and source-change audits are retained under `evidence/`.
Neither initial baseline validation nor candidate validation changed tracked source fixtures; candidate differences were the intended migration files.

| Check                                                                         | Result and evidence                                                                                                                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `npm ci --ignore-scripts`, `build:fresh`, `verify`, `build:pages`    | Passed; `evidence/baseline-*.log`                                                                                                                              |
| Candidate lockfile regeneration and `npm ci --ignore-scripts` with npm 12.0.2 | Passed; no unrelated dependency churn                                                                                                                          |
| Candidate clean build, workspace typecheck, and Skill checks                  | Passed; `evidence/candidate-build-fresh.log`, `candidate-typecheck-current-api.log`, `candidate-skills.log`                                                    |
| Four CLI/editor benchmark consumers at count 25                               | Passed; numeric compiler timings, diagnostics, completions, and native heap metrics recorded in `candidate-*-benchmark.log`                                    |
| Candidate full `npm run verify`                                               | Passed; `evidence/candidate-verify.log`                                                                                                                        |
| Candidate `npm run build:pages`                                               | Passed for all ten demos; `evidence/candidate-pages.log`                                                                                                       |
| Pinned external generated-client interop                                      | Passed within both full verification runs; TypeScript 5.9.3 retained                                                                                           |
| Actual batched checker failure fixtures                                       | Passed valid/noEmit, declaration/config errors, first-error ordering, exit propagation, and temporary-directory cleanup; `evidence/api-runner-acceptance.json` |

The full verification runs cover Node tests, deterministic Skill and compiler grading fixtures, package lint/type checks, and Chromium/Firefox/WebKit browser suites.
The browser suites retain one existing skipped test in each compiler run.
No paid agent evaluations, publication, or workflow dispatches were performed.

### Live-demo and independent review

Two fresh agents, with no inherited conversation history, independently reviewed the compiler/API consumers and validated the live Lit demo in a separate copy.
The review found no Phase 1 blocker.
The current sync benchmark calls, copied-compiler grading fixtures, cleanup/reference scripts, and CI commands require no changes.
A synthetic test can make the preexisting benchmark helper skip API close if snapshot disposal itself throws; no real candidate failure reproduced, and that optional hardening remains outside this migration.

The Lit demo passed nine browser assertions: initial decorated context/consume/property/computed/style/collection behavior, rebuilt dependency output, compiler-error overlay, repaired fresh output, and no unexpected browser errors.
A real dependency source edit followed by its ordinary workspace CLI build reached the browser after reload.
An OXC-valid semantic error reached the existing decorator plugin's package-relative TypeScript CLI, produced TS2322, and displayed the Vite error overlay; repair removed the overlay and displayed new values.
These checks validate the existing disk-based development path, not an in-memory adapter or automatic transitive HMR contract.
Edited sources, configuration, JavaScript, and declarations were restored and compared with the untouched candidate; both servers were closed.
Executable harnesses, logs, screenshots, and JSON assertions are in [`dev-validation-evidence`](/Users/jonathan/Documents/Codex/typescript-7.1-migration-20260904/dev-validation-evidence).

The production preview loaded one JavaScript chunk, `assets/index-Dz-TM67e.js`, with 69,261 file/decoded bytes and 20,360 gzip body bytes.
The browser rendered the compiled decorators successfully.
The same chunk and bytes occur in the baseline production build.
The representative critical path remains dependency-graph bootstrap, local demo typechecking, Vite configuration loading, per-example CLI decorator compilation, and bundling.
This demo needs no separate copied-asset step; the root build still runs other workspaces' existing asset preparation.

Final integrated `npm run verify` passed with the current options access and the captured concurrent documentation changes (`evidence/candidate-final-verify.log`).
The representative dev/preview observations are from one macOS Chromium run; broader browser coverage comes from the existing full verification suites.

### Descriptive build timings and completion

Three alternating old/new pairs ran after verification, installations, and the live-demo servers completed.
The cold case removes generated outputs and build-info files; it does not flush the operating system's filesystem cache.
The compiler command remains `node node_modules/typescript/bin/tsc --build tsconfig.build.json --builders 4 --checkers 2`.
The dependency-edit case temporarily adds an exported type to `signals/signal/src/signal.ts`, rebuilds, then restores the original source and rebuilds again.
The demo cases use its ordinary `npm run typecheck` and `npm run build:bundle` workspace scripts.

| Wall-clock milliseconds, median (min–max)                 | TypeScript 7.0.2          | TypeScript 7.1.0-dev.20260904.1 |
| --------------------------------------------------------- | ------------------------- | ------------------------------- |
| Clean TypeScript graph                                    | 1,326.2 (1,107.7–1,493.4) | 1,151.2 (884.5–1,206.7)         |
| No-change TypeScript graph                                | 308.0 (48.3–569.3)        | 305.4 (54.4–312.6)              |
| Referenced dependency type edit                           | 952.9 (935.4–1,157.2)     | 776.3 (759.5–834.4)             |
| Lit demo dependency bootstrap and local check             | 2,003.0 (1,022.9–2,065.9) | 2,083.2 (2,010.5–2,443.8)       |
| Lit demo configuration, decorator compilation, and bundle | 485.6 (470.4–531.0)       | 480.0 (462.5–504.6)             |

These are modest descriptive samples, not evidence of a performance improvement or equivalence.
In particular, no-change and demo-check timings vary substantially.
Raw samples, commands, and the reproducible measurement script are `evidence/build-timings.json`, `timing-commands.log`, and `measure-builds.py`.
The migration is accepted on compatibility and validation results, independently of performance or adapter adoption.

No Phase 0/1 blocker remains.
Shared dependencies, the eleven compiler specifications, the lockfile, and the batched checker are migrated; the intentionally older fixture and unrelated documentation are preserved.
The initial compiler migration changed only those manifests, the lockfile, the checker options access, and this plan.
The initial migration left preparation-tool source and the probe hash unchanged; the range-only follow-up adds inventory regression coverage.

The optional adapter was implemented and evaluated separately after subsequent user authorization; its execution record and adoption decision appear below.

### Manifest-range follow-up — September 4, 2026

At the user's request, the root and all ten demo manifests now declare `"typescript": "7.1.0-0 - 7.1.0"`.
This permits 7.1.0 prereleases through stable 7.1.0 and excludes 7.1.1 and later.
The lockfile continues to resolve exact `7.1.0-dev.20260904.1` and its matching native packages; `npm ci` remains reproducible.
The separate interop fixture remains pinned and locked to 5.9.3.
Historical compiler results and artifact comparisons above retain their actual tested versions and original manifest sizes.

The inventory's existing `compilerPins[].version` field preserves the literal dependency specification, including this range.
A regression case verifies that the range is reported unchanged and that the older 5.9.3 fixture remains identified.
Evidence for this follow-up is under `evidence/range-update/` in the migration workspace.
Validation passed: the lockfile audit found only eleven dependency-specification changes and no resolved-package changes; `npm ci --ignore-scripts`, all four preparation tests, the installed compiler probe, and full `npm run verify` succeeded.
Full verification includes Skill metadata checks, package checks, and Chromium/Firefox/WebKit browser suites; the final log is `evidence/range-update/verify-final.log`.
The independent range review found no blocking issue.

The compiler migration was subsequently reviewed and landed independently, and the prepared fixture became the first executable contract for the separate adapter pilot.
When selecting a newer compiler within the range, update the lockfile deliberately and rerun the compiler probes and repository validation before accepting it.

## Compiler landing and accompanying dependency updates

The user authorized including the already-present package updates with the compiler commit.
The combined lockfile retains TypeScript `7.1.0-dev.20260904.1` and updates Biome to `2.5.12`, Vitest and its browser/coverage packages to `5.0.0`, dprint to `0.57.1`, and the async-operation development dependency `ai` to `7.0.92`.
The intentional TypeScript `5.9.3` interop fixture is unchanged.
Vitest 5 requires three test-only compatibility changes: DOM types for the composites test configuration, `{ concurrent: false }` instead of removed `describe.sequential`, and per-project browser ports through `test.api` instead of deprecated `test.browser.api`.
Production library contracts and build defaults are unchanged.

The combined dependency set was installed with `npm ci --ignore-scripts` and passed full `npm run verify` in the isolated `compiler-landing` copy.
After the browser configuration update, root lint, all 135 TypeScript project checks, and the consolidated browser suite passed again with no deprecated browser API warning.
Fresh inventory, all four preparation tests, and the required adapter capability probe also pass against the exact installed compiler.
Evidence is under [`typescript-adapter-20260904/evidence`](/Users/jonathan/Documents/Codex/typescript-adapter-20260904/evidence), especially `compiler-verify-final.log`, `browser-consolidated-vitest5.log`, `compiler-inventory.json`, `compiler-preparation-tests.log`, and `compiler-probe.json`.
The opt-in adapter implementation and its follow-on validation remain separate from this compiler commit.
Compiler PR [#12](https://github.com/serve-tools/web-tools/pull/12) merged as `c5654a7cf7b453b8d7e1d273d0e1fb3114602b16` after [CI run 33895698244](https://github.com/serve-tools/web-tools/actions/runs/33895698244) passed Node 22/24/26, Bun 1.3.14, and Deno 2.9.5.
The Node 26 job ran full repository verification, including all three browser engines.
Post-merge [CI run 33896469482](https://github.com/serve-tools/web-tools/actions/runs/33896469482) and [Pages run 33896469602](https://github.com/serve-tools/web-tools/actions/runs/33896469602) also passed.

## Opt-in adapter execution record

The follow-on implementation lives under `scripts/typescript-adapter`; it introduces no public package or published entrypoint.
The keyboard demo can opt in with `npm run dev:typescript-adapter` or `npm run build:typescript-adapter`.
Existing scripts continue to use CLI artifacts by default.
The adapter checks exact TypeScript `7.1.0-dev.20260904.1`, reuses an asynchronous compiler session for ordinary edits, and conservatively checks and emits the complete referenced graph for each successful generation.
Source maps retain source text from the corresponding compiler snapshot.
Production module loading pins a generation, including when an explicit refresh completes in the middle of a build.

Independent review reproduced and fixed SSR condition selection, new-reference filter coverage, query preservation, and a mid-build race that previously produced result `22` from coherent generations whose results were `10` and `50`.
Native filters now select supported specifier forms and absolute JavaScript paths; strict handler checks restrict resolution/loading to the current graph.
This intentionally incurs more JavaScript hook calls than initial-graph-only filters while supporting configuration changes correctly.
Vite supplies filesystem events; standalone usage has a cancellable native watcher with content reconciliation, serialized updates, and callback-safe disposal.

### Verified local acceptance

| Scenario                                                                          | Executable evidence                                                                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Clean and stale `dist`, A → B → C, public and private imports, CLI output parity  | `plugin.test.mjs`, `session.test.mjs`, `browser.test.mjs`                                                                                                          |
| Direct/transitive edits and cross-package `const enum`                            | Session, watcher, and all three browser engines                                                                                                                    |
| Conditional exports, externalization, actual side-effect-only execution           | `exports.test.mjs`, `plugin.test.mjs`, `resolution.test.mjs`                                                                                                       |
| Nested create, atomic save/rename, delete/recreate, active-update and rapid edits | `watcher.test.mjs`                                                                                                                                                 |
| Importer and dependency changed together                                          | Watcher assertions and Chromium/Firefox/WebKit result histories                                                                                                    |
| Config/extended config/package exports/new external reference                     | `session.test.mjs`, `resolution.test.mjs`                                                                                                                          |
| Canonical symlink identity                                                        | Export/session fixtures and isolated real workspace links                                                                                                          |
| Compiler errors and repair                                                        | Diagnostic failures, Vite overlay, last successful page state, then current output                                                                                 |
| Generated assets and config-time dependency                                       | `pilot.test.mjs`, preparation before Vite configuration loads                                                                                                      |
| Decorators and composed source maps                                               | Exact runtime stamp and original throw location in all three browser engines                                                                                       |
| Disposal and callback failure                                                     | Native watcher/child-process handle checks, reentrant/idempotent close, terminated test processes                                                                  |
| Real keyboard pilot                                                               | `keyboard.test.mjs`: CLI and adapter chunk text/import graph identical, 2,792-byte `index-DWurnmyh.js`; real input reflects `Command` → `Command key` after reload |

The three-engine synthetic browser fixture preserves HMR and observes only coherent results during concurrent and rapid edits.
The real keyboard demo uses Vite's normal full-reload fallback because its application code does not accept HMR explicitly.
Production generation pinning has a deterministic adversarial regression test; the dev results establish the tested browser interleavings, not a formal guarantee covering every possible request schedule.
Asset/worker query imports (`?url`, `?worker`, `?sharedworker`) remain outside this pilot and reject explicitly; ordinary postfixes and `?raw` are covered.
Experimental bundled development, broader demo rollout, public packaging, and dependency-script consolidation are separate adoption decisions.

Local native watcher tests must run outside the macOS workspace sandbox, which reports `EMFILE` for the same watchers that pass outside it.
The focused CI matrix passed on macOS/Linux/Windows with Node 24 and on Linux with Node 22/26; detailed results follow below.
The combined adapter checkout passed `npm ci --ignore-scripts --cache /tmp/web-tools-npm-cache` and full `npm run verify`.
The cache override avoided a sandbox permission failure in the ordinary user npm cache; it did not change dependency resolution.
After final lifecycle hardening, the production/pilot tests and the complete three-engine plus real-keyboard browser suite passed again.
The in-flight source-edit regression and all three compiler-session tests also pass.
Logs: `evidence/adapter-verify-final.log`, `adapter-ci-install-final.log`, `plugin-disposal-final.log`, `adapter-browser-disposal-final.log`, and `session-inflight-final.log` in the adapter evidence workspace.
All ten Pages demo builds and Skill checks also passed (`adapter-pages-final.log`, `adapter-skills-final.log`).

### Cross-platform follow-up

Hosted Linux testing exposed a Node recursive-watcher failure after atomic file replacement: the next write stayed attached to the old inode and was not observed.
The standalone watcher now watches directories individually, rediscovers nested directories before reconciliation, and reattaches replaced directory identities.
A regression covers subsequent writes after both file and directory replacement.
Windows testing exposed compiler/API slash paths compared with native filesystem paths; the probe now normalizes path identities, and the adapter canonicalizes Vite event and module-graph paths before reconciliation and invalidation.
A focused HMR regression covers slash paths, query/fragment suffixes, ignored virtual modules, exact invalidation targets, and the updated executed result.
Both compiler clients send changed/created/deleted inputs through the documented file-URI identifier form to avoid native-path ambiguity at the protocol boundary.

The updated probe passes locally with required adapter capability (`evidence/compiler-probe-final.json`); its source SHA-256 is `ad44c41d43fde8dddc548dcf0c3eb2c3a78385a93434a9e5ced9a9e60e9e2e3e`.
Earlier probe hashes and results above remain historical evidence for their tested source.
All four native-watcher tests, all three plugin tests, and the complete four-test browser/keyboard suite pass locally after these fixes (`adapter-browser-portability.log`).
Hosted compiler CI initially timed out downloading browser dependencies from the Azure Ubuntu mirror, before running tests.
CI now selects Ubuntu's primary archive while preserving the same browser installation and verification commands.
Linux browser testing also exposed a truncate/write race: Chokidar's per-path change throttle could discard the final event after the compiler captured incomplete text.
The pilot now defaults Vite's write-settling policy to 50 ms of stability with 10 ms polling, while respecting explicit user watcher settings.
A split-write regression and a temporary polling negative control reproduced the stale-output failure with settling disabled and passed with it enabled.
The committed browser suite retains native platform watcher coverage, rapid edits, and explicit compiler-error recovery.
Full local `npm run verify` passed after the watcher/path fixes (`evidence/adapter-verify-portability.log`).
Windows then demonstrated a native snapshot-root problem: fresh configuration parsing found a newly created file, while the snapshot root list omitted it.
Both `invalidateAll` and explicit configuration-change notifications retained the stale roots, so neither is used as a workaround.
The session and standalone probe now compare fresh parsed roots with snapshot roots and replace the API once only when they disagree.
The retired API closes before replacement construction; a second mismatch fails without emission or a generation increment.
Timing includes both APIs and records the restart count.
Six preparation tests, five session tests, and all 21 adapter Node tests pass locally, including injected stale-root recovery, ordinary-session reuse, persistent mismatch failure, later repair, and disposal (`compiler-probe-recovery-tests.log`, `adapter-node-recovery.log`).
Full local verification also passed after root recovery (`adapter-verify-recovery.log`), and the final required-capability probe records the exact compiler and recovery policy in `compiler-probe-final.json`.

At runtime commit `bf9af992e46247e614ad537cb44f66ab83df9ffa`, all five jobs in [adapter CI run 33897577037](https://github.com/serve-tools/web-tools/actions/runs/33897577037) passed.
Each Node 24 platform passed Chromium, Firefox, WebKit, and the real keyboard pilot; Windows observed `Control and K` changing to `Control key and K` after reload (`evidence/windows-recovery-ci.log`).
The three Node jobs and Bun/Deno checks in [repository CI run 33897577019](https://github.com/serve-tools/web-tools/actions/runs/33897577019) also passed, including full verification on Node 26.
The final independent recovery review found no actionable correctness issues after inspecting bounded restarts, pending changes, generation publication, disposal, and combined timing.
The final test-only adjustment normalizes the partial-write observer path on Windows so its assertion observes the same dependency as Vite's slash-form event paths.
PR [#13](https://github.com/serve-tools/web-tools/pull/13) carries the separate internal adapter and this evidence record; its final revision reruns both CI workflows before landing.

### Measurements and adoption decision

After the path, write-settling, and root-recovery fixes, the final benchmark completed five independent CLI/adapter pairs in alternating AB/BA order on macOS arm64, Node `24.16.0`, TypeScript `7.1.0-dev.20260904.1`, and Chromium through Playwright `1.62.1`.
Each pair checks identical fixture inputs, browser results, and identical final production JavaScript: one initially loaded chunk totaling 1,514 bytes.
The separate real keyboard comparison remains 2,792 bytes in both modes.
Raw samples, exact environment/source hashes, compiler phase output, API/hook counts, and process observations are in `evidence/benchmark-recovery-final.json`.
The preceding implementation measurements are retained as `benchmark-final.json`, `benchmark-portability-final.json`, `benchmark-settled-final.json`, and `benchmark-config-invalidation.json`; a portability run overlapping a compiler probe is retained as `benchmark-portability-probe-overlap.json` and excluded from the final results.
Earlier failed or superseded harness records are retained separately and excluded from this result.

| Metric                                                           | CLI median | Adapter median | Paired CLI/adapter ratio, descriptive 95% interval |
| ---------------------------------------------------------------- | ---------: | -------------: | -------------------------------------------------- |
| Cold startup to browser observation                              |   397.4 ms |       385.3 ms | 1.033 [1.016, 1.049]                               |
| No-change startup with a fresh session                           |    88.0 ms |       343.0 ms | 0.256 [0.250, 0.263]                               |
| Direct edit to browser observation                               |   137.4 ms |       208.3 ms | 0.577 [0.488, 0.684]                               |
| Transitive edit to browser observation                           |   145.0 ms |       432.3 ms | 0.336 [0.330, 0.343]                               |
| Config edit to changed module response and correct browser state |    77.6 ms |       331.8 ms | 0.326 [0.114, 0.933]                               |
| Production bundling, separate from compilation                   |    12.2 ms |        13.6 ms | 0.923 [0.861, 0.991]                               |
| Node host peak RSS                                               |  226.5 MiB |      230.1 MiB | 0.990 [0.983, 0.998]                               |
| Sampled native compiler peak RSS                                 |  131.7 MiB |      333.3 MiB | 0.382 [0.324, 0.450]                               |

Ratios above one favor the adapter for these latency/memory metrics.
No-change startup recreates the adapter session while the CLI reuses its build-info files; it does not describe persistent-session HMR.
CLI compilation uses the retained four builders and two checkers; the API uses its own defaults because it does not expose those controls.
CLI aggregate phase timings and API request/phase timings are recorded separately rather than equating their internal accounting.
Native RSS is sampled every 50 ms and can miss short-lived peaks; Node wrappers and the Node host are separated from native compiler processes.
All ten measured workers report zero retained compiler processes after teardown.
These are descriptive intervals for five pairs on one machine and one small fixture, with no outliers removed; they are not a repository-wide or cross-platform performance claim.
The benchmark's existing-file edits do not exercise the exceptional root-recovery restart; its additional cost is not measured here.

Decision: retain the CLI workflow as the default and keep the adapter internal and opt-in.
Fresh-session restarts, direct/transitive edits, configuration edits, and sampled native RSS favor the CLI.
The small cold-start benefit does not justify those costs; no overall adapter benefit is established.
Production bundle bytes are unchanged; small production-bundling and Node-host memory differences also favor the CLI in this sample.
The current prototype does not pass the promotion gate for a public plugin or broader demo rollout.
That closes this evaluation without changing the successful compiler migration; a performance redesign and any eventual public package are separate work.

## Experimental package preparation — September 4, 2026

The reusable implementation now lives in `rolldown/typescript` as `@serve-tools/rolldown-typescript@0.1.0`.
The public `typescript()` factory accepts `configFile`, `cwd`, and additional export `conditions`; its plugin type supports Vite and Rolldown without importing either host's types.
Only the factory/options/plugin types and explicit `api.dispose()` lifecycle contract are public.
Compiler sessions, export resolution, generation maps, manual refresh, and timing remain implementation details.
The standalone watcher remains in the internal harness.

The keyboard pilot and plugin integration tests now import the built package by name.
Root opt-in commands build the package before invoking the pilot; ordinary demo and package builds retain CLI defaults.
The package uses normal resolution for the TypeScript manifest and loads the unstable API only after checking the supported version family.
The first broader peer dependency and runtime gate accepted `7.1.x || 7.1.0-dev.20260904.1`: all stable 7.1 patch releases, plus the tested nightly.
Valid build metadata is accepted according to npm SemVer rules; other minor versions and other prereleases are rejected.
The session reports the actual installed compiler version.
A focused policy test compares accepted/rejected examples with npm SemVer; this does not establish compatibility with unreleased compilers.
Optional host peers are Vite `^8.2.2` and Rolldown `^1.2.7`, tested at `8.2.2` and `1.2.7`; the declared Node range is `^22.14.0 || >=24.0.0`.
The original root/demo compiler range and intentional `5.9.3` fixture remain unchanged.

Extraction review reproduced a compiler leak when Vite middleware mode closed without an HTTP-server close event.
The plugin now disposes on `closeBundle` for that lifecycle too; a real middleware server executes the referenced graph, closes, and rejects further compiler work.
The final focused Node suite passes all 22 tests.
No other actionable issue remained in the independent runtime, metadata, and release review.

The package includes generated declarations beside JavaScript, explicit ESM exports, the license, README, and a compile-checked consumer Skill.
The Skill catalog includes its selection/usage tasks.
Shorter routing descriptions for the new package and existing decorator/keyboard Skills keep published metadata at the existing 7,900-character limit without removing their guidance.
The user selected package version `0.1.0` with the normal `latest` tag, anticipating TypeScript 7.1 stable before public use.
The temporary prerelease-specific release-planner changes have been removed.
Before npm publication, validate official TypeScript `7.1.0`; the current checkout retains its verified nightly, while stable 7.1 patch releases already satisfy the declared range.

The distribution test packs the built package and installs it into a temporary dependency root outside this repository.
It checks normal package resolution, a Rolldown-only installation with Vite absent, and then Vite installation; both public declaration checks use `skipLibCheck: false`.
Both hosts build and execute emitted code with source maps, and the Vite dev server serves and executes the project.
Referenced package `dist` and build-info files remain absent.
The incompatible-compiler case also removes the unstable API export, proving that the actionable version error occurs first.
The matrix now runs this packed-install test on all five existing OS/Node combinations; new hosted results are not inferred from the earlier internal-pilot CI runs.

Evidence and the locally prepared release are under [`typescript-package-20260904`](/Users/jonathan/Documents/Codex/typescript-package-20260904).
Clean installation, package typechecking, publint, ATTW's ESM profile, the required-capability compiler probe, the focused Node/browser/distribution suites, Skill checks, and release planning passed locally.
The initial full verification found the missing Skill benchmark catalog entry; that coverage was added and its checks passed.
Before the package-version correction, full `npm run verify` passed (`evidence/verify-final.log`), including the 22 adapter Node tests, Chromium/Firefox/WebKit plus the real keyboard pilot, and the external packed-install test with full declaration checking.
The new matrix test is configured but has not yet run on hosted runners for this package extraction; earlier cross-platform results above apply to their recorded commits.
The updated tarball is `release/serve-tools-rolldown-typescript-0.1.0.tgz`, with a SHA-256 companion and a release/attestation plan.
After the version correction, clean installation, release tests, Skill checks, package checks, and the external Vite/Rolldown tarball test passed again (`evidence/distribution-0.1.0.log`, `package-check-0.1.0.log`).
The version-only artifact is retained under `superseded-exact-compiler`, and the earlier prerelease artifact under `superseded-0.1.0-next.0`, as historical evidence.
After broadening compiler support, the refreshed inventory preserves the intentional TypeScript 5.9.3 fixture and all 18 required-capability probes pass on `7.1.0-dev.20260904.1` (`evidence/compiler-probe-7.1-range.json`).
The adapter Node suite now has 23 passing tests, including comparison of the peer range and runtime acceptance rules against npm SemVer for stable patches, the tested nightly, build metadata, and rejected versions.
Full `npm run verify` passed again after this compiler-range change (`evidence/verify-7.1-range.log`), including all type, package, Skill, Node, browser, and external Vite/Rolldown tarball checks.
Only prereleases of TypeScript 7.1 were available in the registry during this validation; stable 7.1 compatibility remains a declared target until an official release can run through the same suite.
The rebuilt `0.1.0` tarball declares the broader range and includes the matching runtime gate; its SHA-256 is `b69772956e9ab51d6de949e13981e24abe2bf1780cb27bb5697d2e81962d712a` (30,172 bytes).
This prepares distribution without publishing to npm or changing build defaults.

### Synchronous plugin API follow-up

The factory now returns the plugin synchronously, so hosts can use `plugins: [typescript()]` without an asynchronous configuration function.
One eager initialization promise owns session creation and the first compilation.
Vite awaits it in `config` before dependency optimization exclusions are read and in `configureServer` before watcher roots are added; `buildStart` gates direct Rolldown builds.
Resolution and loading also wait for initialization and queued updates.
Initialization failure closes the compiler and rejects host startup without an unhandled background rejection.
Disposal can be requested immediately and waits for initialization or compilation already in progress; repeated calls share completion.
Subsequent builds still refresh the graph, and diagnostic recovery remains available during development.

The current user-selected compiler peer range `~7.1.0-0` is synchronized with the runtime gate, lockfile, docs, and npm SemVer comparison tests.
It accepts stable 7.1 patch releases and 7.1.0 prereleases; the tested compiler remains `7.1.0-dev.20260904.1` on Node `v24.16.0`.
The package version remains `0.1.0`.
Package build/typecheck configuration explicitly includes its `.mjs` implementation and public TypeScript contract fixtures.

Final focused validation passed: 27 adapter Node tests, 4 browser tests (Chromium, Firefox, WebKit, and keyboard demo), the external Vite/Rolldown packed-install test, package typechecking, publint/ATTW's ESM profile, Skill validation, and 6 Skill catalog tests.
An independent lifecycle review verified installed Vite/Rolldown hook ordering; its early-disposal and background cleanup findings were addressed.
`npm ci --ignore-scripts` passed.
Full `npm run verify` was attempted and stopped during the root TypeScript build on existing unrelated configuration/type errors, including excluded dot-prefixed sources (`TS6307`) and missing browser globals (`TS2304`); those working-tree changes were preserved.
This run does not supersede earlier successful full-verification records with a new full pass.

Current evidence and the updated local release are in [`typescript-package-20260904/synchronous-api`](/Users/jonathan/Documents/Codex/typescript-package-20260904/synchronous-api).
The `release/serve-tools-rolldown-typescript-0.1.0.tgz` SHA-256 is `47791c47a42888262eda65727fe32c90ee5a1b3e1773cb4ef735bca888263364`.
Older tarballs above are historical artifacts and do not contain this synchronous API.
No git or npm registry mutation was performed for this follow-up.

### Commit preparation after formatting

The user's formatting changes are preserved, and the package and suite guides now consistently document the synchronous `typescript()` factory, `~7.1.0-0` compiler range, and supported host/Node versions.
The TypeScript package changes are isolated from unrelated staged AUI, Signal DOM, and configuration changes, including separate portions of shared manifests and suite documentation.
Clean installation and the repository build pass for this isolated change set.
The first full verification attempt reached the standalone watcher suite and failed once when an atomic replacement event was missed; the unchanged 27-test adapter Node suite passed on rerun.
The unused-code check also passed after the clean checkout's required build outputs were generated.
The remaining consolidated browser suites, all 4 adapter browser tests, and the external Vite/Rolldown packed-install test passed; Skill and formatting checks passed as well.
This records an intermittent watcher failure rather than claiming an uninterrupted full-verification pass.
Commit-validation logs are retained under [`typescript-package-20260904/commit-validation`](/Users/jonathan/Documents/Codex/typescript-package-20260904/commit-validation).
The archived tarballs above predate the final formatting and documentation corrections.

## Resume checklist

- [x] User authorized Phases 0/1; unrelated work was identified and preserved.
- [x] Starting versions, API shape, native platform packages, and CI matrix were refreshed.
- [x] Inventory, preparation-tool tests, and compiler probes were rerun; reports record exact versions, probe hash, and runtime.
- [x] Existing-consumer API checks and independent reviews passed; optional fixture emit capability is recorded separately.
- [x] Exact target compiler and unchanged intentional TypeScript 5.9.3 fixture are recorded.
- [x] Current-compiler baseline, comparable artifact bytes, export maps, and packed inventories are captured.
- [x] Root/demo specifications, lockfile, installed dependencies, and current checker API access are migrated.
- [x] Diagnostic parity, all four editor benchmarks, final full verification, and Pages builds passed.
- [x] Representative dev startup, dependency rebuild, browser error recovery, production preview, and pinned interop generator passed.
- [x] Descriptive build timings and their uncertainty are recorded.
- [x] Compiler migration is complete independently of the adapter.
- [x] Follow-on adapter clean-output, transitive-edit, watcher, source-map, export-semantics, and real-demo local acceptance tests.
- [x] Combined adapter full verification.
- [x] Adapter cross-platform CI.
- [x] Repeated adapter performance measurements and adoption decision: keep CLI defaults; do not promote this prototype.
- [x] Subsequently authorized experimental package extraction, public declarations, and internal package consumption.
- [x] External tarball installation, host/type validation, middleware cleanup, and full local verification.
- [x] Package version 0.1.0, latest-tag metadata, tarball, checksum, and release plan prepared.
- [x] Stable TypeScript 7.1 patch range, matching runtime guard, SemVer checks, and repeated full local verification.
- [x] Synchronous `typescript()` factory, lifecycle review, public types/docs/consumers, and focused validation.

The synchronous API implementation and focused validation are complete.
The shared working tree has the unrelated configuration/type errors recorded above; the isolated TypeScript change set completed all verification stages with the recorded watcher rerun.
The internal adapter PR subsequently passed its final checks and merged as `95789fa1d6489ecf2d1ad1e4d7ccae1febcf20b2`.
The newly authorized experimental package preparation is recorded above; broader default rollout and performance redesign remain separate work.
The prepared tarball can be distributed directly.
Hosted checks on the extraction revision and an explicitly authorized npm bootstrap publication remain release actions; no registry publication or provenance attestation has been performed by this preparation.

## Sources to refresh at the start

- [TypeScript 7 release and parallel project builders](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- [TypeScript 7.1 iteration plan](https://github.com/microsoft/TypeScript/issues/63703).
- [API feature roadmap](https://github.com/microsoft/TypeScript/issues/63875).
- [Exact API source corresponding to the inspected nightly](https://github.com/microsoft/TypeScript/blob/e73c923cb58e9ea8cd75ba41c51b8d8886af3076/packages/typescript/src/api/sync/api.ts).
- [Native filesystem watcher in the inspected Node release](https://nodejs.org/download/release/v24.16.0/docs/api/fs.html#fswatchfilename-options-listener).

### Recent implementation guidance

These sources were reviewed for the March 4–September 4, 2026 research window.
Their lessons inform the implementation sequence; their reported performance does not predict this repository's results.

- [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps), March 24: concrete completion criteria and independent evaluation of running software; keep orchestration proportional to the task.
- [Announcing Rolldown 1.0](https://voidzero.dev/posts/announcing-rolldown-1-0), May 7: native hook filters reduce unnecessary JavaScript plugin calls.
- [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988v2), June 23 revision of a February 12 paper: avoid duplicating repository overviews in agent handoffs and evaluate added context against real tasks; its Python-focused results do not establish TypeScript migration performance.
- [Vite 8.1 announcement](https://vite.dev/blog/announcing-vite8-1), June 23: bundled development is an experimental integration surface with its own compatibility requirements.
- [I ported Kubernetes to the browser](https://ngrok.com/blog/i-ported-kubernetes-to-the-browser), June 30: shared behavioral tests against a reference implementation catch semantic shortcuts and omitted cases.
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8), March 12, and [console forwarding configuration](https://vite.dev/config/server-options#server-forwardconsole): reuse browser-console forwarding for the pilot's debugging feedback.
- [Bundled-development design and feedback](https://github.com/vitejs/vite/discussions/22746), opened June 23 with August feedback: verify rapid-edit consistency and the selected version's plugin, watcher, and HMR capabilities directly.

Local implementation pointers: `scripts/workspaces.mjs`, `scripts/sync-tsconfig-references.mjs`, `scripts/typecheck-workspaces.mjs`, `scripts/build-demo-dependencies.mjs`, `scripts/build-pages.mjs`, `scripts/clean-build.mjs`, and `benchmark/typescript/harness.mjs`.
