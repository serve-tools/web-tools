# Preserve Fetch and SSE boundaries

Use this client for server-to-client streaming where client operations can be separate POST exchanges.
Choose WebSocket or WebTransport for a persistent bidirectional session.

Prefer the async header provider for fresh authorization tokens.
Use operation signals for local cancellation and the connection signal for whole-client lifetime.
Treat an event stream that ends without protocol settlement as a transport failure, not successful completion.
Account for CORS preflight when cross-origin requests carry authorization or other non-simple headers.

Do not promise EventSource-style reconnection, `Last-Event-ID` replay, persistence, or resumption.
Keep proxy buffering, compression, credentials, CORS, and idle timeout policy in the deployment.
