# Client libraries

Libraries for client runtime capabilities across window and worker contexts.
Each immediate subdirectory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/client`](./client/) provides namespace-oriented access to the client libraries and focused capability subpaths.
- [`@serve-tools/client-context`](./context/) provides interoperable context events, lifecycle-owned providers and consumers, and indexed late-registration replay.
- [`@serve-tools/client-db`](./db/) provides promise-based IndexedDB operations, transactions, and scans.
- [`@serve-tools/client-event-source`](./event-source/) consumes typed JSON Server-Sent Events through the native EventSource lifecycle.
- [`@serve-tools/client-http-stream`](./http-stream/) provides typed HTTP requests and framed streaming subscriptions over Fetch.
- [`@serve-tools/client-input`](./input/) observes pointer and drag-and-drop input sessions with explicit lifecycle ownership.
- [`@serve-tools/client-interaction`](./interaction/) provides one-shot clipboard, picker, sharing, and eyedropper interactions with explicit outcomes.
- [`@serve-tools/client-keyboard`](./keyboard/) provides platform-aware keyboard chords, labels, symbols, and ARIA shortcuts.
- [`@serve-tools/client-messaging`](./messaging/) provides requests and subscriptions across workers and message ports.
- [`@serve-tools/client-realtime`](./realtime/) provides a transport-neutral core for typed realtime requests and subscriptions.
- [`@serve-tools/client-shared-db`](./shared-db/) coordinates IndexedDB operations and change subscriptions through a SharedWorker.
- [`@serve-tools/client-shared-event-source`](./shared-event-source/) shares one typed EventSource connection across browser contexts.
- [`@serve-tools/client-shared-http-stream`](./shared-http-stream/) shares typed HTTP requests and streaming subscriptions through a SharedWorker.
- [`@serve-tools/client-shared-websocket`](./shared-websocket/) shares typed WebSocket requests and subscriptions through a SharedWorker.
- [`@serve-tools/client-shared-webtransport`](./shared-webtransport/) shares typed WebTransport operations and datagrams through a SharedWorker.
- [`@serve-tools/client-storage`](./storage/) provides observable access to local and session storage.
- [`@serve-tools/client-websocket`](./websocket/) provides typed requests and subscriptions over binary structured-data WebSockets.
- [`@serve-tools/client-webtransport`](./webtransport/) provides typed reliable requests, subscriptions, and best-effort datagrams over WebTransport.
