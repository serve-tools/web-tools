---
name: serve-tools-ponyfill-resource-management
description: Use @serve-tools/ponyfill-resource-management when implementing, reviewing, or debugging DisposableStack, AsyncDisposableStack, SuppressedError, and module-scoped disposal symbols without global mutation. Covers adoption, reverse cleanup, failure suppression, and native non-interoperation; do not use for native using declarations or global polyfills.
---

# Use @serve-tools/ponyfill-resource-management

## Adopt the package protocol consistently

1. Import `dispose` or `asyncDispose` from this package and key resources with those exact symbols.
2. Use `use()` for resources that implement the matching protocol.
3. Use `adopt(value, cleanup)` for values that need an explicit cleanup callback.
4. Use `defer(cleanup)` for cleanup that has no adopted value.
5. Dispose the stack once ownership ends; resources run in reverse registration order.

## Preserve the identity boundary

- Treat the exported symbols as module-scoped identities created by this package.
- Do not mix them with native `Symbol.dispose` or `Symbol.asyncDispose`.
- Do not use these resources with native `using` or `await using`; those declarations look for native symbols.
- Use `@serve-tools/polyfill-resource-management` when native identity, syntax integration, or global installation is required.
- Preserve `SuppressedError` chaining when more than one cleanup fails.
- Let `AsyncDisposableStack` accept asynchronous resources and fall back to this package's synchronous disposal protocol.

## Validate changes

Test reverse ordering, adoption, deferred cleanup, moves, disposed-state errors, async fallback, multiple failures, type fixtures, README examples, declarations, and package shape together.
