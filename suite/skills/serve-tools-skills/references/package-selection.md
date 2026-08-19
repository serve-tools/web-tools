# Package selection

Select the narrowest package that owns the required behavior.

| Need                                            | Package                                       | Distinguishing behavior                                                |
| ----------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Owned async events plus a terminal result       | `@serve-tools/async-operation`                | Backpressure, cancellation, and asynchronous disposal                  |
| Several browser utilities through namespaces    | `@serve-tools/client`                         | Facade with focused capability subpaths                                |
| DOM context propagation                         | `@serve-tools/client-context`                 | Provider and consumer lifecycle with late-registration replay          |
| Direct IndexedDB operations                     | `@serve-tools/client-db`                      | Promise-based databases, transactions, and scans                       |
| Typed JSON Server-Sent Events                   | `@serve-tools/client-event-source`            | Native EventSource reconnection, named events, and IDs                 |
| Binary HTTP requests and subscriptions          | `@serve-tools/client-http-stream`             | Author headers, abort signals, and framed streaming responses          |
| SharedWorker HTTP requests and subscriptions    | `@serve-tools/client-shared-http-stream`      | Worker-owned authorization and Fetch exchange coordination             |
| Pointer or drag-and-drop sessions               | `@serve-tools/client-input`                   | Explicitly owned input-session lifecycles                              |
| Clipboard, picker, share, or eyedropper actions | `@serve-tools/client-interaction`             | One-shot browser interactions with explicit outcomes                   |
| Keyboard chords and accessible labels           | `@serve-tools/client-keyboard`                | Platform-aware matching, symbols, and ARIA shortcuts                   |
| Worker or port requests and subscriptions       | `@serve-tools/client-messaging`               | Typed finite requests and streaming subscriptions                      |
| Custom realtime client adapter                  | `@serve-tools/client-realtime`                | Sans-I/O client operation state machine                                |
| IndexedDB coordinated through a SharedWorker    | `@serve-tools/client-shared-db`               | Cross-tab operations and change subscriptions                          |
| EventSource shared through a SharedWorker       | `@serve-tools/client-shared-event-source`     | One native EventSource with typed per-page event subscriptions         |
| WebSocket shared through a SharedWorker         | `@serve-tools/client-shared-websocket`        | One physical socket with per-page logical clients                      |
| WebTransport shared through a SharedWorker      | `@serve-tools/client-shared-webtransport`     | One physical session for reliable operations and shared datagrams      |
| Observable local or session storage             | `@serve-tools/client-storage`                 | Storage reads, writes, and watches                                     |
| Binary WebSocket requests and subscriptions     | `@serve-tools/client-websocket`               | Typed structured-data protocol over WebSocket                          |
| Reliable operations plus lossy datagrams        | `@serve-tools/client-webtransport`            | WebTransport streams and typed best-effort datagrams                   |
| Binary HTTP request and stream handlers         | `@serve-tools/server-http-stream`             | WHATWG Fetch handler with HTTP media negotiation                       |
| JSON Server-Sent Event handlers                 | `@serve-tools/server-event-source`            | Fetch handler with IDs, reconnect cursors, retry, and keepalives       |
| Custom realtime server adapter                  | `@serve-tools/server-realtime`                | Sans-I/O handler and operation core                                    |
| WebSocket request and subscription handlers     | `@serve-tools/server-websocket`               | Sans-I/O server core plus runtime adapters                             |
| WebTransport operation and datagram handlers    | `@serve-tools/server-webtransport`            | Runtime-neutral session core plus Node HTTP/3 adapter                  |
| Realtime wire format or reliable stream frames  | `@serve-tools/realtime-protocol`              | Shared serializer, message guards, types, and framing                  |
| Signal-aware DOM templates                      | `@serve-tools/signal-dom`                     | Functional HTML, SVG, and MathML templating                            |
| EventTarget state as Signals                    | `@serve-tools/signal-event-target`            | Events and media queries exposed as read-only Signals                  |
| EventSource client with Signals                 | `@serve-tools/signal-event-source`            | Complete client plus latest JSON event state and event ID              |
| Messaging clients with Signals                  | `@serve-tools/signal-messaging`               | Complete client and scope APIs plus reactive subscription state        |
| Direct IndexedDB queries as Signals             | `@serve-tools/signal-db`                      | Reactive queries invalidated by same-wrapper committed writes          |
| HTTP streaming client with Signals              | `@serve-tools/signal-http-stream`             | Complete client plus latest-state subscription observation             |
| Shared IndexedDB queries as Signals             | `@serve-tools/signal-shared-db`               | Reactive queries over the SharedWorker client                          |
| Shared EventSource client with Signals          | `@serve-tools/signal-shared-event-source`     | Complete shared lifecycle plus page-owned latest event state and ID    |
| Shared HTTP client with Signals                 | `@serve-tools/signal-shared-http-stream`      | Complete shared lifecycle plus page-owned subscription state           |
| WebSocket client with Signals                   | `@serve-tools/signal-websocket`               | Complete client plus latest-state subscription observation             |
| Shared WebSocket client with Signals            | `@serve-tools/signal-shared-websocket`        | Complete shared lifecycle plus page-owned subscription state           |
| WebTransport client with Signals                | `@serve-tools/signal-webtransport`            | Complete client plus reliable state; datagrams remain occurrences      |
| Shared WebTransport client with Signals         | `@serve-tools/signal-shared-webtransport`     | Complete shared lifecycle plus reliable page-owned state               |
| Web Storage values as Signals                   | `@serve-tools/signal-storage`                 | Reactive storage watches                                               |
| Signal-aware Lit components                     | `@serve-tools/lit-signals`                    | Templates, directives, decorators, host styles, and lifecycle tracking |
| Core Signal capabilities together               | `@serve-tools/signals`                        | Flat facade with focused package subpaths                              |
| Signal-aware maps, sets, and weak collections   | `@serve-tools/signal-collections`             | Native collection interfaces with reactive reads                       |
| Batched reactive side effects                   | `@serve-tools/signal-effect`                  | Microtask-batched effects                                              |
| Core Signals primitives                         | `@serve-tools/signal`                         | TC39 Signals proposal implementation                                   |
| Install idle-callback globals                   | `@serve-tools/polyfill-request-idle-callback` | Global mutation                                                        |
| Import idle-callback functions                  | `@serve-tools/ponyfill-request-idle-callback` | No global mutation                                                     |
| Import native-aware error reporting             | `@serve-tools/polyfill-report-error`          | Native function or ponyfill without global mutation                    |
| Install a missing reportError global            | `@serve-tools/polyfill-report-error/apply`    | Preserves native behavior and installs only the ponyfill when missing  |
| Import the console-backed reportError fallback  | `@serve-tools/ponyfill-report-error`          | No native selection or global mutation                                 |
| Install explicit-resource-management globals    | `@serve-tools/polyfill-resource-management`   | Global mutation                                                        |
| Import explicit-resource-management classes     | `@serve-tools/ponyfill-resource-management`   | No global mutation                                                     |
| Inject required polyfills during Vite builds    | `@serve-tools/vite-polyfills`                 | Build-time detection and injection                                     |

`@serve-tools/lit-signals` re-exports its compatible `Signal` runtime.
Select `@serve-tools/signal` separately only when application code imports it directly.

## Selection rules

- Choose `@serve-tools/async-operation` for runtime-neutral owned work; keep transport framing, reconciliation, persistence, and reactive state in their owning layers.
- Choose a `client-*` package when imperative state or transport APIs are sufficient.
- Pair each realtime client with its matching server package.
- Choose the `client-realtime` or `server-realtime` core only when building another transport adapter.
- Choose `@serve-tools/realtime-protocol` directly only for transport integration or protocol infrastructure.
- Choose a capability-complete `signal-*` counterpart instead when consumers need reactive reads alongside the same client operations.
- Choose `@serve-tools/signals` when one module intentionally uses several core Signal capabilities together; otherwise use the focused owning package.
- Choose a ponyfill when the fallback implementation itself is required, a non-apply polyfill export for native-first selection, and an apply entrypoint for global compatibility.
- Choose `@serve-tools/vite-polyfills` when support should be derived and injected by the build rather than selected in application code.
