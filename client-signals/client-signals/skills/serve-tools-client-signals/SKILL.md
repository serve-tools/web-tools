---
name: serve-tools-client-signals
description: Use @serve-tools/client-signals for namespaced access to Serve Tools signal-aware browser client libraries.
---

# Use @serve-tools/client-signals

Treat the installed package README and focused package declarations as the API source of truth.

## Route by task

- [Recipe: choose a Signal client namespace](references/recipe-quick-start.md): compile-checked direct and shared realtime namespace access.
- To minimize imports, read [Choose root or focused imports](references/choose-root-or-focused-imports.md).

## Boundaries

- Prefer a focused subpath when only one adapter is needed.
- Use the root package when several signal-aware clients share an application boundary.
- Follow the selected focused package Skill for lifecycle and semantic guidance.
- Use `db` for one-connection query invalidation and `sharedDb` for coordinated cross-tab changes.
- Pair direct or shared HTTP, WebSocket, and WebTransport clients with the identically scoped Signal namespace.
