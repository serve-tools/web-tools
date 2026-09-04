# Preserve composite identity

Import `Composite` from one shared package instance wherever equal named values must produce the same object.
Do not copy its output into an object literal, spread it, wrap it in a proxy, or load independent package copies when identity is significant.

The result is shallowly frozen.
Referenced objects keep their original identity and mutability, so use nested composites when nested value equality is required.
The `preserveNegativeZero` option is read once before a new source is enumerated; an existing composite returns unchanged without reading options.

Keep this package an explicit ponyfill boundary.
It does not install `globalThis.Composite`, select a native implementation, share registries across separately loaded copies, or reproduce the proposal's rejection from weak collections and weak references.
The proposal remains Stage 1 and explicitly expects design changes, so pin the initial `0.0.x` package and do not use composites as a stable serialized or persisted format.
Interning searches the live module-local registry linearly; use this implementation for modest registries, not sustained creation of large numbers of unique composites.
