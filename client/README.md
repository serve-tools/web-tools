# Client libraries

Libraries for client runtime capabilities across window and worker contexts.
Each immediate subdirectory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/client`](./client/) provides namespace-oriented access to the client libraries and focused capability subpaths.
- [`@serve-tools/client-context`](./context/) provides interoperable context events, lifecycle-owned providers and consumers, and indexed late-registration replay.
- [`@serve-tools/client-db`](./db/) provides promise-based IndexedDB operations, transactions, and scans.
- [`@serve-tools/client-input`](./input/) observes pointer and drag-and-drop input sessions with explicit lifecycle ownership.
- [`@serve-tools/client-interaction`](./interaction/) provides one-shot clipboard, picker, sharing, and eyedropper interactions with explicit outcomes.
- [`@serve-tools/client-keyboard`](./keyboard/) provides platform-aware keyboard chords, labels, symbols, and ARIA shortcuts.
- [`@serve-tools/client-messaging`](./messaging/) provides requests and subscriptions across workers and message ports.
- [`@serve-tools/client-shared-db`](./shared-db/) coordinates IndexedDB operations and change subscriptions through a SharedWorker.
- [`@serve-tools/client-storage`](./storage/) provides observable access to local and session storage.
