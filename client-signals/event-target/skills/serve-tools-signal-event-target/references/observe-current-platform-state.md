# Observe current platform state

1. Use `EventTargetSignal(target, type, read, options?)` when an event means durable current state may have changed.
2. Make `read` synchronously return the latest state from the target or related platform object.
3. Read the returned signal with `get()` and derive further state with `Signal.Computed`.
4. Use `MatchMediaSignal(query, options?)` for `matchMedia()` state instead of constructing the generic adapter yourself.
