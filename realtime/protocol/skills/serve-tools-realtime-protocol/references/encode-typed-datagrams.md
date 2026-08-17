# Encode typed datagrams

Use the high-level WebTransport packages unless implementing an adapter.

Run `DatagramRegistry` over a framed reliable stream so both peers agree on connection-local kind integers.
Use `encodeDatagram()` and `decodeDatagram()` only after that agreement.
Structured values use the serializer; binary buffers and views bypass it but remain enveloped and decode as `Uint8Array`.

Do not add a second package size limit, promise delivery, or use datagrams for required request settlement.
