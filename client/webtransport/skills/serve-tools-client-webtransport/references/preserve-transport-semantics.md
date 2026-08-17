# Preserve transport semantics

Use requests and subscriptions for ordered, retransmitted state whose settlement matters.
Cancel or supersede obsolete reliable work; reliability does not make late data useful.

Use typed datagrams for replaceable recent state such as cursors, presence position, control input, telemetry samples, and transient simulation state.
Expect loss and do not build authoritative mutations or required acknowledgements on datagrams.
Drop an unknown connection-local kind because a datagram may race ahead of its reliable registry message.

Use `write()` for the shared writer and `createWritable(name)` only when separate native scheduling matters.
Binary inputs bypass structured serialization but remain named and enveloped.
Do not pre-reject by size; consult `maxDatagramSize` when the application wants to adapt.

Keep MoQ and every other application protocol on a separate WebTransport session.
Treat the connection signal as lifetime ownership after setup as well as cancellation during setup.
