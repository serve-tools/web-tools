---
name: serve-tools-signal-websocket
description: Use @serve-tools/signal-websocket to observe typed WebSocket subscriptions as explicit Signal state.
---

# Use @serve-tools/signal-websocket

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: observe a WebSocket subscription](references/recipe-quick-start.md): compile-checked typed observation and disposal.
- To choose state or occurrences, read [Choose state or occurrences](references/choose-state-or-occurrences.md).

## Boundaries

- Use `observe()` for latest-state consumption and `client.subscribe()` when every event matters.
- Dispose observations when their consumer leaves scope.
- Handle `pending`, `ready`, `complete`, and `error` states explicitly.
