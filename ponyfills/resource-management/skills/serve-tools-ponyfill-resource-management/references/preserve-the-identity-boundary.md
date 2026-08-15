# Preserve the identity boundary

- Treat the exported symbols as module-scoped identities created by this package.
- Do not mix them with native `Symbol.dispose` or `Symbol.asyncDispose`.
- Do not use these resources with native `using` or `await using`; those declarations look for native symbols.
- Use `@serve-tools/polyfill-resource-management` when native identity, syntax integration, or global installation is required.
- Preserve `SuppressedError` chaining when more than one cleanup fails.
- Let `AsyncDisposableStack` accept asynchronous resources and fall back to this package's synchronous disposal protocol.
