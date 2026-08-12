---
name: serve-tools-polyfill-request-idle-callback
description: Use @serve-tools/polyfill-request-idle-callback when adding, reviewing, or debugging global or native-aware requestIdleCallback and cancelIdleCallback support. Covers side-effect imports, selective installers, mutation-free native-or-fallback subpaths, and environment limits; do not use when the always-local ponyfill is intended.
---

# Use @serve-tools/polyfill-request-idle-callback

## Choose the import boundary

- Import the package root for side effects when both globals should be installed if missing.
- Import `./apply/requestIdleCallback` or `./apply/cancelIdleCallback` when only one global should be installed.
- Import `./requestIdleCallback` or `./cancelIdleCallback` for a bound native implementation when available and the fallback otherwise, without changing globals.
- Use `@serve-tools/ponyfill-request-idle-callback` when native identity is irrelevant and global mutation is forbidden.

## Preserve behavior

- Keep side-effect imports intact.
  The package intentionally declares `sideEffects: true`.
- Leave native implementations unchanged; every installer is self-guarding.
- Treat the fallback deadline as an approximation.
  It cannot observe the browser's internal rendering or input queues.
- Use only in browser environments that provide `document`, `performance`, `MessageChannel`, and `requestAnimationFrame` for the fallback.

## Validate changes

Test root, selective-global, and mutation-free imports.
Update public subpaths, declarations, README, type fixtures, runtime tests, and package shape together.
