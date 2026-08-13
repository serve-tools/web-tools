---
name: serve-tools-signal-collections
description: Use @serve-tools/signal-collections when implementing, reviewing, or debugging SignalArray, SignalMap, SignalSet, or SignalObject with fine-grained @serve-tools/signal dependency tracking. Covers native collection behavior, shallow tracking, unchanged writes, and dependency granularity; do not use for generic immutable collections or deep reactive proxies.
---

# Use @serve-tools/signal-collections

## Choose the native-shaped collection

- Use `SignalArray` when index, length, and whole-collection reads should invalidate independently.
- Use `SignalMap` when key presence, key values, structure, and content iteration need separate dependencies.
- Use `SignalSet` when membership and collection-wide reads need reactive invalidation.
- Use `SignalObject` for a shallow signal-backed plain record; use `SignalObject.fromEntries()` for entry-based construction.

## Preserve native and reactive semantics

- Preserve the corresponding Array, Map, Set, or Object behavior, including keys, descriptors, iteration order, return values, and error behavior.
- Track only reads performed while a Computed is active.
- Do not invalidate for an unchanged write according to the package's equality rule.
- Keep tracking shallow.
  Nested objects do not become recursively reactive unless they are themselves signal-aware.
- Distinguish presence, value, structure, and iteration dependencies instead of replacing them with one collection-wide version signal.
- Use reflective writes and deletes so inherited setters, accessors, and proxy invariants retain their JavaScript semantics.

## Keep one compatible runtime

Continue importing Signal from `@serve-tools/signal`, including when the application aliases a compatible implementation such as `signal-polyfill` under that dependency name.

To use `signal-polyfill`, install it under the dependency name:

```shell
npm install @serve-tools/signal@npm:signal-polyfill @serve-tools/signal-collections
```

## Render collections with Lit

- Use `SignalWatcher(LitElement)` when collection reads in `render()` should request a component update.
- Use `watch(() => collectionRead)` when only one Lit template part should update.
- Use `@collection(SignalArray)` and the equivalent constructors from `@serve-tools/lit-signals/decorators` when plain initializers and replacement assignments should be normalized automatically.
- Expect the Lit collection decorator to preserve existing signal collection identity, disable attribute association, and keep in-place mutation in the atomic signal domain.

## Validate changes

Update runtime behavior, declarations, README, Node and browser tests, and package shape together.
Cover unchanged writes, sparse arrays, symbol keys, inherited properties, iteration, clear/delete, size or length, and reads outside Computed evaluation.
