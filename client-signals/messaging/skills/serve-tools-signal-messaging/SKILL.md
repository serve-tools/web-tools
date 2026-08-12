---
name: serve-tools-signal-messaging
description: Use @serve-tools/signal-messaging to observe typed messaging subscriptions as explicit Signal state. Covers lifecycle and coalescing; not Promise requests or event logs.
---

# Use @serve-tools/signal-messaging

## Choose occurrences or state

- Use the messaging client's `subscribe()` when every occurrence must be processed.
- Use `observe()` when consumers need the latest subscription state through a read-only Signal.
- Keep finite messaging requests as Promises.
- Expect Signal consumers to coalesce intermediate ready values.
  Do not treat an observation as an event log.

## Handle every state

- Treat `pending` as the period before the first value or terminal outcome.
- Read a value only from `ready`.
- Treat `complete` as normal remote completion and `error` as remote failure, setup failure, or `AbortSignal` cancellation.
- Pass input-bearing subscription inputs through the required `{ input }` options object.

## Own the lifecycle

- Observation starts eagerly when `observe()` is called.
- Call `dispose()` or use explicit resource management to cancel the underlying subscription.
- Treat disposal as idempotent and terminal.
  It freezes the current state rather than publishing a new terminal state.
- Closing the messaging client can make the observation inactive without changing its last state when the client initiated closure.

## Validate changes

Update state types, runtime behavior, README examples, Node and browser tests, and type fixtures together.
Keep the application on compatible `@serve-tools/client-messaging` and `@serve-tools/signal` installations.
