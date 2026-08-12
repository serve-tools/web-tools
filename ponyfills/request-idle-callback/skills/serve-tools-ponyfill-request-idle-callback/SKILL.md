---
name: serve-tools-ponyfill-request-idle-callback
description: Use @serve-tools/ponyfill-request-idle-callback when implementing, reviewing, or debugging explicit-import requestIdleCallback and cancelIdleCallback behavior without global mutation. Covers scheduling, timeout, cancellation, and browser requirements; do not use when native-aware global installation is required.
---

# Use @serve-tools/ponyfill-request-idle-callback

## Use the local scheduler deliberately

1. Import `requestIdleCallback` and `cancelIdleCallback` from the package root.
2. Keep each returned numeric handle paired with this module's `cancelIdleCallback`.
3. Break long work into small units and consult `deadline.timeRemaining()` or `didTimeout`.

## Preserve the ponyfill boundary

- Do not install or replace globals.
- Do not substitute the native global automatically.
  The exported functions always use this package's scheduler.
- Expect callbacks after an animation frame through a `MessageChannel`, with an approximate maximum deadline.
- Expect hidden documents to delay work and elapsed timeouts to produce `didTimeout: true` with no remaining time.
- Use only in browsers with `document`, `performance`, `MessageChannel`, and `requestAnimationFrame`.

Use `@serve-tools/polyfill-request-idle-callback` instead when native identity or global installation is required.

## Validate changes

Test scheduling, timeout, cancellation, hidden-document behavior, type fixtures, README recipes, declarations, and package shape together.
