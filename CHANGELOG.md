# Changelog

All notable changes to this package collection are documented here.

## Unreleased

- Create the npm workspace for client libraries, polyfills, ponyfills, and Vite
  plugins.
- Add `@serve-tools/client-db` with promise-based IndexedDB operations,
  abortable transactions, async scans, and explicit resource management.
- Add `@serve-tools/client-shared-db` with SharedWorker-coordinated IndexedDB
  operations and post-commit change subscriptions.
- Add `@serve-tools/client-storage` with local and session storage access and
  precise synchronous subscriptions.
- Add `@serve-tools/client-messaging` with requests, subscriptions,
  cancellation, transfer lists, and shared-worker integration.
- Add `@serve-tools/ponyfill-resource-management` with synchronous and
  asynchronous disposable stacks, module-scoped disposal symbols, and
  suppressed error handling.
- Add `@serve-tools/polyfill-resource-management` for global Explicit
  Resource Management symbols, stacks, and suppressed errors.
- Add `@serve-tools/polyfill-request-idle-callback` for global idle callback
  scheduling and cancellation.
- Add `@serve-tools/ponyfill-request-idle-callback` for idle scheduling without
  global mutation.
- Add `@serve-tools/vite-polyfills` with feature detection and conditional
  polyfill injection through the Vite transform pipeline.
