# Build an honest adapter

Negotiate and authorize before creating a connection.
Use the successful handshake result as the typed connection context.

Forward one complete protocol message to `receive()`.
Call `fail()` for invalid peer input and `disconnect()` only after the physical transport is gone.
Expose observable queued bytes through `bufferedAmount()` when the transport supports it.

Retain the core's operation, message, and buffering guards unless the application deliberately chooses other values.
Treat `formatError()` as a disclosure boundary and validate untrusted handler inputs.
