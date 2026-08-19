# Preserve the ponyfill boundary

The exported `metadata` is a stable module-scoped symbol and is intentionally distinct from `Symbol.metadata`.
Use it only when metadata producers and consumers can import the same symbol.
Use `@serve-tools/polyfill-decorator-metadata` when TypeScript, a decorator transform, or third-party code reads the global `Symbol.metadata` property.

This package provides the symbol key only; it does not transform decorators or create and attach class metadata objects.
