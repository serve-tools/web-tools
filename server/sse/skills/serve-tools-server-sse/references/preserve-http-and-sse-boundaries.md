# Preserve HTTP and SSE boundaries

Authorize before decoding operation input and return an HTTP `Response` for handshake rejection.
Validate sensitive operation input inside handlers.

Install CORS and OPTIONS handling in surrounding middleware when clients are cross-origin.
Configure body limits, rate limits, proxy buffering, compression, caching, keep-alives, and idle timeouts in the HTTP deployment.
Retain or deliberately configure the handler's streaming `maximumMessageLength` guard even when the deployment also enforces a body limit.

Abort handlers when the request signal aborts and close the handler during shutdown.
Do not claim replay, reconnection, resumption, persistence, or bidirectional session semantics.
