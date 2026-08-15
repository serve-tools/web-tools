# Own the lifecycle

- Use the returned unsubscribe function or an `AbortSignal` for subscriptions.
- Call `dispose()` or use explicit resource management when a watch should stop observing.
- Treat watch disposal as idempotent and terminal.
  A disposed watch retains its last value and later refreshes do nothing.
