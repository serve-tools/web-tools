---
name: serve-tools-client-messaging
description: Use @serve-tools/client-messaging when designing, implementing, reviewing, or debugging typed request and subscription protocols across Worker, SharedWorker, MessagePort, or MessageChannel endpoints. Covers handlers, cancellation, transfer lists, lifecycle, and trust boundaries; do not use for arbitrary postMessage traffic or general streams.
---

# Use @serve-tools/client-messaging

## Model the protocol

1. Define a `WorkerProtocol` with `requests` for one promised result and `subscriptions` for ordered values over time.
2. Use `WorkerOperation<Input, Output>` for each named operation and implement the protocol with `WorkerHandlers`.
3. Use `connect()` and `serve()` for direct endpoints, or `listen()` from the worker-scope entrypoint when the current dedicated or shared worker owns the server lifecycle.

When the worker owns the protocol definition, declare the protocol inline through `listen<Protocol>()`, export `ProtocolType<typeof connections>`, and import that exported protocol with `import type` on the window side.
Use `ProtocolType<typeof server>` to retain the same reference pattern for a single server returned by `serve<Protocol>()`.
Close or dispose the listener to stop accepting shared-worker connections and close every active server.

Do not recreate the removed distributed-object or general-stream abstraction.
Model finite work as requests and repeated occurrences as subscriptions.

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
  Type declarations are not runtime validation.

## Close every owned resource

- Unsubscribe active subscriptions before closing their client.
- Close the client or server to remove protocol listeners and notify the peer.
- Separately close an owned `MessagePort` or terminate an owned worker; protocol closure does not close the transport.
- Do not treat `closed` as crash detection.
  Add an application heartbeat if abrupt peer loss must be detected.

## Handle failures

Expect unknown operations, handler failures, and serialization failures to reject requests.
Handle subscription termination with `onError` and `onComplete`.
Preserve `WorkerRemoteError` as the representation of a thrown remote error.

## Validate changes

Update protocol declarations, runtime behavior, README recipes, Node tests, browser SharedWorker tests, and type fixtures together.
