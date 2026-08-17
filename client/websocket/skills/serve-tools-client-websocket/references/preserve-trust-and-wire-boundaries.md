# Preserve trust and wire boundaries

Protocol declarations are compile-time information, so validate untrusted responses and events at runtime.
Keep the socket exclusive and use `@serve-tools/server-websocket` or another server built on the same `@serve-tools/realtime-protocol` version.
Do not add JSON wrappers, serializer tags, or raw messages around package traffic.
Require the server to select the package's `serve-tools.realtime.v1` native WebSocket subprotocol.
Do not expose or emulate the core adapter's `receive()`, `fail()`, or `disconnect()` methods on the public network client.
Keep authentication, authorization, origin checks, transport security, payload limits, and application flow control in the surrounding system.
