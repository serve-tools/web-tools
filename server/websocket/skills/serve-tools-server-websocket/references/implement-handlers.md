# Implement handlers

Define one handler for every operation in the shared protocol type.
Return a request response or throw to reject it.
For subscriptions, call `emit()`, then `complete()` or `error()` when the producer settles.
Observe `signal` for prompt cancellation and return an idempotent cleanup function for owned resources.
Treat connection context as handshake-established identity and application state, not as validated request input.
