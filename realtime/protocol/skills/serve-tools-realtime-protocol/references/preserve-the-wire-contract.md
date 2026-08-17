# Preserve the wire contract

Use the exported `protocol` constant and message guards rather than recreating tuple literals or private tags.
Do not wrap, extend, or partially decode protocol messages without defining a new version.
Validate application values after validating the envelope because protocol types and guards do not validate inputs or outputs.
Apply payload and operation limits before allocating or dispatching untrusted traffic.
Pass `maximumArrayBufferLength` to `deserialize()` at a trust boundary so hostile resizable-buffer metadata cannot request a larger capacity than the adapter accepts.
Use the exported transport negotiation helpers and WebTransport stream-role constants rather than duplicating header parsing or wire bytes.
Do not expose error stacks across trust boundaries by default.
