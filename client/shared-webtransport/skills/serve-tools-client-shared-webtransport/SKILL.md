---
name: serve-tools-client-shared-webtransport
description: Use @serve-tools/client-shared-webtransport to share typed WebTransport operations and datagrams through a SharedWorker.
---

# Use @serve-tools/client-shared-webtransport

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: shared WebTransport](references/recipe-quick-start.md): compile-checked worker ownership, reliable operations, and datagrams.

## Boundaries

- Call `listen()` in the shared worker and `connect(worker.port)` in each page.
- Keep the physical session, reliable streams, datagram registry, and native writer worker-owned.
- Treat `maxDatagramSize` as asynchronous and use `write()`, `subscribe()`, or `read()` for shared datagrams.
- Use the direct WebTransport package when independent native writable scheduling is required.
- Do not use datagrams for authoritative mutations or required delivery.
