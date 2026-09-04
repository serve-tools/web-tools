# Preserve reactive lifecycles

- Do not assume removing nodes disposes their bindings.
  Call `dispose(root)` when a subtree is permanently retired.
- Treat disposal as terminal and idempotent.
  It covers current descendants and shadow content without removing DOM.
- Let ordinary true/false `group()` toggles preserve nodes and subscriptions.
  Dispose the region only when it will never return.
- Do not dispose a custom element merely because `disconnectedCallback()` fired if the same instance may reconnect.
- For a persistent tree that must release subscriptions while disconnected, create one `createBindingScope()` per owner.
  Build synchronously inside `scope.capture()`, call `scope.resume()` when connected, and call `scope.suspend()` immediately on genuine disconnection.
- Treat a `false` result from `scope.resume()` as a deferred or invalidated activation.
  The scope never schedules its own retry.
- Keep capture synchronous.
  `PromiseLike` results are rejected by the type contract and runtime guard.
  Rollback retires synchronous captured work but cannot cancel user code already scheduled after an `await`.
- Keep reactive setters focused on their DOM assignment.
  A scope rejects capture from one of its running setters or during resume, while ordinary nested synchronous construction remains supported.
- Expect capture to apply initial values without subscribing and resume to reconcile those values again.
  This updates retained targets, not arbitrary structural edits inside a binding-owned region.
- A scope records bindings at construction time, including bindings in closed roots and hidden groups.
  It does not discover bindings by walking descendants, and group visibility does not pause a scoped binding.
- Keep shared constructed stylesheets immutable and document-local.
  Keep scoped reactive sheets instance-owned unless the application provides a separate shared-resource lifetime.
