---
name: serve-tools-signal-event-source
description: Use @serve-tools/signal-event-source.
---

# Use @serve-tools/signal-event-source

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: connect and observe EventSource state](references/recipe-quick-start.md): compile-checked client creation and latest-event observation.

- Import `connect()` and `observe()` from this package; the client API is re-exported unchanged.
- Preserve the full `event`, including `lastEventId`, in reactive state.
- Use the raw subscription when every event occurrence matters because Signal consumers may coalesce updates.
- Dispose observations independently from the EventSource client.
