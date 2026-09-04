# Preserve transport semantics

Use requests and subscriptions for ordered, retransmitted state whose settlement matters.
Cancel or supersede obsolete reliable work; reliability does not make late data useful.

Use typed datagrams for replaceable recent state such as cursors, presence position, control input, telemetry samples, and transient simulation state.
Expect loss and do not build authoritative mutations or required acknowledgements on datagrams.
Drop an unknown connection-local kind because a datagram may race ahead of its reliable registry message.

Use `write()` for the shared writer and `createWritable(name)` only when separate native scheduling matters.
Shared writes prefer native `datagrams.createWritable()` and fall back to legacy `datagrams.writable`.
Independent writables require native `createWritable()` support; legacy calls synchronously throw `NotSupportedError`, including calls without options, without interrupting shared writes or reliable operations.
Do not adapt a legacy shared stream by returning it from `createWritable()`: the client already owns its writer lock, and a shared queue cannot preserve independent scheduling or close/abort ownership.
Connect with the native transport or an adapter that accurately exposes its capabilities.
Transports with neither outgoing API fail setup with `NotSupportedError` and close the session.
Binary inputs bypass structured serialization but remain named and enveloped.
Do not pre-reject by size; consult `maxDatagramSize` when the application wants to adapt.
Expect direct datagram subscriptions to become inactive, and pending datagram registrations and `read()` calls to reject, when either reliable protocol stream or the client session closes.
Incoming structured binary allocations are bounded by the native maximum datagram size, with a 64 KiB fallback.

Keep MoQ and every other application protocol on a separate WebTransport session.
Treat the connection signal as lifetime ownership after setup as well as cancellation during setup.
