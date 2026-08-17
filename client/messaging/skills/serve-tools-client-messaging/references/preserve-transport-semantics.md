# Preserve transport semantics

- Give a connected or served endpoint exclusively to this protocol.
  Do not mix unrelated application messages onto it.
- Await `client.ready` when later setup must follow the explicit `HELLO`/`WELCOME` application handshake.
- Keep transferred values structured-clone compatible.
  Use request transfer options for inputs and `transfer(value, list)` for handler results or subscription events.
- Pass `AbortSignal` through operation options.
  Every server handler receives its own signal; do not attempt to clone signals through the message graph.
- Add application-level batching, sampling, acknowledgement, or backpressure for unbounded producers.
  Subscriptions intentionally add no flow control to `postMessage`.
- Validate data received from an untrusted execution context.
  Protocol declarations are compile-time only and are not runtime validation.

The declaration names emit no runtime values.
The wire protocol identifier is `@serve-tools/client-messaging/3`.
