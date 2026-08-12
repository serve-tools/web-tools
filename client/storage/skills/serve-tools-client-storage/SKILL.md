---
name: serve-tools-client-storage
description: Use @serve-tools/client-storage when implementing, reviewing, or debugging typed observable localStorage or sessionStorage access with Storage, StorageChange, and subscriptions. Covers same-document changes, cross-document storage events, invalidation, cancellation, and callback failures; do not use for signal-backed watches.
---

# Use @serve-tools/client-storage

## Use the platform-shaped contract

1. Define a string-keyed schema and construct `Storage<Schema>` for local storage or pass `"session"` for session storage.
2. Keep values as strings.
   The schema narrows keys and string values; it does not serialize application objects.
3. Use `get`, `has`, `set`, `delete`, `clear`, and `size` for collection-style access.
4. Use `subscribe` when every change occurrence matters.

## Preserve observation semantics

- Route same-document writes through the wrapper when subscribers must observe them.
  Direct writes through `source` produce no same-document `storage` event.
- Treat `added`, `updated`, and `removed` as exact deltas.
- Reread the key for `invalidated`; a native clear event cannot identify individual keys.
- Expect synchronous registration-order delivery from a subscriber snapshot.
  A removed subscriber is skipped before its turn; a newly added subscriber waits for the next occurrence.
- If callbacks throw, remember that the storage mutation has already committed and later active subscribers still run.
  Preserve the single error or ordered `AggregateError` behavior.
- Use the returned unsubscribe function or an `AbortSignal` for cleanup.

## Respect the environment

Use this package in browser windows, not workers.
Allow native security, quota, privacy, and persistence exceptions to remain observable unless the application deliberately handles them.

## Validate changes

Update behavior, public types, README recipes, browser tests, and type fixtures together.
