# Build race-free reactive adapters

- Register the subscription and wait for `onReady` before starting the initial query.
- Buffer changes that arrive while the initial query is pending.
- Apply exact `added` and `removed` records when safe; rerun a query for `invalidated` records.
- Treat `put` as key-scoped invalidation and range deletion or `clear` as store-wide invalidation.
- Treat revisions as monotonic only for the lifetime of one worker.
  Run a fresh query after reconnecting.
