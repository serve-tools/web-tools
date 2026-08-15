# Preserve reactive lifecycles

- Do not assume removing nodes disposes their bindings.
  Call `dispose(root)` when a subtree is permanently retired.
- Treat disposal as terminal and idempotent.
  It covers current descendants and shadow content without removing DOM.
- Let ordinary true/false `group()` toggles preserve nodes and subscriptions.
  Dispose the region only when it will never return.
- Do not dispose a custom element merely because `disconnectedCallback()` fired if the same instance may reconnect.
