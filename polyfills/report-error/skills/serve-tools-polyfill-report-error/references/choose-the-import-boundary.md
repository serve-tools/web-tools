# Choose the import boundary

- Import `@serve-tools/polyfill-report-error` for its side effect when application code must install a missing global.
- Import `@serve-tools/polyfill-report-error/apply/reportError` to install the missing global selectively.
- Import `reportError` from `@serve-tools/polyfill-report-error/reportError` when library code needs native-first reporting without global mutation.
- Import `reportError` from `@serve-tools/ponyfill-report-error` only when the console-backed fallback itself is required.
- Call the global directly in browser- or worker-only code that already requires the web API.
