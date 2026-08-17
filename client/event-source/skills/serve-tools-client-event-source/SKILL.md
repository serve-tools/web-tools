---
name: serve-tools-client-event-source
description: Use @serve-tools/client-event-source.
---

# Use @serve-tools/client-event-source

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: typed EventSource](references/recipe-quick-start.md): compile-checked named JSON events, IDs, credentials, and disposal.

## Boundaries

- Define event values with JSON-compatible types.
- Read `lastEventId` from each event when an application needs a replay cursor.
- Use `client.source` for native `open`, `error`, and connection state.
- Expect malformed JSON to reach the client platform's global `reportError()`.
- Preserve native EventSource reconnection; do not add an application retry loop.
