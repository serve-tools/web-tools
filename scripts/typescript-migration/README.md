# TypeScript migration preparation

These standalone tools prepare and validate a future compiler migration.
They do not upgrade dependencies, edit repository source, or change build defaults.
Run them from the repository root with its installed dependencies.
See [validated compiler results](VALIDATION.md) for the exact tested versions, fixture outcomes, and probe source hash.

## Refresh the inventory

```sh
node scripts/typescript-migration/inventory.mjs
node --test scripts/typescript-migration/*.test.mjs
```

The inventory reports compiler dependency specifications, workspace build scripts, and project references as JSON.
The existing `compilerPins[].version` field preserves the literal manifest value, including ranges such as `7.1.0-0 - 7.1.0`; the probe reports the exact installed compiler version.
Refresh it when implementation begins so the migration uses the actual package list.
Use `--root /absolute/path/to/checkout` to inspect another checkout.
Compiler-consumer candidates come from literal module-specifier searches and need review; computed specifiers may be missed and test strings may match.
Older compiler pins are identified by version, without assuming why they are present.
The inventory reads the repository's JSON configuration files directly; it is not a substitute for the compiler's configuration parser.

## Check a compiler

```sh
node scripts/typescript-migration/probe.mjs
```

The probe uses the repository's installed TypeScript by default.
It creates its own temporary fixture, runs the CLI and both native API clients, closes sessions, and removes the fixture on completion.
All CLI emission and file edits happen inside that temporary directory.
CLI invocations have a 30-second timeout.
The probe prints JSON and exits unsuccessfully if a required assertion fails.

To examine another installed compiler without changing this repository:

```sh
node scripts/typescript-migration/probe.mjs \
  --compiler /absolute/path/to/isolated-install/node_modules/typescript \
  --require-adapter
```

Supply the package directory, not its containing `node_modules` directory.
The isolated installation must include the compiler's native platform dependency.
For separately unpacked compiler packages, `--native /absolute/path/to/native/tsc` selects the executable; its reported version must match the JavaScript client package.
Select an exact compiler version and record it with the results.
The probe never downloads or installs a compiler itself.

Without `--require-adapter`, a missing `Program.emitToString` capability is reported as `unsupported` after the existing-consumer compatibility checks pass.
With that flag, missing emit support is a failure.
An exposed but malfunctioning capability always fails the probe.
This keeps compiler-only compatibility separate from readiness for the optional adapter.

## Compatibility checks

- The executable and JavaScript client report the same compiler version.
- The CLI, sync API, and async API agree on diagnostic codes for valid code and semantic, syntax, declaration, and configuration errors.
- Sessions and snapshots complete their disposal calls and the temporary fixture is removed.

## Adapter checks

These checks run only when `Program.emitToString` is available.
Use `--require-adapter` to require them for acceptance.

- Parsing one root configuration discovers the complete A → B → C reference graph.
- Public package exports identify emitted files, including an exported subpath, while the packages initially have no `dist` directories.
- Rolldown executes compiler-emitted JavaScript supplied from memory.
- JavaScript, declarations, and source-map text match CLI-produced files byte for byte for the same inputs and compiler.
- A change in C updates B's inlined `const enum` and A's executed result while physical `dist` remains stale.
- Type errors are detected and repaired code produces a fresh executed result.
- Created sources enter the emit set and deleted sources leave it.

The fixture adapter handles only the exact string exports used by the fixture.
It is a test harness, with no claim of general conditional-export resolution, Vite HMR, native watcher behavior, source-map composition, atomic output publication, or cross-platform coverage.
The source-map check establishes CLI parity and source presence; browser debugger locations still need the migration plan's integration tests.
Successful disposal calls do not establish long-running memory stability.

## Integration sequence

1. Refresh the inventory and run the probe with the installed compiler.
2. Run it against the exact candidate compiler in an isolated installation.
3. Address existing-consumer compatibility failures before migrating those consumers.
4. Use the referenced fixture as the first executable contract for the optional adapter.
5. Extend coverage for export conditions, watcher events, Vite HMR, concurrent updates, and platform behavior as those pieces are implemented.

Keep compiler compatibility and adapter capability results separate in the [migration plan](../../TYPESCRIPT-7.1-MIGRATION.md).
