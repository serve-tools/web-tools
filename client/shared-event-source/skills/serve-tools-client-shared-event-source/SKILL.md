---
name: serve-tools-client-shared-event-source
description: Use @serve-tools/client-shared-event-source.
---

# Use @serve-tools/client-shared-event-source

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: shared EventSource](references/recipe-quick-start.md): compile-checked worker ownership and page subscription.

## Boundaries

- Call `listen()` in the shared worker and `connect(worker.port)` in each page.
- Keep the native EventSource, reconnection lifecycle, credentials, and parse-error reporting worker-owned.
- Preserve `lastEventId` when forwarding events or storing reactive state.
