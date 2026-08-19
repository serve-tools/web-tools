# Share operation values

- Create one `AsyncOperationSubscriber<T, TResult>` when several consumers need the same operation stream.
- Build `filter()` and `map()` branches and attach every terminal `subscribe()` callback before calling `consume(operation)`.
- Await `consume()` for the operation's terminal result.
- Expect all matching callbacks and projections to settle before the next operation value is requested.
- Dispose an individual subscription to deactivate that terminal branch without cancelling the operation.
- Treat each derived view's index as its own emitted-value index, starting at zero.
- Expect a callback, predicate, or mapper failure to cancel the operation with that failure as its canonical reason.
- Dispose the subscriber to cancel its active operation and wait for producer cleanup.
- Use a signal-aware adapter when a UI needs retained current state; raw subscriptions represent every value and intentionally do not retain one.
