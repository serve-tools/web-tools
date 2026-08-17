# Preserve the ponyfill boundary

- Do not install or replace globals.
- Do not substitute the native global automatically.
  The exported functions always use this package's scheduler.
- From the package root, expect callbacks after an animation frame through a `MessageChannel`, with an approximate maximum deadline.
- From a `runtime/*` export, expect unreferenced server-runtime scheduling with a maximum 8 millisecond deadline.
- Expect hidden browser documents or high Node.js event-loop utilization to delay work and elapsed timeouts to produce `didTimeout: true` with no remaining time.

Use `@serve-tools/polyfill-request-idle-callback` instead when native identity or global installation is required.
