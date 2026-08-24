# Client signal libraries

Signal-aware client libraries for messaging, WebSockets, browser storage, IndexedDB, and the DOM.
Each immediate subdirectory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/signal-db`](./db/) provides typed IndexedDB query state that refreshes after writes through the same connection.
- [`@serve-tools/signal-dom`](./dom/) provides functional signal-aware DOM, SVG, and MathML templating.
- [`@serve-tools/signal-event-source`](./event-source/) exposes typed EventSource values as latest-event Signal state.
- [`@serve-tools/signal-event-target`](./event-target/) observes EventTarget state and media-query matches as read-only Signals.
- [`@serve-tools/signal-http-stream`](./http-stream/) exposes typed HTTP subscriptions as current Signal state.
- [`@serve-tools/signal-messaging`](./messaging/) observes typed messaging subscriptions as explicit Signal state.
- [`@serve-tools/signal-shared-db`](./shared-db/) adds cross-tab reactive queries to `@serve-tools/client-shared-db`.
- [`@serve-tools/signal-shared-event-source`](./shared-event-source/) exposes SharedWorker-owned EventSource values as latest-event Signal state.
- [`@serve-tools/signal-shared-http-stream`](./shared-http-stream/) exposes SharedWorker-owned HTTP subscriptions as current Signal state.
- [`@serve-tools/signal-shared-websocket`](./shared-websocket/) observes shared WebSocket subscriptions as explicit Signal state.
- [`@serve-tools/signal-shared-webtransport`](./shared-webtransport/) observes shared WebTransport subscriptions as explicit Signal state.
- [`@serve-tools/signal-storage`](./storage/) adds reactive watches to `@serve-tools/client-storage`.
- [`@serve-tools/signal-websocket`](./websocket/) observes typed WebSocket subscriptions as explicit Signal state.
- [`@serve-tools/signal-webtransport`](./webtransport/) observes typed WebTransport subscriptions as current Signal state while datagrams remain occurrences.
- [`@serve-tools/client-signals`](./client-signals/) provides namespace-oriented access to every signal-aware client package.
