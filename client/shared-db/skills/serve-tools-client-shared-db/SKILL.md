---
name: serve-tools-client-shared-db
description: Use @serve-tools/client-shared-db when implementing, reviewing, or debugging SharedWorker-coordinated IndexedDB point operations and post-commit change subscriptions. Covers window and worker entrypoints, readiness, invalidation, revisions, and port lifecycle; do not use for native transactions, scans, or signal-backed Query objects.
---

# Use @serve-tools/client-shared-db

## Split responsibilities correctly

1. Define the schema inline through `listen<Schema>()` from `@serve-tools/client-shared-db/scope/shared-worker` so the worker owns the IndexedDB connection.
   Export `listen.SchemaType<typeof server>` when windows should reference that schema without a separate declaration.
2. Create a `SharedWorker` in each window and call `connect()` from `@serve-tools/client-shared-db/scope/window` with its port.
3. Use Promise-returning point operations for finite reads and writes.
   Use subscriptions only for committed change occurrences.

Do not emulate transactions, cursors, or async iterators across the message boundary.
Their native lifetimes and callback semantics cannot be preserved remotely.

## Build race-free reactive adapters

- Register the subscription and wait for `onReady` before starting the initial query.
- Buffer changes that arrive while the initial query is pending.
- Apply exact `added` and `removed` records when safe; rerun a query for `invalidated` records.
- Treat `put` as key-scoped invalidation and range deletion or `clear` as store-wide invalidation.
- Treat revisions as monotonic only for the lifetime of one worker.
  Run a fresh query after reconnecting.

## Preserve ownership boundaries

- Route every mutation that must enter the change feed through the shared client.
  Direct IndexedDB writes bypass it.
- Give the port exclusively to this protocol.
- Close subscriptions and the client, then separately close the page-owned port.
- Add an application heartbeat if destroyed-tab detection matters.

## Validate changes

Update the shared protocol types, worker and window entrypoints, README, browser integration tests, and type fixtures together.
Test in browsers that support SharedWorker and IndexedDB.
