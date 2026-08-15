---
name: serve-tools-client-shared-websocket
description: Use @serve-tools/client-shared-websocket to share one typed WebSocket across browser windows through a SharedWorker.
---

# Use @serve-tools/client-shared-websocket

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: shared typed WebSocket](references/recipe-quick-start.md): compile-checked worker ownership, window connection, requests, subscriptions, and cleanup.
- To preserve ownership and failure semantics, read [Preserve ownership and failure semantics](references/preserve-ownership-and-failure-semantics.md).

## Boundaries

- Call `listen()` only in the shared worker and `connect()` in each window.
- Close page clients independently; close the worker server to close the physical socket.
- Add reconnection, replay, authentication, validation, and backpressure at the application protocol layer.
