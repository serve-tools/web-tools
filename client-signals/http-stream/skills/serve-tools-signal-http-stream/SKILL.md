---
name: serve-tools-signal-http-stream
description: Use @serve-tools/signal-http-stream to observe HTTP streaming subscriptions as explicit Signal state.
---

# Use @serve-tools/signal-http-stream

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: observe an HTTP stream](references/recipe-quick-start.md): compile-checked subscription observation.

- Use `observe()` for latest-state consumption and the raw subscription when every event matters.
- Handle `pending`, `ready`, `complete`, and `error` explicitly.
- Dispose observations independently from the underlying HTTP client.
