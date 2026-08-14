---
name: serve-tools-client-interaction
description: Use @serve-tools/client-interaction for one-shot clipboard, Web Share, eyedropper, and file-selection operations with transient activation and explicit completed, aborted, or failed outcomes. Do not use for persistent input observation, keyboard normalization, server, or worker code.
---

# Use @serve-tools/client-interaction

## Choose the focused capability

1. Import from the package root when several one-shot interaction APIs are needed.
2. Prefer `./clipboard`, `./share`, `./eyedropper`, or `./file-picker` for one capability.
3. Use these helpers in browser windows; they depend on `navigator`, native UI, or the document.

## Handle every outcome

- Switch on `InteractionResult.status`.
- Treat `completed` as the only confirmed success and read its `value`.
- Treat `aborted` as expected non-completion, not success or failure.
  Web Share can also use this state when no share targets exist, and native file pickers may use it when an entry cannot be exposed.
- Treat `failed` as unsupported capability, missing activation, denied permission, invalid input, or another failure.
  Narrow `error` from `unknown` without assuming every rejection is a `DOMException`.

## Preserve transient activation

- Call `writeToClipboard` directly from the initiating gesture.
  Pass strings, blobs, or promises as representations; do not await promised clipboard data before calling it.
- Pass only resolved native `ShareData` to `share`.
  Prepare asynchronous data before the user gesture because Web Share cannot defer payload representations.
- Call `share`, `openEyeDropper`, and `openFiles` from the user action that authorizes them.

## Validate changes

Update runtime behavior, declarations, README examples, node and browser tests, type fixtures, exports, and package shape together.
Test the synchronous clipboard-write boundary, every interaction outcome, availability checks, native and input file selection, cancellation, and original failure preservation.
