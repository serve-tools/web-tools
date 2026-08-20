# Share operation values

- Create one `AsyncOperationSubscriber<T, TResult>` when several consumers need the same operation stream.
- Build every `filter()` and `map()` branch before calling `consume(operation)`; the projection graph becomes immutable when consumption starts.
- Add and dispose terminal `subscribe()` callbacks before or during consumption; a late subscription observes only future values and does not replay earlier ones.
- Await `consume()` for the operation's terminal result.
- Expect all matching callbacks and projections to settle before the next operation value is requested.
- Dispose an individual subscription to deactivate that terminal branch without cancelling the operation.
- Treat each derived view's index as its shared emitted-value index, starting at zero and advancing while that branch is active rather than restarting for each terminal subscription.
- Expect a callback, predicate, or mapper failure to cancel the operation with that failure as its canonical reason.
- Dispose the subscriber to cancel its active operation and wait for producer cleanup.
- Expect one subscriber to consume at most one operation.
- Use a signal-aware adapter when a UI needs retained current state; raw subscriptions represent every value and intentionally do not retain one.
