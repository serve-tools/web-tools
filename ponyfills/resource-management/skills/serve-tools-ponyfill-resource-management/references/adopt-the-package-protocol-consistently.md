# Adopt the package protocol consistently

1. Import `dispose` or `asyncDispose` from this package and key resources with those exact symbols.
2. Use `use()` for resources that implement the matching protocol.
3. Use `adopt(value, cleanup)` for values that need an explicit cleanup callback.
4. Use `defer(cleanup)` for cleanup that has no adopted value.
5. Dispose the stack once ownership ends; resources run in reverse registration order.
