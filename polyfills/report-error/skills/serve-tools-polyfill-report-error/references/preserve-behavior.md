# Preserve behavior

The package root and `./apply/reportError` preserve an existing native global and install the ponyfill with ordinary assignment attributes only when the global is nullish.

The `./reportError` export selects the native `globalThis.reportError` when it exists and otherwise exports the ponyfill without modifying the global environment.
Do not add injected reporter options or replace a native function.
