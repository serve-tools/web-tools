# Decorate an operation view

- Create one ambient `AsyncOperationSubscriber`, build its filtered or mapped views before consumption begins, and import `operation` from `@serve-tools/lit-signals/decorators`.
- Pass one already-created `OperationView` to `@operation(view, options?)` and use the auto-accessor initializer as the value shown before that element receives a view value.
- Share the same view across multiple decorated elements when they should follow the same operation stream.
- Read the accessor directly from a `SignalElement` or `SignalWatcher` update when changes should run the complete Lit lifecycle; use `watch(() => this.value)` from a plain `LitElement` when only one template part should update.
- Treat the accessor as read-only because assigning it throws a `TypeError`.
- Expect disconnection to dispose only that element's view subscription; the ambient subscriber owner remains responsible for the operation, terminal result or error, cancellation, and asynchronous cleanup.
- Expect a newly connected element to retain its initializer, and a reconnected element to retain its last received value, until a future emission because operation views do not replay.
- Set `disconnectDelay` to a number or a function returning a number only when a brief disconnection should retain the same element subscription; `0` covers synchronous DOM moves completed before the timer fires.
- Remember that one `AsyncOperationSubscriber` consumes at most one operation, while terminal subscriptions may connect and disconnect during that consumption.
