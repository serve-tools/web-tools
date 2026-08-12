---
name: serve-tools-signal-storage
description: Use @serve-tools/signal-storage when implementing, reviewing, or debugging typed Web Storage subscriptions and signal-backed watches through SignalStorage. Covers subscribe versus watch, refresh, exact deltas, coalescing, direct source writes, cancellation, and disposal; do not use for the non-signal wrapper alone.
---

# Use @serve-tools/signal-storage

## Choose occurrences or state

- Use `subscribe()` when every `added`, `updated`, `removed`, or `invalidated` occurrence matters.
- Use `watch()` when consumers need a read-only Computed containing the latest string value or `null`.
- Expect signal consumers to coalesce intermediate changes.
  Do not use a watch as an event log.

## Preserve source semantics

- Route same-document writes through `SignalStorage` when active subscriptions and watches must observe them.
- Treat direct same-document writes through `source` as invisible until `refresh()` because browsers emit no local `storage` event.
- Apply exact deltas without rereading.
  Reread for invalidations and explicit refreshes.
- Expect native clear events to invalidate every actively observed key.
- Preserve registration-order subscription delivery and the single-error or ordered `AggregateError` behavior after all active callbacks run.

## Own the lifecycle

- Use the returned unsubscribe function or an `AbortSignal` for subscriptions.
- Call `dispose()` or use explicit resource management when a watch should stop observing.
- Treat watch disposal as idempotent and terminal.
  A disposed watch retains its last value and later refreshes do nothing.

## Validate changes

Update the underlying storage contract, Signal behavior, public types, README, browser tests, and type fixtures together.
Keep the application on one compatible `@serve-tools/signal` installation.
