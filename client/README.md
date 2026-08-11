# Client libraries

Libraries for client runtime capabilities across window and worker contexts.
Each immediate subdirectory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/client-db`](./db/) provides promise-based IndexedDB operations, transactions, and scans.
- [`@serve-tools/client-messaging`](./messaging/) provides requests and subscriptions across workers and message ports.
- [`@serve-tools/client-shared-db`](./shared-db/) coordinates IndexedDB operations and change subscriptions through a
  SharedWorker.
- [`@serve-tools/client-storage`](./storage/) provides observable access to local and session storage.
