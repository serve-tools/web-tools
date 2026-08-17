---
name: serve-tools-signal-shared-http-stream
description: Use @serve-tools/signal-shared-http-stream clients and Signals.
---

# Use @serve-tools/signal-shared-http-stream

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: serve, connect, and observe a shared HTTP stream](references/recipe-quick-start.md): compile-checked complete shared lifecycle.

- Use `/scope/shared-worker` for `listen()` and the root or `/scope/window` for `connect()` and `observe()`.
- Keep the HTTP client worker-owned and observations page-owned.
- Dispose observations before closing the page client.
- Use raw subscriptions when every event matters.
