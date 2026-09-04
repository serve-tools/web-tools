# Package selection

Select the narrowest package that owns the required behavior.

- Cold Web Observable executions and AbortSignal-based subscriptions without global mutation: `@serve-tools/ponyfill-observable`.
- Interned named-value Map keys and Set values without global mutation: `@serve-tools/ponyfill-composites`.
- Owned async events, terminal results, backpressure, and cancellation: `@serve-tools/async-operation`.
- Web components and a base element with automatically suspended signal bindings: `@serve-tools/aui` (workspace-only in this guide version; not yet published to npm).
- Typed JSON HTTP contracts, schema-free Fetch clients, validated handlers, and optional OpenAPI: `@serve-tools/http-contract`.
- Runtime-neutral typed route declarations, matching, and URL construction: `@serve-tools/router`.
- Namespace facade for several browser utilities: `@serve-tools/client`.
- Namespace facade for several Signal-aware browser clients: `@serve-tools/client-signals`.
- DOM context providers and consumers with late-registration replay: `@serve-tools/client-context`.
- Reusable DOM regions without signals: `@serve-tools/client-dom-fragment`.
- Promise-based IndexedDB operations, transactions, and scans: `@serve-tools/client-db`.
- Native EventSource, typed JSON events, reconnection, and event IDs: `@serve-tools/client-event-source`.
- Binary HTTP requests, subscriptions, headers, and framed responses: `@serve-tools/client-http-stream`.
- SharedWorker-owned HTTP requests, subscriptions, and authorization: `@serve-tools/client-shared-http-stream`.
- Explicitly owned pointer and drag-and-drop sessions: `@serve-tools/client-input`.
- Clipboard, file picker, sharing, and eyedropper actions: `@serve-tools/client-interaction`.
- Keyboard chords, accessible labels, platform symbols, and ARIA shortcuts: `@serve-tools/client-keyboard`.
- Typed worker or MessagePort requests and subscriptions: `@serve-tools/client-messaging`.
- Sans-I/O custom realtime client operation adapter: `@serve-tools/client-realtime`.
- Typed browser navigation, installed route arrays, and automatic View Transitions: `@serve-tools/client-router`.
- SharedWorker-coordinated IndexedDB operations and change subscriptions: `@serve-tools/client-shared-db`.
- SharedWorker-owned native EventSource and per-page event subscriptions: `@serve-tools/client-shared-event-source`.
- SharedWorker-owned WebSocket with per-page logical clients: `@serve-tools/client-shared-websocket`.
- SharedWorker-owned WebTransport operations and datagrams: `@serve-tools/client-shared-webtransport`.
- Observable localStorage and sessionStorage reads and writes: `@serve-tools/client-storage`.
- Typed binary WebSocket requests and subscriptions: `@serve-tools/client-websocket`.
- Typed WebTransport reliable operations and lossy datagrams: `@serve-tools/client-webtransport`.
- Fetch-compatible binary HTTP request and subscription handlers: `@serve-tools/server-http-stream`.
- Fetch-compatible JSON Server-Sent Events, IDs, replay cursors, and keepalives: `@serve-tools/server-event-source`.
- Sans-I/O custom realtime server handler adapter without a client: `@serve-tools/server-realtime`.
- Typed WebSocket request and subscription server handlers: `@serve-tools/server-websocket`.
- Typed WebTransport operation and datagram server handlers: `@serve-tools/server-webtransport`.
- Realtime structured serialization, message guards, and reliable stream framing: `@serve-tools/realtime-protocol`.
- Signal-aware functional HTML, SVG, and MathML templating: `@serve-tools/signal-dom`; opt-in tagged HTML descriptions with `html` and capture-aware `createFragment`: `@serve-tools/signal-dom/template`.
- EventTarget state and media queries as disposable read-only Signals: `@serve-tools/signal-event-target`.
- Complete EventSource client with latest-event Signal state and IDs: `@serve-tools/signal-event-source`.
- Complete messaging client with reactive subscription Signal state: `@serve-tools/signal-messaging`.
- Direct IndexedDB queries as invalidated, disposable Signal state: `@serve-tools/signal-db`.
- Complete HTTP streaming client with subscription Signal state: `@serve-tools/signal-http-stream`.
- SharedWorker IndexedDB queries as reactive Signal state: `@serve-tools/signal-shared-db`.
- SharedWorker EventSource client with latest-event Signal state: `@serve-tools/signal-shared-event-source`.
- SharedWorker HTTP streaming client with subscription Signal state: `@serve-tools/signal-shared-http-stream`.
- Complete WebSocket client with subscription Signal state: `@serve-tools/signal-websocket`.
- SharedWorker WebSocket client with subscription Signal state: `@serve-tools/signal-shared-websocket`.
- Complete WebTransport client with reliable Signal state and occurrence datagrams: `@serve-tools/signal-webtransport`.
- SharedWorker WebTransport client with reliable subscription Signal state: `@serve-tools/signal-shared-webtransport`.
- Disposable reactive Web Storage value watches: `@serve-tools/signal-storage`.
- Signal-aware Lit templates, directives, decorators, styles, and lifecycle: `@serve-tools/lit-signals`.
- Facade combining Signal primitives, collections, and effects: `@serve-tools/signals`.
- Signal-aware native Array, Map, Set, and Object collections: `@serve-tools/signal-collections`.
- Microtask-batched, disposable Signal effects: `@serve-tools/signal-effect`.
- Core TC39 Signal State, Computed, and Watcher primitives: `@serve-tools/signal`.
- Install a native-preserving global `Symbol.metadata`: `@serve-tools/polyfill-decorator-metadata`.
- Import a module-scoped metadata symbol without global mutation: `@serve-tools/ponyfill-decorator-metadata`.
- Transform modern TC39 decorators in Rolldown and Vite: `@serve-tools/rolldown-decorators`.
- Install `Uint8Array.prototype.toBase64` in Node.js: `@serve-tools/polyfill-arraybuffer-base64`.
- Import base64 encoding in Node.js without global mutation: `@serve-tools/ponyfill-arraybuffer-base64`.
- Install idle-callback globals: `@serve-tools/polyfill-request-idle-callback`.
- Import idle-callback functions without global mutation: `@serve-tools/ponyfill-request-idle-callback`.
- Install native-aware prioritized task scheduling globals: `@serve-tools/polyfill-prioritized-task-scheduling`.
- Import prioritized task scheduling without global mutation: `@serve-tools/ponyfill-prioritized-task-scheduling`.
- Install a native-preserving `reportError` global: `@serve-tools/polyfill-report-error`.
- Import native-aware error reporting without global mutation: `@serve-tools/polyfill-report-error/reportError`.
- Selectively install a missing `reportError` global: `@serve-tools/polyfill-report-error/apply/reportError`.
- Import console-backed error reporting without global mutation: `@serve-tools/ponyfill-report-error`.
- Install explicit-resource-management globals: `@serve-tools/polyfill-resource-management`.
- Import resource-management classes without global mutation: `@serve-tools/ponyfill-resource-management`.
- Install a native-preserving `URLPattern` global: `@serve-tools/polyfill-urlpattern`.
- Install missing Observable globals and `EventTarget.prototype.when`: `@serve-tools/polyfill-observable`; the fallback has independent cold executions and is not a complete native implementation.
- Install a missing experimental `Composite` global: `@serve-tools/polyfill-composites`; fallback identity remains module-local and does not gain native weak-collection restrictions.
- Import `URLPattern` without global mutation: `@serve-tools/ponyfill-urlpattern`.
- Detect and inject browser polyfills during Vite builds: `@serve-tools/vite-polyfills`.

`@serve-tools/lit-signals` re-exports its compatible `Signal` runtime.
Select `@serve-tools/signal` separately only when application code imports it directly.

## Selection rules

- Choose `@serve-tools/async-operation` for runtime-neutral owned work; keep transport framing, reconciliation, persistence, and reactive state in their owning layers.
- Choose `@serve-tools/http-contract` for request/response JSON APIs and the existing HTTP-stream packages for binary operations or streaming subscriptions.
- Choose `@serve-tools/router` for shared route declarations and `@serve-tools/client-router` when the browser owns navigation and rendering.
- Choose a `client-*` package when imperative state or transport APIs are sufficient.
- Pair a realtime client with its matching server only when the task explicitly implements both network sides; a client-only or server-only task needs only its owning package.
- A custom server adapter uses only `@serve-tools/server-realtime`; never add `@serve-tools/client-realtime` unless the task also implements a client.
- A SharedWorker package's `serve` API owns worker coordination, not an HTTP, EventSource, WebSocket, or WebTransport server.
- Do not add protocol, effect, primitive, or transport dependencies when the selected package already owns the requested behavior.
- Choose the `client-realtime` or `server-realtime` core only when building another transport adapter.
- Choose `@serve-tools/realtime-protocol` directly only for transport integration or protocol infrastructure.
- Choose a capability-complete `signal-*` counterpart instead when consumers need reactive reads alongside the same client operations.
- Choose `@serve-tools/signals` when one module intentionally uses several core Signal capabilities together; otherwise use the focused owning package.
- Choose a ponyfill when the fallback implementation itself is required, a non-apply polyfill export for native-first selection, and an apply entrypoint for global compatibility.
- Choose the decorator metadata polyfill when emitted decorator code reads `Symbol.metadata`; choose its ponyfill only when every producer and consumer explicitly imports the same symbol.
- Choose `@serve-tools/rolldown-decorators` for decorator syntax and runtime semantics; the metadata polyfill supplies only the global symbol key.
- Choose `@serve-tools/vite-polyfills` when support should be derived and injected by the build rather than selected in application code.
