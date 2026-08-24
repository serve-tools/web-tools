# Encode typed datagrams

Use the high-level WebTransport packages unless implementing an adapter.

Run `DatagramRegistry` over a framed reliable stream so both peers agree on connection-local kind integers.
Use `encodeDatagram()` and `decodeDatagram()` only after that agreement.
Structured values use the serializer; binary buffers and views bypass it but remain enveloped and decode as `Uint8Array`.
Pass `maximumArrayBufferLength` to `decodeDatagram()` at trust boundaries so structured values cannot declare larger resizable buffers than the transport permits.
Keep the registry defaults of 256 distinct peer names, 256 UTF-8 bytes per name, and 4 KiB per framed control payload unless the application deliberately needs different positive `maximumPeerRegistrations`, `maximumNameLength`, or `maximumControlFrameLength` options.

Do not add a second package size limit, promise delivery, or use datagrams for required request settlement.
