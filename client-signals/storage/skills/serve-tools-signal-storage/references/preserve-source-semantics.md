# Preserve source semantics

- Route same-document writes through `SignalStorage` when active subscriptions and watches must observe them.
- Treat direct same-document writes through `source` as invisible until `refresh()` because browsers emit no local `storage` event.
- Apply exact deltas without rereading.
  Reread for invalidations and explicit refreshes.
- Expect native clear events to invalidate every actively observed key.
- Preserve registration-order subscription delivery and the single-error or ordered `AggregateError` behavior after all active callbacks run.
