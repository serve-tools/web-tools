---
name: serve-tools-client-shared-http-stream
description: Use @serve-tools/client-shared-http-stream to coordinate typed HTTP requests and streaming subscriptions through a SharedWorker.
---

# Use @serve-tools/client-shared-http-stream

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: shared HTTP streams](references/recipe-quick-start.md): compile-checked worker ownership, page connection, and cleanup.

## Boundaries

- Call `listen()` in the shared worker and `connect(worker.port)` in each page.
- Keep authorization configuration and the underlying HTTP client worker-owned.
- Close page clients independently; close the worker server only when all shared exchanges should stop.
- Do not infer bidirectional-session, reconnection, replay, persistence, or resumption semantics.
