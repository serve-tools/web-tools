# Preserve independent executions

Import this ponyfill directly even when native `Observable` exists; the native implementation may share an execution across consumers.
Every consumption of this package's Observable starts fresh Subscriber and operator state.
Creating a derived Observable does not start its producer.
Do not add implicit multicast, reference counting, replay, or a shared `take()` counter.

Create producer resources inside the callback and register synchronous cleanup with `subscriber.addTeardown()`.
Check `subscriber.active` before setup because `subscribe()` with an already aborted signal still invokes the producer.
Pass a separate `AbortSignal` for each independently cancellable consumer.
Cancellation closes that consumption without a completion notification; Promise consumption rejects with the cancellation reason.
Use `when(target, type)` instead of installing or calling `EventTarget.prototype.when()`.

`Observable.from()` accepts iterable objects, async iterable objects, and Promise-like objects, including structural thenables.
It rejects primitive strings and checks the synchronous iterator before the asynchronous iterator when an object implements both protocols.
That ordering is part of this package's documented contract even though the current WICG draft checks the asynchronous protocol first.
It does not restart a Promise or clone a generator object; pass a reusable iterable or create work inside the producer.
Sharing a producer resource requires separate Subscriber registrations and cleanup; it must not share Observable execution state.
The base API has no `share()` helper, backpressure, asynchronous teardown, or promise-aware observer callbacks.
Check the README before using proposal operators outside the supported subset.
