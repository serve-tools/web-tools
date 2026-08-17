---
name: serve-tools-signal-http-stream
description: Use @serve-tools/signal-http-stream clients and Signals.
---

# Use @serve-tools/signal-http-stream

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: connect and observe an HTTP stream](references/recipe-quick-start.md): compile-checked client creation and subscription observation.

- Import `connect()` and `observe()` from this package; the client API is re-exported unchanged.
- Use `observe()` for latest-state consumption and the raw subscription when every event matters.
- Handle `pending`, `ready`, `complete`, and `error` explicitly.
- Dispose observations independently from the underlying HTTP client.
