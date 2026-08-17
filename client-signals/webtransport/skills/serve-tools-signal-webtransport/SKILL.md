---
name: serve-tools-signal-webtransport
description: Use @serve-tools/signal-webtransport clients and Signals.
---

# Use @serve-tools/signal-webtransport

Treat the installed package README and public declarations as the API source of truth.

## Route by task

- [Recipe: connect and observe WebTransport](references/recipe-quick-start.md): compile-checked session creation and reliable observation.

- Import `connect()` and `observe()` from this package; the client API is re-exported unchanged.
- Observe reliable subscriptions as latest state.
- Consume datagrams as occurrences through the underlying client.
- Handle every observation state and dispose observations independently from the session.
