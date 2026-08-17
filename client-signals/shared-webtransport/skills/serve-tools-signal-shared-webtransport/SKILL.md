---
name: serve-tools-signal-shared-webtransport
description: Use @serve-tools/signal-shared-webtransport clients and Signals.
---

# Use @serve-tools/signal-shared-webtransport

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: serve, connect, and observe shared WebTransport](references/recipe-quick-start.md): compile-checked complete shared lifecycle.

- Use `/scope/shared-worker` for `listen()` and the root or `/scope/window` for `connect()` and `observe()`.
- Keep the physical WebTransport session worker-owned and observations page-owned.
- Observe reliable subscriptions; consume datagrams as occurrences.
- Dispose observations before closing the page client.
