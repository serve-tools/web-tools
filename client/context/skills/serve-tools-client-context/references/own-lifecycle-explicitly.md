# Own lifecycle explicitly

- Call `connect()` and `disconnect()` from the corresponding custom-element callbacks.
- Call `refresh()` from `connectedMoveCallback()` after state-preserving moves and after relevant topology changes that do not reconnect the consumer.
- Replace the current subscription before releasing the previous provider.
- Keep cancellation idempotent and remove pending misses when owned consumers disconnect.
- Expect one-time misses to end synchronously; only subscribing misses are retained by `ContextRoot`.
- Expect callback and cleanup failures to reach the platform `reportError()` global.
