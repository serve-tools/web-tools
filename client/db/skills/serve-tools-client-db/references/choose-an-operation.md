# Choose an operation

- Use `get`, `has`, `getAll`, `getAllKeys`, `count`, `add`, `put`, `delete`, or `clear` for one short transaction.
- Use `db.transaction(...)` when several requests must commit or abort atomically.
  Await only requests started from that active transaction; unrelated asynchronous work can let IndexedDB auto-commit it.
- Use `scan`, `scanKeys`, or `scanValues` for bounded-memory paged iteration.
  Treat pages as independently committed reads, not a snapshot.
- Use a transaction with a bounded `getAll` when a single-transaction snapshot matters.
- Use `@serve-tools/client-shared-db` when tabs need one coordinator and post-commit change subscriptions.
