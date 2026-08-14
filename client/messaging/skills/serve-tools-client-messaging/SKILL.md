---
name: serve-tools-client-messaging
description: Use @serve-tools/client-messaging when building or reviewing typed request and subscription protocols across Worker, SharedWorker, MessagePort, or MessageChannel endpoints. Covers declarations, handlers, namespaces, cancellation, transfer lists, lifecycle, and trust boundaries; do not use for arbitrary postMessage traffic or general streams.
---

# Use @serve-tools/client-messaging

## Model the protocol

1. Declare named operations as callable methods with zero parameters or one structured input parameter.
2. Use the optional `requests` section for one promised result and the optional `subscriptions` section for ordered values over time.
3. Omit an unused section instead of declaring an empty record.
4. Treat a request response as `Awaited<ReturnType<Operation>>` and each subscription event as the raw `ReturnType<Operation>`.

Model finite work as requests and repeated occurrences as subscriptions.

```ts
interface Protocol {
	requests: {
		status(): Status;
		save(input: SaveInput): Revision | Promise<Revision>;
	};
	subscriptions: {
		changes(projectID: string): Change;
	};
}
```

Call a zero-input request as `client.request("status")` and pass `undefined` before options when needed.
Call a zero-input subscription as `client.subscribe("updates", onUpdate, options)` without an input placeholder.
For a one-input operation, pass the input immediately after its name.

## Choose the entrypoint surface

- Use root `connect()` and `serve()` for direct control of a worker or message port.
- Use `connect()` or the typed `SharedWorker` convenience class from `scope/window` in a window.
- Use `listen()` from `scope/worker` when a dedicated or shared worker owns the server lifecycle.
  Close or dispose the returned `Listener` to stop accepting shared-worker connections and close every active `Server`.

The root `connect` namespace and the window-scope `connect` namespace expose `Client`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestOptions`, `SubscribeOptions`, and `Subscription`.
The root `serve` namespace exposes `Handlers`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestContext`, `Server`, `SubscriptionContext`, and `TransferResult`.
The worker-scope `listen` namespace exposes `Handlers`, `Listener`, `MessageEndpoint`, `Protocol`, `ProtocolType`, `RequestContext`, `Server`, `SubscriptionContext`, and `TransferResult`.
The generic types are also directly exported as `Client`, `Server`, `Listener`, `Handlers`, `Subscription`, `RequestOptions`, `SubscribeOptions`, `RequestContext`, `SubscriptionContext`, and `TransferResult`.

## Retain inferred protocols

Use `ProtocolType<Value>` to extract the protocol branded onto a `Client`, `Server`, or `Listener`.
It also extracts through promise-wrapped branded values.
When the worker owns an inline declaration, export `ProtocolType<typeof listener>` and import that exported type on the window side.

```ts
type ClientProtocol = ProtocolType<typeof client>;
type ServerProtocol = ProtocolType<typeof server>;
type ListenerProtocol = ProtocolType<typeof listener>;
type PendingProtocol = ProtocolType<Promise<typeof client>>;
```

## Implement handlers

Implement the declared sections with `Handlers<Protocol>` or let `serve()` or `listen()` contextually type the handler object.
A request handler may return its declared result directly or through a promise and receives a `RequestContext` with its operation `signal`.
A subscription handler receives a `SubscriptionContext<Event>` for `emit()`, `complete()`, `error()`, and cancellation, and may return a cleanup callback.

## Preserve transport semantics

- Give a connected or served endpoint exclusively to this protocol.
  Do not mix unrelated application messages onto it.
- Keep transferred values structured-clone compatible.
  Use request transfer options for inputs and `transfer(value, list)` for handler results or subscription events.
- Pass `AbortSignal` through operation options.
  Every server handler receives its own signal; do not attempt to clone signals through the message graph.
- Add application-level batching, sampling, acknowledgement, or backpressure for unbounded producers.
  Subscriptions intentionally add no flow control to `postMessage`.
- Validate data received from an untrusted execution context.
  Protocol declarations are compile-time only and are not runtime validation.

The declaration names emit no runtime values.
The wire frames and the `@serve-tools/client-messaging/2` protocol constant did not change.

## Close every owned resource

- Unsubscribe active subscriptions before closing their client.
- Close the client or server to remove protocol listeners and notify the peer.
- Separately close an owned `MessagePort` or terminate an owned worker; protocol closure does not close the transport.
- Do not treat `closed` as crash detection.
  Add an application heartbeat if abrupt peer loss must be detected.

## Handle failures

Expect unknown operations, handler failures, and serialization failures to reject requests.
Handle subscription termination with `onError` and `onComplete`.
Preserve `RemoteError` as the representation of a thrown remote error.
