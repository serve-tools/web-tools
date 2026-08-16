# Choose the package deliberately

- Use requests for finite work and subscriptions for repeated ordered events.
- Use protocol types to connect operation names with input and output types.
- Send structured JavaScript and binary values without a custom codec.
- Choose a raw WebSocket abstraction for arbitrary frames, shared sockets, custom codecs, streaming, or transport backpressure.

Pair it with `@serve-tools/server-websocket` when the server should implement the same typed protocol.
The client package itself does not provide retry, session resumption, persisted delivery, request replay, or demand signaling.
