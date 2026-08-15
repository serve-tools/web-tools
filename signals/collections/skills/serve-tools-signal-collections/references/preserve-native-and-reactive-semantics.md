# Preserve native and reactive semantics

- Preserve the corresponding Array, Map, Set, or Object behavior, including keys, descriptors, iteration order, return values, and error behavior.
- Track only reads performed while a Computed is active.
- Do not invalidate for an unchanged write according to the package's equality rule.
- Keep tracking shallow.
  Nested objects do not become recursively reactive unless they are themselves signal-aware.
- Distinguish presence, value, structure, and iteration dependencies instead of replacing them with one collection-wide version signal.
- Use reflective writes and deletes so inherited setters, accessors, and proxy invariants retain their JavaScript semantics.
