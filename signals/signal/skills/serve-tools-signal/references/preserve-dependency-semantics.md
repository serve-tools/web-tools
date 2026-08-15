# Preserve dependency semantics

- Read dependencies with `get()` inside a Computed or watched effect so they are tracked.
- Use `Signal.subtle.untrack()` only for a deliberate non-dependency read.
- Treat custom `equals` as the invalidation boundary.
  It must behave consistently for the values the signal can hold.
- Preserve lazy computation, glitch-free ordering, and topological invalidation when modifying internals.
- Use `currentComputed`, source/sink introspection, and `hasSources` or `hasSinks` as low-level facilities, not ordinary application APIs.
- Use the `watched` and `unwatched` lifecycle symbols for resource activation and retirement tied to observation.
