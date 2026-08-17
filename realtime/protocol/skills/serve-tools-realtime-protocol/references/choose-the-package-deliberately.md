# Choose the package deliberately

- Use `@serve-tools/client-websocket` for an application WebSocket client.
- Use `@serve-tools/server-websocket` for application handlers and runtime WebSocket adapters.
- Use the client and server WebTransport packages when reliable operations and typed best-effort datagrams share a session.
- Use the client and server HTTP stream packages for separate Fetch operations and server-to-client binary streaming.
- Use this package directly for custom transports, protocol diagnostics, serialization, or reliable-stream framing.
- Keep it transport-neutral; it must not own authentication, socket lifecycle, retries, or application validation.
