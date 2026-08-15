# Handle every state

- Treat `pending` as the period before the first value or terminal outcome.
- Read a value only from `ready`.
- Treat `complete` as normal remote completion and `error` as remote failure, setup failure, or `AbortSignal` cancellation.
- Pass input-bearing subscription inputs through the required `{ input }` options object.
