# Frame HTTP streams

Use the high-level HTTP stream packages unless implementing an HTTP adapter.

Require the exported protocol-qualified media types instead of accepting an unqualified event stream or binary body.
Send one unframed protocol message for finite responses and use `encodeFrame()` plus one `FrameDecoder` for streaming subscription responses.

Do not treat framing as reconnection, replay, persistence, CORS, or proxy-buffering policy.
