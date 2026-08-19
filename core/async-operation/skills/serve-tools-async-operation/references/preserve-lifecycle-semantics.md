# Preserve operation lifecycle semantics

- Iterate the operation for ordered progress values, and await `operation.result` for the one terminal result.
- Await `operation.finished` to wait for executor cleanup and the producer side of the value stream to close or error without propagating the operation's failure.
- Await `write()` so producers respect stream backpressure.
- Expect an executor that returns with an unsettled write to fail the operation with `InvalidStateError` and error the value stream.
- Remember that neither `result` nor `finished` consumes values; with the default zero-buffer strategy, iterate before awaiting them or drain concurrently.
- Expect producer failure to reject value iteration and `operation.result` with the same reason; `operation.finished` fulfills after the executor stops.
- Expect cancellation to abort the producer `signal` and reject value iteration and `operation.result` with `signal.reason`; `operation.finished` waits for cleanup.
- Ending iteration early cancels the complete operation; use a separate projection when observation should not own the operation.
- Async disposal cancels an active executor, preserves natural completion already in progress, and waits for the executor to stop.
- Make producers observe `signal`; disposal cannot finish while a producer ignores cancellation and remains pending.
- Returning an operation from an async function preserves the operation object because it is not promise-like.
