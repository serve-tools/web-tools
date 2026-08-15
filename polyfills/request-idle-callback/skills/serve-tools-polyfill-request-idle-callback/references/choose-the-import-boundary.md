# Choose the import boundary

- Import the package root for side effects when both globals should be installed if missing.
- Import `./apply/requestIdleCallback` or `./apply/cancelIdleCallback` when only one global should be installed.
- Import `./requestIdleCallback` or `./cancelIdleCallback` for a bound native implementation when available and the fallback otherwise, without changing globals.
- Use `@serve-tools/ponyfill-request-idle-callback` when native identity is irrelevant and global mutation is forbidden.
