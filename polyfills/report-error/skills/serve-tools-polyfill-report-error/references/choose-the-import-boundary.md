# Choose the import boundary

- Import `reportError` from `@serve-tools/polyfill-report-error` when library code needs native-first reporting without global mutation.
- Import `@serve-tools/polyfill-report-error/apply` for its side effect when application code must install a missing global.
- Import `reportError` from `@serve-tools/ponyfill-report-error` only when the console-backed fallback itself is required.
- Call the global directly in browser- or worker-only code that already requires the web API.
