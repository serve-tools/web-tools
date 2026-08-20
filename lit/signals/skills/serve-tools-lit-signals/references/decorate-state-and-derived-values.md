# Decorate state and derived values

Import `collection`, `consume`, `property`, `provide`, `computed`, `effect`, `operation`, and `style` from `@serve-tools/lit-signals/decorators`.
Decorate standard auto-accessors with `@property()` and getters with `@computed`; properties update their backing `Signal.State` atomically by default without requesting Lit's complete lifecycle.

- Use `@consume({ context, subscribe: true })` for a read-only signal-backed context accessor with an initializer fallback; use `@provide({ context })` for a writable accessor whose replacements notify consumers.
- Keep context values plain rather than providing a `Signal.State`; the accessor backing is the implementation detail that integrates with Signal tracking.
- Context decorators are atomic and excluded from HTML attributes by default; use `update: "lifecycle"` for named Lit changes, and replace values or make their internals reactive when mutations must propagate.
- Import context keys and lower-level lifecycle primitives from `@serve-tools/lit-signals`; call `refreshContexts(host)` from `connectedMoveCallback()` to reannounce providers without interrupting active subscriptions, then re-evaluate consumers after a state-preserving move.
- Subscribing consumers retain misses through the owned document root and re-evaluate provider announcements, takeover, and fallback.
- Use `@collection(SignalArray)`, `@collection(SignalMap)`, `@collection(SignalSet)`, or `@collection(SignalObject)` to convert plain initializers and later assignments to the corresponding signal collection.
- Expect collection accessors to be atomic and excluded from HTML attributes; in-place mutations invalidate signal consumers without creating a named Lit property change.
- Use `SignalWatcher` or callback-form `watch()` around collection reads; the collection itself is not a `Signal.Any` value.
- Set `update: "lifecycle"` when assignments must rerun Lit rendering, reflect properties to attributes, or invoke lifecycle callbacks.
- Use `@computed` to allocate one lazy `Signal.Computed` per instance for a getter.
- Decorate an effect method with `@effect({ phase: "before-update" | "after-update" })`; return a synchronous cleanup when it owns resources.
- Decorate a read-only auto-accessor with `@operation(view, options?)` when an element connection should independently subscribe to an ambient operation view without owning its operation.
- Call `updateEffect()` directly for dynamic registration or `manualDispose: true`, and always retain its idempotent disposer in that case.
