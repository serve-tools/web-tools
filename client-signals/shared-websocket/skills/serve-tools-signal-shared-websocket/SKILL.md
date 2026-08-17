---
name: serve-tools-signal-shared-websocket
description: Use @serve-tools/signal-shared-websocket clients and Signals.
---

# Use @serve-tools/signal-shared-websocket

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: serve, connect, and observe a shared WebSocket](references/recipe-quick-start.md): compile-checked complete shared lifecycle.
- To compose transport and reactive ownership, read [Compose transport and reactive ownership](references/compose-transport-and-reactive-ownership.md).

## Boundaries

- Use `/scope/shared-worker` for `listen()` and the root or `/scope/window` for `connect()` and `observe()`.
- Keep physical WebSocket ownership in the shared worker.
- Dispose the observation before closing its page client.
- Use the raw subscription API when consumers must process every occurrence.
