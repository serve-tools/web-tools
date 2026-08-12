---
name: serve-tools-signal-shared-db
description: Use @serve-tools/signal-shared-db when implementing, reviewing, or debugging signal-backed reactive queries over a SharedWorker-coordinated IndexedDB client. Covers SignalDB, QueryState, watch, watchAll, refresh, invalidation, cancellation, and disposal; do not use for raw IndexedDB or transaction-scoped work.
---

# Use @serve-tools/signal-shared-db

## Choose Promise or Signal semantics

- Use `get`, `getAll`, `getAllKeys`, `has`, `count`, `add`, `put`, `delete`, or `clear` for one finite operation whose caller awaits completion.
- Use `watch` or `watchAll` when consumers must react to key, option, or post-commit database changes.
- Keep asynchronous query state explicit as `pending`, `ready`, or `error`.
  Do not hide loading and failure inside an undefined value.
- Let a watch key or option be a State or Computed only when changing it should refresh the query.

## Preserve refresh semantics

- Treat `query.refresh()` as resolving after the latest refresh requested so far has published, including overlapping refreshes.
- Expect refresh cancellation and read failure to publish an `error` state rather than reject the refresh call.
- Use `query.refresh()` for one query and `db.invalidate(...stores)` for every active query over selected stores.
- Let mutations routed through the shared client invalidate affected queries automatically.

## Own the lifecycle

- Define the schema inline through `listen<Schema>()` in the shared-worker entrypoint.
  Export `listen.SchemaType<typeof server>` when windows should reference that schema.
- Close or dispose queries that should stop following inputs and writes.
- Treat disposal as terminal.
  Refreshing a disposed query rejects, although an already in-flight request may still publish.
- Close the database client when the window retires it, then separately close the page-owned worker port.
- Do not expose native transactions, cursors, or connection handles across the worker boundary.

## Validate changes

Update query state types, reactive behavior, shared-worker integration, README, browser tests, and type fixtures together.
Preserve compatibility with the shared `@serve-tools/signal` installation.
