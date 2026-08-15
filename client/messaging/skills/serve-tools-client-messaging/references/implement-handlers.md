# Implement handlers

Implement the declared sections with `Handlers<Protocol>` or let `serve()` or `listen()` contextually type the handler object.
A request handler may return its declared result directly or through a promise and receives a `RequestContext` with its operation `signal`.
A subscription handler receives a `SubscriptionContext<Event>` for `emit()`, `complete()`, `error()`, and cancellation, and may return a cleanup callback.
