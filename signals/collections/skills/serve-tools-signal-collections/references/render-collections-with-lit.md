# Render collections with Lit

- Use `SignalWatcher(LitElement)` when collection reads in `render()` should request a component update.
- Use `watch(() => collectionRead)` when only one Lit template part should update.
- Use `@collection(SignalArray)` and the equivalent constructors from `@serve-tools/lit-signals/decorators` when plain initializers and replacement assignments should be normalized automatically.
- Expect the Lit collection decorator to preserve existing signal collection identity, disable attribute association, and keep in-place mutation in the atomic signal domain.
