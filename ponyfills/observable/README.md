# @serve-tools/ponyfill-observable

A small, dependency-free subset of the proposed Web `Observable` API, with **a fresh execution for every consumption**.
Import it explicitly; it neither changes globals nor selects a native `Observable` implementation.

## Status

This initial `0.0.x` line is an experimental API with deliberate semantic differences from the current WICG draft.
Treat it as its own cold Observable contract, not as a conforming polyfill or a transparent native fallback.
Pin the package version and review the cold-execution and source boundaries before adoption.

```ts
import { Observable } from "@serve-tools/ponyfill-observable";

const source = new Observable<number>((subscriber) => {
	let value = 0;
	const timer = setInterval(() => {
		subscriber.next(++value);
		if (value === 3) subscriber.complete();
	}, 1000);
	// Cleanup is explicit; a returned function is not treated as teardown.
	subscriber.addTeardown(() => clearInterval(timer));
});

source.subscribe((value) => console.log("A", value));
setTimeout(() => source.subscribe((value) => console.log("B", value)), 1500);
// A 1, A 2, B 1, A 3, B 2, B 3
```

## Cold execution contract

Every `subscribe()` call starts an independent execution, including calls made while another execution is active or after it completes.
Every Promise-returning consumption method does the same.
`map()`, `filter()`, `take()`, and `drop()` create reusable recipes; they start no work until consumed and keep all indices, counters, and cancellation state local to each execution.
No implicit sharing, reference counting, replay, value buffering, or shared execution restart is provided.
`toArray()` explicitly collects values for that one consumption.
There is no `share()` helper in this package.

This is an intentional semantic departure from the current [WICG proposal](https://wicg.github.io/observable/), following the cold-by-default direction discussed in [WICG Observable #217](https://github.com/WICG/observable/issues/217).
It is not a conforming implementation of the proposal's shared, lazy, restarting execution model, and must not be silently replaced with a native implementation.
It addresses the timing-dependent lifecycle concern in [Mozilla's standards position](https://github.com/mozilla/standards-positions/issues/945), not its broader complexity and venue objections.

## API

| Surface             | Supported API                                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Creation            | `new Observable<T>(callback)`, `Observable.from(value)`                                                                                                                                                                     |
| Producer            | `Subscriber<T>` instances with `next(value)`, `error(reason)`, `complete()`, `addTeardown(callback)`, readonly `active` and `signal`                                                                                        |
| Consumption         | `subscribe(observer?, { signal }?)` returns `undefined`; observer is a function or `{ next, error, complete }`                                                                                                              |
| Operators           | `map(mapper)`, `filter(predicate)`, `take(amount)`, `drop(amount)`                                                                                                                                                          |
| Promise consumption | `toArray(options?)`, `forEach(callback, options?)`, `first(options?)`, `last(options?)`, `find(predicate, options?)`, `some(predicate, options?)`, `every(predicate, options?)`, `reduce(reducer, initialValue?, options?)` |
| Events              | `when(target, type, { capture, passive }?)` is the explicit-import equivalent of `target.when()`                                                                                                                            |

`Subscriber` is exported for type annotations and `instanceof`, but cannot be constructed directly.
Producer callbacks receive it from `Observable`.
Mapper, predicate, visitor, and reducer indices start at zero for each consumption and count their input values.
An unseeded reducer uses the first value as its accumulator and first invokes the reducer at index one.
Passing `undefined` explicitly as the seed is different from omitting it.
`first()`, `last()`, and an unseeded `reduce()` reject an empty execution with `RangeError`.
`find()` resolves `undefined` if nothing matches; `some()` resolves `false` and `every()` resolves `true` on empty completion.

## Cancellation and cleanup

```ts
import { when } from "@serve-tools/ponyfill-observable";

const controller = new AbortController();
when(document, "click")
	.map((event) => event.target)
	.take(3)
	.subscribe(console.log, { signal: controller.signal });

controller.abort(); // Cancels only this consumption and removes its listener.
```

Completion, error, and cancellation close an execution exactly once.
Closing first sets `active` to `false`, then aborts the producer's `signal`, then runs registered teardowns in reverse registration order.
Completion and error callbacks run after teardown; cancellation does not invoke either callback.
`error(reason)` and external cancellation preserve the reason on the producer signal.
Normal completion aborts it with the platform's default `AbortError` reason.
Teardown registered after closure runs immediately.
An already aborted `subscribe()` still invokes a custom producer with an inactive Subscriber, matching the proposal; producers should check `subscriber.active` before acquiring resources.
Promise consumption with an already aborted signal rejects without starting the producer.

Thrown producer errors are delivered to the error observer.
Thrown operator or terminal-consumer callbacks fail and cancel only that execution.
Exceptions in observer notifications or teardowns, missing error handlers, and errors reported after closure use native `reportError()` when available, otherwise `console.error()`.
Such notification failures do not interrupt other cleanup or automatically cancel the producer.
Callbacks and teardown are synchronous; returned functions and promises are ignored, and there is no asynchronous cleanup or backpressure protocol.

## Source boundaries

`Observable.from()` accepts this package's Observable instances, iterable objects, async iterable objects, and Promise-like objects, in that priority order.
An object implementing both iterator protocols uses its synchronous iterator; this intentionally differs from the current draft's async-first conversion order.
Each consumption obtains its own iterator from an iterable.
Cancellation closes an unfinished iterator; asynchronous iterator cleanup is initiated but not awaited by `subscribe()`.
A pending asynchronous `next()` cannot be forcibly interrupted, and a late failure is reported globally.
Promise reactions cannot be detached: a direct subscription, even if already aborted, retains its reactions until the Promise settles and reports a late rejection.
Async iterator cancellation passes the abort reason to `return()`; synchronous iterator cancellation calls `return()` without an argument.
Promise-like inputs are detected structurally through a callable `then`, including generic thenables and Promises from another realm.
All primitive inputs are rejected, including strings even though JavaScript primitive strings are iterable.
Foreign or native Observable instances without a supported source protocol are also not accepted.

Fresh Observable execution does not recreate an already existing Promise or clone a single-use generator object.
Use an iterable that creates fresh iterators, or create asynchronous work inside the Observable callback, when the underlying work must repeat independently.
Likewise, a custom producer may internally share a native event listener or other resource, but must retain a distinct Subscriber and cleanup registration for each execution.
The provided `when()` helper uses a separate listener per execution for simplicity.

## Deliberate limits

`takeUntil`, `flatMap`, `switchMap`, `inspect`, `catch`, and `finally` are not implemented in this initial subset.
No `EventTarget.prototype.when` or global `Observable`/`Subscriber` is installed.
This is ordinary JavaScript, not a complete Web IDL binding: cross-realm identity, exhaustive argument conversion, browser document-activity checks, and native abort-algorithm ordering are not emulated.
Iterator protocol methods must remain available between `from()` and consumption; a removed async iterator method does not fall back to the synchronous protocol.
Reentrant emissions receive distinct callback indices, and `take()` reserves its count before delivering a value to prevent nested emissions from exceeding the limit.
`take()` and `drop()` use the proposal's unsigned 64-bit count conversion (including truncation and wrapping); counts beyond JavaScript's safe integer range are subject to number precision.
The runtime requires native `AbortController`, `AbortSignal.any`, and standard ES2025 APIs.

## Agent Skill

The package includes `skills/serve-tools-ponyfill-observable/SKILL.md` with a compile-checked recipe and execution-boundary guidance.

## Development

```shell
npm test --workspace @serve-tools/ponyfill-observable
npm run typecheck --workspace @serve-tools/ponyfill-observable
npm run build --workspace @serve-tools/ponyfill-observable
npm run benchmark --workspace @serve-tools/ponyfill-observable
```

Benchmarks exercise the compiled public API in Chromium, including emission batches, operators, Promise consumers, iterator completion, and event-listener cancellation.
They measure component overhead, not application rendering or network latency.

## License

[MIT-0](./LICENSE.md)
