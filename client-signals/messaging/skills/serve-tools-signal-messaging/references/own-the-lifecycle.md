# Own the lifecycle

- Observation starts eagerly when `observe()` is called.
- Call `dispose()` or use explicit resource management to cancel the underlying subscription.
- Treat disposal as idempotent and terminal.
  It freezes the current state rather than publishing a new terminal state.
- Closing the messaging client can make the observation inactive without changing its last state when the client initiated closure.
