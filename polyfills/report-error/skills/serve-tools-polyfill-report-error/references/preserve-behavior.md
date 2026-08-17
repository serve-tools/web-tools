# Preserve behavior

The default export selects and binds the native `globalThis.reportError` when it exists and otherwise exports the ponyfill.
It never modifies the global environment.

The `./apply` entrypoint preserves an existing native global and installs the ponyfill with writable, configurable, non-enumerable platform-style attributes only when the global is missing.
Do not add injected reporter options or replace a native function.
