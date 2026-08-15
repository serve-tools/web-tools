# Split responsibilities correctly

1. Define the schema inline through `listen<Schema>()` from `@serve-tools/client-shared-db/scope/shared-worker` so the worker owns the IndexedDB connection.
   Export `listen.SchemaType<typeof server>` when windows should reference that schema without a separate declaration.
2. Create a `SharedWorker` in each window and call `connect()` from `@serve-tools/client-shared-db/scope/window` with its port.
3. Use Promise-returning point operations for finite reads and writes.
   Use subscriptions only for committed change occurrences.

Do not emulate transactions, cursors, or async iterators across the message boundary.
Their native lifetimes and callback semantics cannot be preserved remotely.
