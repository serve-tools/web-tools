# Frame HTTP streams

Use the high-level HTTP stream packages unless implementing an HTTP adapter.

Require `contentType` for unframed operation messages and finite responses.
Require `streamContentType` for length-prefixed subscription responses.
Parse `Content-Type` as one representation and `Accept` as a weighted list; never treat a `q=0` entry as acceptable.
Send one unframed protocol message for finite responses and use `encodeFrame()` plus one `FrameDecoder` for streaming subscription responses.

Do not treat framing as reconnection, replay, persistence, CORS, or proxy-buffering policy.
