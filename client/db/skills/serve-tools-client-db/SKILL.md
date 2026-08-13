---
name: serve-tools-client-db
description: Use @serve-tools/client-db when implementing, reviewing, or debugging its typed Promise-based IndexedDB APIs, including DB.open, point operations, transactions, scans, cancellation, and connection disposal. Do not use for raw IndexedDB, SharedWorker coordination, or signal-backed queries unless this package is also involved.
---

# Use @serve-tools/client-db

## Establish the contract

1. Inspect the installed package version, its `exports`, README, and declarations before writing code.
2. Define the database schema with `DB.Store<Value, Key, Indexes>` and keep schema upgrades synchronous within the native `upgradeneeded` transaction lifetime.
3. Choose the narrowest operation that preserves the required consistency.

## Choose an operation

- Use `get`, `has`, `getAll`, `getAllKeys`, `count`, `add`, `put`, `delete`, or `clear` for one short transaction.
- Use `db.transaction(...)` when several requests must commit or abort atomically.
  Await only requests started from that active transaction; unrelated asynchronous work can let IndexedDB auto-commit it.
- Use `scan`, `scanKeys`, or `scanValues` for bounded-memory paged iteration.
  Treat pages as independently committed reads, not a snapshot.
- Use a transaction with a bounded `getAll` when a single-transaction snapshot matters.
- Use `@serve-tools/client-shared-db` when tabs need one coordinator and post-commit change subscriptions.

## Preserve semantics

- Treat operation promises as settling after transaction commit, not merely after the request succeeds.
- Pass cancellation through the operation's `signal` option; do not place `AbortSignal` in stored values.
- Keep values structured-clone compatible.
- Close owned connections explicitly or with `await using` when the runtime supports `Symbol.dispose`.
- Handle version changes deliberately.
  Without a custom version-change handler, expect the connection to close when another context upgrades the database.
- Do not claim Node.js compatibility without providing an IndexedDB implementation in the application.

## Validate changes

Update behavior, declarations, README examples, and runtime/type tests together.
Run the package's typecheck, Node tests, browser tests, build, and package-shape check.
