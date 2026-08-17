# Encode SSE messages

Use the high-level SSE packages unless implementing an HTTP adapter.

Require the exported protocol-qualified media types instead of accepting an unqualified event stream or binary body.
Encode complete binary protocol messages as base64 event data and parse response chunks with one `EventStreamDecoder`.
Read `decoder.reconnectionTime` when an adapter implements EventSource-style retry timing; a `retry` field updates it without dispatching an event.

Do not treat the decoder as reconnection, replay, persistence, CORS, or proxy-buffering policy.
