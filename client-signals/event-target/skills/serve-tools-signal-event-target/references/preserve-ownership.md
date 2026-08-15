# Preserve ownership

- Call `dispose()` or `Symbol.dispose` when observation is permanently retired.
  Disposal is terminal and idempotent, removes only that instance's listener, and freezes its last value.
- Check `active` when behavior depends on whether future refreshes remain possible.
- Pass an external `AbortSignal` for cancellation or intentional grouped teardown.
  The observation does not own or abort the caller's controller.
- Expect an already-aborted option to allow the initial read but skip listener registration.
