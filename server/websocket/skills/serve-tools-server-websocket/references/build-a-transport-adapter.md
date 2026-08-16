# Build a transport adapter

Map each accepted transport session to exactly one `createConnection()` instance.
Forward every complete protocol payload to `receive()` in order.
Map output to `send()` and physical shutdown to `close(code, reason)`.
Call `fail(reason)` for transport input that violates the protocol, including non-binary WebSocket frames.
Call `disconnect()` when the transport has already failed or closed.
For a reliable WebTransport stream, use `FrameDecoder` for incoming chunks and `encodeFrame()` for outgoing payloads.
Do not use unreliable datagrams for the existing request and subscription contract.
