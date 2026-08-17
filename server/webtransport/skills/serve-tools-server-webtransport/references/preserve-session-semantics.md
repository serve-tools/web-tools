# Preserve session semantics

Negotiate `serve-tools.realtime.v1` and authorize during session establishment.
Use the authorization result as connection context.

Route the client-created operations and registry streams by their leading role byte.
Forward stream chunks and finish notifications separately; forward native datagrams as complete messages.
Drop unknown datagram kinds because datagrams can overtake their reliable registry entries.

Use reliable handlers for required ordered work and datagram handlers only for replaceable state.
Do not impose an additional datagram size cap or promise delivery.
Expose the native maximum when available.

Close the adapter during shutdown and keep certificates, HTTP/3 configuration, origin policy, limits, and MoQ on their owning layers.
The current `@http3-server/server` peer cannot transmit the core's application close code at session level; document this if an adapter uses that peer.
