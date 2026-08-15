# Choose the entrypoint surface

- Use root `connect()` and `serve()` for direct control of a worker or message port.
- Use `connect()` or the typed `SharedWorker` convenience class from `scope/window` in a window.
- Use `listen()` from `scope/worker` when a dedicated or shared worker owns the server lifecycle.
  Close or dispose the returned `Listener` to stop accepting shared-worker connections and close every active `Server`.

The root `connect` namespace and the window-scope `connect` namespace expose `Client`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestOptions`, `SubscribeOptions`, and `Subscription`.
The root `serve` namespace exposes `Handlers`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestContext`, `Server`, `SubscriptionContext`, and `TransferResult`.
The worker-scope `listen` namespace exposes `Handlers`, `Listener`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestContext`, `Server`, `SubscriptionContext`, and `TransferResult`.
The generic types are also directly exported as `Client`, `Server`, `Listener`, `Handlers`, `Subscription`, `RequestOptions`, `SubscribeOptions`, `RequestContext`, `SubscriptionContext`, and `TransferResult`.
