# Preserve trust and wire boundaries

Protocol declarations are compile-time information, so validate untrusted responses and events at runtime.
Keep the socket exclusive and use a server with the same wire-protocol version.
Do not add JSON wrappers, serializer tags, or raw messages around package traffic.
Keep authentication, authorization, origin checks, transport security, payload limits, and application flow control in the surrounding system.
