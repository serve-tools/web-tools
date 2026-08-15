# Preserve the ponyfill boundary

- Do not install or replace globals.
- Do not substitute the native global automatically.
  The exported functions always use this package's scheduler.
- Expect callbacks after an animation frame through a `MessageChannel`, with an approximate maximum deadline.
- Expect hidden documents to delay work and elapsed timeouts to produce `didTimeout: true` with no remaining time.
- Use only in browsers with `document`, `performance`, `MessageChannel`, and `requestAnimationFrame`.

Use `@serve-tools/polyfill-request-idle-callback` instead when native identity or global installation is required.
