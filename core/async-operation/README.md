# @serve-tools/async-operation

The `@serve-tools/async-operation` package represents one owned asynchronous lifetime as a stream of ordered typed values, one terminal result, cancellation, backpressure, and asynchronous disposal.

```ts
import { AsyncOperation } from "@serve-tools/async-operation";

await using operation = new AsyncOperation<"connecting" | "connected", "closed">(async (write) => {
	await write("connecting");

	await write("connected");

	return "closed";
});

for await (const value of operation) {
	console.log(value); // logs "connecting" then "connected"
}

console.log(await operation.result); // logs "closed"
```

## Install

```shell
npm install @serve-tools/async-operation
```

## Contract

`new AsyncOperation(executor, options)` starts `executor` immediately and exposes five explicit lifecycle surfaces:

- Iterate the operation directly for ordered values.
- Await `result` for the producer's terminal result or failure.
- Await `finished` for non-throwing notification that the executor, its cleanup, and value production have stopped.
- Observe `signal` or call `abort(reason)` for cancellation.
- Dispose the operation to abort active work and wait for the executor to stop.

The producer receives `write(value)` as its first parameter for backpressure-aware value delivery and a context containing `signal` as its second parameter for underlying cancellable work.
Await every write.
If the executor returns while any write remains unsettled, the operation fails with an `InvalidStateError` and errors the value stream.
This prevents an unconsumed, backpressured write from trapping stream closure and asynchronous disposal.
The operation's `result` does not fulfill until every accepted value has entered the bounded stream and the stream has closed.

Producer failure rejects value iteration and `result` with the same reason.
Cancellation additionally aborts the producer signal, whose canonical reason becomes the terminal reason.
Ending iteration early cancels the complete operation.
`finished` never rejects and does not hide the outcome reported through `result`.
It fulfills only after both the executor has stopped and the producer side of the value stream has closed or errored.
Already accepted buffered values remain available for later iteration.
On cancellation, `result` rejects immediately while `finished` waits for executor cleanup.

Async disposal aborts an active executor.
Once the executor has returned and the value stream is closing naturally, disposal preserves that outcome and waits for completion instead of replacing it with an `AbortError`.

The operation attaches an internal rejection handler to its result, so disposing it without separately awaiting its result does not produce an unhandled rejection.
The original `result` remains rejectable and can still be awaited normally.
The operation is intentionally not promise-like, so returning it from an async function preserves the operation object rather than assimilating its result.

## Shared subscriptions

Use `AsyncOperationSubscriber` when several consumers need the same ordered operation values.
Configure its filter/map graph before calling `consume()`; terminal subscriptions may attach whenever they need future values:

```ts
import { AsyncOperation, AsyncOperationSubscriber } from "@serve-tools/async-operation";

await using subscriber = new AsyncOperationSubscriber<number, string>();
using logAll = subscriber.subscribe((value, index) => {
	console.log(index, value);
});
using logEvenSquares = subscriber
	.filter((value) => value % 2 === 0)
	.map((value) => value ** 2)
	.subscribe((value) => {
		console.log("even square", value);
	});

const result = await subscriber.consume(operation);
```

The subscriber owns the operation's single async iterator and multicasts each value to every active branch.
Matching callbacks and projections start concurrently, and all settle before the next operation value is requested, preserving backpressure.
An unsubscribed branch is skipped, and terminal subscriptions added during consumption observe only subsequent values rather than replaying earlier ones.
Each view has its own zero-based output index, so a filtered or mapped view counts only values emitted while that branch is active.

A subscriber consumes at most one operation.
After consumption starts, its filter/map graph cannot be changed, but terminal subscriptions may still be added and disposed until the subscriber itself is disposed.
A projection or callback failure cancels the operation with that failure as its canonical reason.
Disposing the subscriber cancels an active operation and waits for producer cleanup.

## Upstream cancellation and buffering

Pass an upstream `AbortSignal` or readable-side stream queuing strategy when needed:

```ts
const operation = new AsyncOperation(executor, {
	signal: AbortSignal.timeout(10_000),
	strategy: new CountQueuingStrategy({ highWaterMark: 8 }),
});
```

Without a strategy, writes wait for value consumption rather than accumulating a value queue.
A positive high-water mark permits bounded producer run-ahead.
Neither `result` nor `finished` consumes values.
With the default zero-buffer strategy, awaiting either promise before iterating can therefore wait indefinitely while the executor is awaiting `write()`.
Consume the operation first or drain it concurrently when its values are intentionally ignored.
A positive high-water mark only postpones that requirement once its bounded capacity is full.
Async disposal and `finished` wait for producer cleanup, so a producer must observe its signal and settle after cancellation.

## Layering

Values are immutable observations.
Protocol-specific framing, reconnection, keyed reconciliation, causal buffering, persistence, store routing, and reactive materialization belong in adapters and projectors above this package.

The package uses platform `TransformStream`, `AbortSignal`, `DOMException`, and `Symbol.asyncDispose` identities and does not modify globals.
Use `@serve-tools/polyfill-resource-management` separately when a target lacks the native disposal symbol.

## Agent Skill

This package includes `skills/serve-tools-async-operation/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm test --workspace @serve-tools/async-operation
```

The public API recipe is compile-checked by [`test/async-operation.recipes.ts`](./test/async-operation.recipes.ts).

## License

[MIT-0](./LICENSE.md)
