# Build an honest adapter

Use this package only after the transport has selected `serve-tools.realtime.v1` through its native handshake or an equally explicit application handshake.

Supply one complete serialized message to `receive()`.
Frame a byte stream with `FrameDecoder` and `encodeFrame`; do not feed arbitrary chunks directly.
Call `fail()` for invalid peer input, `disconnect()` after physical loss, and `close()` for application shutdown.
Keep those three receive-side controls on the adapter connection; a network package's public client type should expose only requests, subscriptions, `closed`, and `close()`.

Keep authentication, native negotiation, framing, reconnection, and physical resource ownership in the adapter.
Do not multiplex unrelated application bytes through the connection.
