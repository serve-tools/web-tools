# Declare realtime protocols

- Declare `requests` and `subscriptions` as named TypeScript method signatures with zero parameters or one input value.
- Treat request return types as response values and subscription return types as delivered event values; omit either unused section.
- Use messaging's generic `Protocol`, `Client`, `Server`, `Listener`, `Handlers`, `ProtocolType`, option, context, subscription, endpoint, and transfer names instead of worker-prefixed names.
- Use the matching type aliases under the messaging `connect`, `serve`, and worker-scope `listen` namespaces when they keep ownership clear.
- Extract messaging protocols with `ProtocolType` from branded clients, servers, listeners, or promise-wrapped versions of those resources.
- Extract WebSocket protocols from either pending or resolved clients with the top-level `ProtocolType` or `connect.ProtocolType` alias.
- Use the same callable declaration shape for HTTP stream and WebTransport operations; add the directional `datagrams` section only for WebTransport.
- Treat protocol declarations and resource brands as compile-time-only metadata; each transport retains its own explicit wire negotiation.
