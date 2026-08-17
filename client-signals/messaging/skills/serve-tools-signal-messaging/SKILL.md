---
name: serve-tools-signal-messaging
description: Use @serve-tools/signal-messaging clients and Signals.
---

# Use @serve-tools/signal-messaging

Treat the installed package README and public declarations as the API source of truth.
Read only the references needed for the current task.

## Route by task

- [Recipe: quick start](references/recipe-quick-start.md): compile-checked package setup.
- To declare callable subscriptions, read [Declare callable subscriptions](references/declare-callable-subscriptions.md).
- To choose occurrences or state, read [Choose occurrences or state](references/choose-occurrences-or-state.md).
- To handle every state, read [Handle every state](references/handle-every-state.md).
- To own the lifecycle, read [Own the lifecycle](references/own-the-lifecycle.md).

- Import generic client operations and `observe()` from this package.
- Use this package's matching `/scope/window` and `/scope/worker` entrypoints for worker helpers.
