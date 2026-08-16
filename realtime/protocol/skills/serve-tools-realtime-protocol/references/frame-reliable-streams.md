# Frame reliable streams

Use `encodeFrame()` and one `FrameDecoder` per reliable ordered byte stream.
Write the returned bytes completely and pass each received stream chunk to `decoder.push()`.
Deserialize only complete payloads returned by the decoder.
Call `finish()` when the readable stream ends so a truncated final frame cannot disappear silently.
Set the decoder maximum at or below the server's protocol-message limit.
Do not add stream framing to WebSocket messages, which already preserve boundaries.
Do not carry request or subscription messages over unreliable WebTransport datagrams without designing distinct loss, ordering, duplication, and size semantics.
