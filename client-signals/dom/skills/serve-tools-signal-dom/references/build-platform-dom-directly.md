# Build platform DOM directly

1. Use `html`, `svg`, or `mathml` to create element templates; use `text`, `attrs`, and `props` for content and bindings.
2. Call the returned template function with a parent to mount real DOM nodes.
3. Pass static values when reactivity is unnecessary.
   Pass `Signal.State` or `Signal.Computed` values only where updates must propagate.
4. Use `group()` for a conditionally presented persistent region of nodes.
