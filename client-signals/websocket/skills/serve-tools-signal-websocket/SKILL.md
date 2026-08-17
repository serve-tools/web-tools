---
name: serve-tools-signal-websocket
description: Use @serve-tools/signal-websocket clients and Signals.
---

# Use @serve-tools/signal-websocket

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: connect and observe a WebSocket subscription](references/recipe-quick-start.md): compile-checked client creation and observation.
- To choose state or occurrences, read [Choose state or occurrences](references/choose-state-or-occurrences.md).

## Boundaries

- Import `connect()` and `observe()` from this package; the client API is re-exported unchanged.
- Use `observe()` for latest-state consumption and `client.subscribe()` when every event matters.
- Dispose observations when their consumer leaves scope.
- Handle `pending`, `ready`, `complete`, and `error` states explicitly.
