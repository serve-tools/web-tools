# Choose the primitive

- Use `Signal.State<T>` for writable state and call `set()` only when ownership permits mutation.
- Use `Signal.Computed<T>` for lazy derived state.
  Keep computation functions free of writes and unrelated side effects.
- Use `Signal.subtle.Watcher` only to schedule observation infrastructure.
  Prefer `@serve-tools/signal-effect` for ordinary microtask-batched effects.
- Use `Signal.isState()`, `Signal.isComputed()`, and `Signal.isWatcher()` when runtime narrowing is required.
