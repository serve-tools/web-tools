---
name: serve-tools-signal-shared-webtransport
description: Use @serve-tools/signal-shared-webtransport to observe SharedWorker WebTransport subscriptions as Signal state.
---

# Use @serve-tools/signal-shared-webtransport

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: observe shared WebTransport](references/recipe-quick-start.md): compile-checked page-owned observation.

- Keep the physical WebTransport session worker-owned and observations page-owned.
- Observe reliable subscriptions; consume datagrams as occurrences.
- Dispose observations before closing the page client.
