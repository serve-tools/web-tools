---
name: serve-tools-signal-db
description: Use @serve-tools/signal-db for signal-backed reactive queries over one typed IndexedDB connection.
---

# Use @serve-tools/signal-db

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: watch a database query](references/recipe-quick-start.md): compile-checked schema and query state.

- Use Promise operations for finite work and `watch()` or `watchAll()` for latest asynchronous state.
- Handle `pending`, `ready`, and `error` explicitly.
- Expect writes through the same wrapper to invalidate after commit.
- Call `invalidate()` for external writes; use the shared database package for coordinated cross-tab changes.
- Dispose queries and close the owned database connection.
