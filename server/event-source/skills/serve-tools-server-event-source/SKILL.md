---
name: serve-tools-server-event-source
description: Use @serve-tools/server-event-source.
---

# Use @serve-tools/server-event-source

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: JSON event stream](references/recipe-quick-start.md): compile-checked handler, reconnect ID, and broadcast.

## Boundaries

- Supply stable `id` values when clients need replay after reconnecting.
- Read `connection.lastEventId` and replay from application-owned storage before broadcasting live events.
- Use comments for keepalives and `retry()` only when the server should suggest a reconnection delay.
- Expect otherwise-unobservable failures to use native `reportError()` or `console.error()` when that web API is unavailable.
- Keep authorization, replay retention, CORS, rate limits, and proxy timeout policy in the application layer.
