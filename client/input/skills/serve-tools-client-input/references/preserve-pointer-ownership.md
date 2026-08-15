# Preserve pointer ownership

- Return `false` from `start` to reject secondary buttons, non-primary pointers, or other application-specific input.
  Rejection does not capture the pointer, prevent defaults, or stop propagation.
- Call `preventDefault()` or a propagation method explicitly only when the application owns that behavior.
- Treat `bounds` as the initial layout snapshot and `ratio` as unclamped coordinates relative to it.
- Handle `up`, `cancel`, `lostcapture`, and `stopped` as distinct terminal reasons.
  A stopped interaction has no terminal `PointerEvent`.
- Use the idempotent cleanup function or an `AbortSignal` to stop future starts, terminate an active interaction, remove listeners, and release capture.
- Set CSS `touch-action` before direct manipulation begins when native panning or zooming must be constrained.
