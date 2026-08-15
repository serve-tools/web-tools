# Own the lifecycle

- Define the schema inline through `listen<Schema>()` in the shared-worker entrypoint.
  Export `listen.SchemaType<typeof server>` when windows should reference that schema.
- Close or dispose queries that should stop following inputs and writes.
- Treat disposal as terminal.
  Refreshing a disposed query rejects, although an already in-flight request may still publish.
- Close the database client when the window retires it, then separately close the page-owned worker port.
- Do not expose native transactions, cursors, or connection handles across the worker boundary.
