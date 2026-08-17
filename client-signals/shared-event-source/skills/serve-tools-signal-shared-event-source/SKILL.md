---
name: serve-tools-signal-shared-event-source
description: Use @serve-tools/signal-shared-event-source.
---

# Use @serve-tools/signal-shared-event-source

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: serve, connect, and observe a shared EventSource](references/recipe-quick-start.md): compile-checked complete shared lifecycle.

- Use `/scope/shared-worker` for `listen()` and the root or `/scope/window` for `connect()` and `observe()`.
- Keep the physical EventSource and reconnection lifecycle in the shared worker.
- Preserve the full event record and `lastEventId` in page-owned Signal state.
- Use the raw shared subscription when every event occurrence matters.
