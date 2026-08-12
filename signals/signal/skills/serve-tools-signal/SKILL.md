---
name: serve-tools-signal
description: Use @serve-tools/signal when implementing, reviewing, migrating, or debugging TC39-compatible Signal.State, Signal.Computed, Signal.subtle.Watcher, equality, lifecycle, untracking, or graph introspection. Use for this package's reactive primitives, not generic framework signals, signal-aware collections, DOM bindings, or Effect-TS.
---

# Use @serve-tools/signal

## Choose the primitive

- Use `Signal.State<T>` for writable state and call `set()` only when ownership permits mutation.
- Use `Signal.Computed<T>` for lazy derived state.
  Keep computation functions free of writes and unrelated side effects.
- Use `Signal.subtle.Watcher` only to schedule observation infrastructure.
  Prefer `@serve-tools/signal-effect` for ordinary microtask-batched effects.
- Use `Signal.isState()`, `Signal.isComputed()`, and `Signal.isWatcher()` when runtime narrowing is required.

## Preserve dependency semantics

- Read dependencies with `get()` inside a Computed or watched effect so they are tracked.
- Use `Signal.subtle.untrack()` only for a deliberate non-dependency read.
- Treat custom `equals` as the invalidation boundary.
  It must behave consistently for the values the signal can hold.
- Preserve lazy computation, glitch-free ordering, and topological invalidation when modifying internals.
- Use `currentComputed`, source/sink introspection, and `hasSources` or `hasSinks` as low-level facilities, not ordinary application APIs.
- Use the `watched` and `unwatched` lifecycle symbols for resource activation and retirement tied to observation.

## Keep one compatible runtime

Make packages that import Signal directly declare `@serve-tools/signal` so signal-aware libraries share one compatible installation.
When intentionally aliasing another compatible implementation, keep imports pointed at `@serve-tools/signal`.

## Validate changes

Update runtime behavior, declarations, README, Node tests, browser tests, type fixtures, emitted output, and package shape together.
Pay particular attention to cycles, equality, watcher rearming, error recovery, watched/unwatched transitions, and graph cleanup.
