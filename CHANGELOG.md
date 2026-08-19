# Changelog

All notable changes to this package collection are documented here.

## Unreleased

- Add `@serve-tools/async-operation@0.1.0` with typed backpressured events, one terminal result, canonical cancellation, upstream abort composition, and asynchronous disposal.
- Add `@serve-tools/signals@0.1.0` as a flat facade with focused subpaths for the compatible Signal runtime, collections, and effects.
- Add Node.js runtimes for `@serve-tools/ponyfill-arraybuffer-base64@0.1.0` and `@serve-tools/polyfill-arraybuffer-base64@0.1.0` with the `Uint8Array.prototype.toBase64()` contract.
- Add `@serve-tools/realtime-protocol@0.1.0` with the shared binary serializer, typed message tuples, runtime guards, error records, and bounded reliable-stream framing for WebSocket and future WebTransport integrations.
- Establish `@serve-tools/realtime/1` as the initial wire-protocol compatibility identifier.
- Establish `serve-tools.realtime.v1` as the native WebSocket and WebTransport subprotocol identifier.
- Use `application/vnd.serve-tools.realtime.v1` for finite HTTP protocol messages and its `framing=length-prefixed` representation for streaming subscriptions, with distinct `Content-Type` and weighted `Accept` validation.
- Add `@serve-tools/client-realtime@0.1.0` and `@serve-tools/server-realtime@0.1.0` as shared sans-I/O operation cores for transport adapters.
- Add `@serve-tools/client-webtransport@0.1.0` and `@serve-tools/server-webtransport@0.1.0` with reliable framed operations, a reliable datagram-name registry, typed best-effort datagrams, native binary bypass, and a Node.js `@http3-server/server` adapter.
- Add `@serve-tools/client-http-stream@0.1.0` and `@serve-tools/server-http-stream@0.1.0` with Fetch-based authenticated binary requests, abortable framed subscription streams, and explicit HTTP media negotiation.
- Add `@serve-tools/client-shared-http-stream@0.1.0` and `@serve-tools/client-shared-webtransport@0.1.0` for SharedWorker-owned transports with per-page logical clients.
- Add `@serve-tools/signal-db@0.1.0`, `@serve-tools/signal-http-stream@0.1.0`, `@serve-tools/signal-shared-http-stream@0.1.0`, `@serve-tools/signal-webtransport@0.1.0`, and `@serve-tools/signal-shared-webtransport@0.1.0` for package-complete reactive client parity.
- Add `httpStream` and `webtransport` namespaces and focused subpaths to the pending `@serve-tools/client@0.2.0` umbrella.
- Add `@serve-tools/server-websocket@0.1.0` with a sans-I/O connection core, WHATWG WebSocket attachment, Node.js, Bun, and crossws adapters, authorization context, cancellation, cleanup, error redaction, operation limits, and bounded transport buffering.
- Refactor `@serve-tools/client-websocket@0.1.0` before its initial release to consume the shared realtime core and protocol, and require native WebSocket subprotocol negotiation.
- Add the explicit `HELLO`/`WELCOME` application handshake to `@serve-tools/client-messaging@0.2.0`, where the underlying `MessagePort` API has no native subprotocol negotiation.
- Add real client/server conformance coverage for Node.js, Bun, and Deno, plus Chromium, Firefox, and WebKit client coverage.
- Add realtime codec, HTTP stream, and WebTransport loopback benchmarks, and remove redundant WebSocket modules, HTTP stream re-decoding, server delivery allocations, and WebTransport writer queues.
- Harden the pending realtime packages for aborted HTTP requests, bounded streaming bodies and resizable buffers, exact remote errors, Bun backpressure, datagram registration races, and WebTransport lifetime aborts.
- Centralize native WebSocket and WebTransport offer parsing and reliable WebTransport stream roles, and keep receive-side adapter controls out of public network client types.
- Prepare browser-package patch releases for `@serve-tools/client-context@0.1.1`, `@serve-tools/client-db@0.1.2`, `@serve-tools/client-input@0.1.1`, `@serve-tools/client-interaction@0.1.1`, `@serve-tools/client-keyboard@0.1.1`, and `@serve-tools/client-storage@0.1.3`.
- Prepare Signal and Lit releases for `@serve-tools/signal-dom@0.1.2`, `@serve-tools/signal-event-target@0.1.1`, `@serve-tools/signal-storage@0.1.2`, `@serve-tools/lit-signals@0.4.0`, `@serve-tools/signal-collections@0.1.2`, `@serve-tools/signal-effect@0.1.2`, and `@serve-tools/signal@0.1.2`.
- Prepare platform-tooling patch releases for `@serve-tools/polyfill-request-idle-callback@0.1.2`, `@serve-tools/polyfill-resource-management@0.1.2`, `@serve-tools/ponyfill-request-idle-callback@0.1.2`, `@serve-tools/ponyfill-resource-management@0.1.2`, and `@serve-tools/vite-polyfills@0.1.2`.

## 0.4.0 - 2026-08-15

- Add `@serve-tools/client-websocket` with typed requests, subscriptions, cancellation, reconnection-safe ownership, and binary structured-value serialization.
- Add `@serve-tools/client-shared-websocket` to share one worker-owned WebSocket across same-origin tabs and windows.
- Add `@serve-tools/signal-websocket` and `@serve-tools/signal-shared-websocket` for explicit Signal-backed subscription state.
- Add `@serve-tools/client-signals` as the namespace-oriented umbrella for the Signal-aware client packages.
- Replace descriptor-shaped messaging operations with callable protocol methods and simplify the public messaging type names.
- Add SharedWorker liveness leases so abandoned page connections are reclaimed without closing caller-owned ports.
- Add the `@serve-tools/skills` package and strengthen package Skills, recipe compilation, catalog checks, and evaluation fixtures.

## 0.3.0 - 2026-08-14

- Add hosted demos for client context, input, interaction, keyboard, and SharedWorker-coordinated database behavior.
- Add `@serve-tools/client` with namespace-oriented root exports, focused capability subpaths, messaging scope helpers, and scoped shared database entrypoints under `db/scope/*`.
- Add `@serve-tools/client-context` with protocol-compatible events, deterministic provider and consumer lifecycle, indexed late-registration replay, subscription takeover, fallback, and explicit topology refresh.
- Move the `@serve-tools/lit-signals` context decorators onto the owned context runtime, re-export its context primitives, and retain bidirectional Lit interoperability.
- Add `@serve-tools/client-interaction` with explicit browser-interaction outcomes, transient-activation-safe clipboard writes, pickers, and sharing.
- Add `@serve-tools/client-input` with abortable pointer and drop-target session observation.
- Add `@serve-tools/client-keyboard` with platform-aware chord matching, labels, symbols, and ARIA shortcuts.
- Add `@serve-tools/signal-event-target` with disposable read-only EventTarget state and media-query Signals.
- Re-export the event-target Signal utilities from `@serve-tools/lit-signals` for direct use in Lit reactive boundaries.
- Add signal-native `html` and `svg`, a precomposed `SignalElement`, curated static `css`, and the `@style` reactive host-style decorator to `@serve-tools/lit-signals`.

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
