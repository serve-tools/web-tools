---
name: serve-tools-client-webtransport
description: Use @serve-tools/client-webtransport for reliable typed operations and typed best-effort datagrams over WebTransport.
---

# Use @serve-tools/client-webtransport

Treat the installed package README and public declarations as the API source of truth.
Read only the references needed for the task.

Use `datagrams.write()` for portable shared writes across modern `createWritable()` and legacy `writable` transports.
Independent `datagrams.createWritable(name, options)` requires native support and synchronously throws `NotSupportedError` on legacy transports.

## Route by task

- [Recipe: operations and datagrams](references/recipe-quick-start.md): compile-checked negotiation, reliable request, binary bypass, subscription, and disposal.
- To choose reliable streams versus datagrams and avoid MoQ collisions, read [Preserve transport semantics](references/preserve-transport-semantics.md).
