---
name: serve-tools-client-input
description: Use @serve-tools/client-input for abortable pointer and drag-and-drop session observation with explicit terminal reasons, caller-owned default prevention, geometry, capture, and cleanup. Do not use for one-shot browser actions, keyboard normalization, server, or worker code.
---

# Use @serve-tools/client-input

## Choose the observer

1. Use `observePointer` for consecutive single-pointer sessions on an element.
2. Use `observeDropTarget` for normalized drag sessions over an element, document, shadow root, or window.
3. Import from the package root when both observers are needed, or from `./pointer` or `./drop` for one capability.

## Preserve pointer ownership

- Return `false` from `start` to reject secondary buttons, non-primary pointers, or other application-specific input.
  Rejection does not capture the pointer, prevent defaults, or stop propagation.
- Call `preventDefault()` or a propagation method explicitly only when the application owns that behavior.
- Treat `bounds` as the initial layout snapshot and `ratio` as unclamped coordinates relative to it.
- Handle `up`, `cancel`, `lostcapture`, and `stopped` as distinct terminal reasons.
  A stopped interaction has no terminal `PointerEvent`.
- Use the idempotent cleanup function or an `AbortSignal` to stop future starts, terminate an active interaction, remove listeners, and release capture.
- Set CSS `touch-action` before direct manipulation begins when native panning or zooming must be constrained.

## Preserve drop-target ownership

- Treat `start`, repeated `over`, and terminal `end` as one session.
  The first observed `dragover` or `drop` can start a session when no `dragenter` was delivered.
- Call `preventDefault()` from `over` only when the current drag data is acceptable.
  Preventing the default on `drop` alone does not cause the browser to deliver it.
- Inspect formats through `dataTransfer.types` or `dataTransfer.items` while hovering, and consume protected payload data from the terminal `drop` event.
- Handle `leave`, `drop`, and `stopped` as distinct terminal reasons.
  Explicit cleanup and signal abortion produce `stopped` with no terminal `DragEvent`.
- Use cleanup or an `AbortSignal` to stop future sessions, terminate active UI state, and remove every listener.

## Validate changes

Update runtime behavior, declarations, README examples, node and browser tests, type fixtures, benchmarks, exports, and package shape together.
For pointer changes, test rejection, capture, pointer-ID filtering, geometry, every terminal reason, handler failures, cleanup, and AbortSignal behavior.
For drop changes, test nested depth, dragover-first recovery, explicit default prevention, drop termination, bubbling events, handler failures, cleanup, and AbortSignal behavior.
