---
name: serve-tools-signal-shared-http-stream
description: Use @serve-tools/signal-shared-http-stream to observe SharedWorker HTTP stream subscriptions as Signal state.
---

# Use @serve-tools/signal-shared-http-stream

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: observe a shared HTTP stream](references/recipe-quick-start.md): compile-checked page-owned observation.

- Keep the HTTP client worker-owned and observations page-owned.
- Dispose observations before closing the page client.
- Use raw subscriptions when every event matters.
