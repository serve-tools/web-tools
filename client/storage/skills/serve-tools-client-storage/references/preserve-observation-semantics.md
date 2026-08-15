# Preserve observation semantics

- Route same-document writes through the wrapper when subscribers must observe them.
  Direct writes through `source` produce no same-document `storage` event.
- Treat `added`, `updated`, and `removed` as exact deltas.
- Reread the key for `invalidated`; a native clear event cannot identify individual keys.
- Expect synchronous registration-order delivery from a subscriber snapshot.
  A removed subscriber is skipped before its turn; a newly added subscriber waits for the next occurrence.
- If callbacks throw, remember that the storage mutation has already committed and later active subscribers still run.
  Preserve the single error or ordered `AggregateError` behavior.
- Use the returned unsubscribe function or an `AbortSignal` for cleanup.
