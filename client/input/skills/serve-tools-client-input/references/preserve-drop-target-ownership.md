# Preserve drop-target ownership

- Treat `start`, repeated `over`, and terminal `end` as one session.
  The first observed `dragover` or `drop` can start a session when no `dragenter` was delivered.
- Call `preventDefault()` from `over` only when the current drag data is acceptable.
  Preventing the default on `drop` alone does not cause the browser to deliver it.
- Inspect formats through `dataTransfer.types` or `dataTransfer.items` while hovering, and consume protected payload data from the terminal `drop` event.
- Handle `leave`, `drop`, and `stopped` as distinct terminal reasons.
  Explicit cleanup and signal abortion produce `stopped` with no terminal `DragEvent`.
- Use cleanup or an `AbortSignal` to stop future sessions, terminate active UI state, and remove every listener.
