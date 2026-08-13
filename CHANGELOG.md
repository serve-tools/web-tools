# Changelog

All notable changes to this package collection are documented here.

## Unreleased

## 0.2.0 - 2026-08-13

- Expand `@serve-tools/lit-signals` with signal-aware `when`, `choose`, and keyed `repeat` directives.
- Add signal collection and effect decorators, lifecycle-owned update effects, and complete Lit update tracking.
- Re-export the compatible Signal runtime and signal collections from `@serve-tools/lit-signals`.

## 0.1.1 - 2026-08-13

- Improve runtime performance and reduce allocation overhead across the client, Signal, and DOM packages.
- Harden messaging, shared database, storage, disposal, and idle-callback lifecycle behavior.
- Correct native collection semantics and improve reactive invalidation precision.
- Add package benchmarks and expand consumer documentation and Skills.

## 0.1.0 - 2026-08-12

- Create the npm workspace for client libraries, polyfills, ponyfills, and Vite plugins.
- Add `@serve-tools/client-db` with promise-based IndexedDB operations, abortable transactions, async scans, and explicit resource management.
- Add `@serve-tools/client-shared-db` with SharedWorker-coordinated IndexedDB operations and post-commit change subscriptions.
- Add `@serve-tools/client-storage` with local and session storage access and precise synchronous subscriptions.
- Add `@serve-tools/client-messaging` with requests, subscriptions, cancellation, transfer lists, and shared-worker integration.
- Add `@serve-tools/lit-signals` with fine-grained Signal directives, signal-backed Lit properties, computed getters, and atomic updates.
- Add `SignalWatcher` so mixed-in elements can read decorated properties directly from `render()`; use `watch(() => this.value)` for part-level updates.
- Add disposable `listen()` resources with return-type protocol and schema extraction to worker-backed packages.
- Add `@serve-tools/signal`, `@serve-tools/signal-effect`, `@serve-tools/signal-collections`, `@serve-tools/signal-messaging`, `@serve-tools/signal-shared-db`, `@serve-tools/signal-storage`, and `@serve-tools/signal-dom`.
- Add `@serve-tools/ponyfill-resource-management` with synchronous and asynchronous disposable stacks, module-scoped disposal symbols, and suppressed error handling.
- Add `@serve-tools/polyfill-resource-management` for global Explicit Resource Management symbols, stacks, and suppressed errors.
- Add `@serve-tools/polyfill-request-idle-callback` for global idle callback scheduling and cancellation.
- Add `@serve-tools/ponyfill-request-idle-callback` for idle scheduling without global mutation.
- Add `@serve-tools/vite-polyfills` with feature detection and conditional polyfill injection through the Vite transform pipeline.
- Exclude installed polyfill modules from Vite transforms to avoid circular, browser-crashing bundles.
- Add an approval-gated npm trusted-publishing workflow with immutable release artifacts and provenance.
