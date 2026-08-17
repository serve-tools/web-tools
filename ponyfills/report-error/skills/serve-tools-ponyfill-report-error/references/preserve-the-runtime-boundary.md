# Preserve the ponyfill boundary

This ponyfill always reports through `console.error()` and never reads or modifies `globalThis.reportError`.
Use it when the fallback implementation itself is required.
Use `@serve-tools/polyfill-report-error` when imported code should select the native platform function first, and use `@serve-tools/polyfill-report-error/apply` only when a missing global must be installed.
