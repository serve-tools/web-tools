---
name: serve-tools-signals
description: Use @serve-tools/signals for compatible Signals packages.
---

# Use @serve-tools/signals

Treat the installed package README and focused package declarations as the API source of truth.

## Route by task

- [Recipe: combine Signals, collections, and effects](references/recipe-quick-start.md): compile-checked root and focused imports.
- To minimize imports and preserve ownership, read [Choose the facade or a focused package](references/choose-facade-or-focused-package.md).

## Boundaries

- Use the root facade when one module intentionally combines core Signals, collections, and effects.
- Prefer `@serve-tools/signal`, `@serve-tools/signal-collections`, or `@serve-tools/signal-effect` when only one capability is needed.
- Use `@serve-tools/signals/signal`, `/collections`, or `/effect` when a facade dependency needs a focused import.
- Treat every export as the original owning package's runtime value; do not create or mix another Signal implementation.
- Follow the focused package Skill for primitive choice, collection invalidation, effect scheduling, and disposal semantics.
