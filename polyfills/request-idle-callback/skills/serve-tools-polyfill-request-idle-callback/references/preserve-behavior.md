# Preserve behavior

- Keep side-effect imports intact.
  The package intentionally declares `sideEffects: true`.
- Leave native implementations unchanged; every installer is self-guarding.
- Treat the fallback deadline as an approximation.
  It cannot observe the browser's internal rendering or input queues.
- Use only in browser environments that provide `document`, `performance`, `MessageChannel`, and `requestAnimationFrame` for the fallback.
