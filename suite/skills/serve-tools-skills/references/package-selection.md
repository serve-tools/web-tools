# Package selection

Select the narrowest package that owns the required behavior.

| Need                                            | Package                                       | Distinguishing behavior                                                |
| ----------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Several browser utilities through namespaces    | `@serve-tools/client`                         | Facade with focused capability subpaths                                |
| DOM context propagation                         | `@serve-tools/client-context`                 | Provider and consumer lifecycle with late-registration replay          |
| Direct IndexedDB operations                     | `@serve-tools/client-db`                      | Promise-based databases, transactions, and scans                       |
| Binary HTTP requests and subscriptions          | `@serve-tools/client-http-stream`             | Author headers, abort signals, and framed streaming responses          |
| SharedWorker HTTP requests and subscriptions    | `@serve-tools/client-shared-http-stream`      | Worker-owned authorization and Fetch exchange coordination             |
| Pointer or drag-and-drop sessions               | `@serve-tools/client-input`                   | Explicitly owned input-session lifecycles                              |
| Clipboard, picker, share, or eyedropper actions | `@serve-tools/client-interaction`             | One-shot browser interactions with explicit outcomes                   |
| Keyboard chords and accessible labels           | `@serve-tools/client-keyboard`                | Platform-aware matching, symbols, and ARIA shortcuts                   |
| Worker or port requests and subscriptions       | `@serve-tools/client-messaging`               | Typed finite requests and streaming subscriptions                      |
| Custom realtime client adapter                  | `@serve-tools/client-realtime`                | Sans-I/O client operation state machine                                |
| IndexedDB coordinated through a SharedWorker    | `@serve-tools/client-shared-db`               | Cross-tab operations and change subscriptions                          |
| WebSocket shared through a SharedWorker         | `@serve-tools/client-shared-websocket`        | One physical socket with per-page logical clients                      |
| WebTransport shared through a SharedWorker      | `@serve-tools/client-shared-webtransport`     | One physical session for reliable operations and shared datagrams      |
| Observable local or session storage             | `@serve-tools/client-storage`                 | Storage reads, writes, and watches                                     |
| Binary WebSocket requests and subscriptions     | `@serve-tools/client-websocket`               | Typed structured-data protocol over WebSocket                          |
| Reliable operations plus lossy datagrams        | `@serve-tools/client-webtransport`            | WebTransport streams and typed best-effort datagrams                   |
| Binary HTTP request and stream handlers         | `@serve-tools/server-http-stream`             | WHATWG Fetch handler with HTTP media negotiation                       |
| Custom realtime server adapter                  | `@serve-tools/server-realtime`                | Sans-I/O handler and operation core                                    |
| WebSocket request and subscription handlers     | `@serve-tools/server-websocket`               | Sans-I/O server core plus runtime adapters                             |
| WebTransport operation and datagram handlers    | `@serve-tools/server-webtransport`            | Runtime-neutral session core plus Node HTTP/3 adapter                  |
| Realtime wire format or reliable stream frames  | `@serve-tools/realtime-protocol`              | Shared serializer, message guards, types, and framing                  |
| Signal-aware DOM templates                      | `@serve-tools/signal-dom`                     | Functional HTML, SVG, and MathML templating                            |
| EventTarget state as Signals                    | `@serve-tools/signal-event-target`            | Events and media queries exposed as read-only Signals                  |
| Messaging subscriptions as Signals              | `@serve-tools/signal-messaging`               | Explicit reactive subscription state                                   |
| Direct IndexedDB queries as Signals             | `@serve-tools/signal-db`                      | Reactive queries invalidated by same-wrapper committed writes          |
| HTTP streaming subscriptions as Signals         | `@serve-tools/signal-http-stream`             | Latest-state observation for direct HTTP subscriptions                 |
| Shared IndexedDB queries as Signals             | `@serve-tools/signal-shared-db`               | Reactive queries over the SharedWorker client                          |
| Shared HTTP subscriptions as Signals            | `@serve-tools/signal-shared-http-stream`      | Page-owned state over worker-coordinated HTTP subscriptions            |
| WebSocket subscriptions as Signals              | `@serve-tools/signal-websocket`               | Latest-state observation for direct WebSocket subscriptions            |
| Shared WebSocket subscriptions as Signals       | `@serve-tools/signal-shared-websocket`        | Page-owned state over one worker-owned socket                          |
| WebTransport subscriptions as Signals           | `@serve-tools/signal-webtransport`            | Reliable subscription state; datagrams remain occurrences              |
| Shared WebTransport subscriptions as Signals    | `@serve-tools/signal-shared-webtransport`     | Reliable state over one worker-owned WebTransport session              |
| Web Storage values as Signals                   | `@serve-tools/signal-storage`                 | Reactive storage watches                                               |
| Signal-aware Lit components                     | `@serve-tools/lit-signals`                    | Templates, directives, decorators, host styles, and lifecycle tracking |
| Signal-aware maps, sets, and weak collections   | `@serve-tools/signal-collections`             | Native collection interfaces with reactive reads                       |
| Batched reactive side effects                   | `@serve-tools/signal-effect`                  | Microtask-batched effects                                              |
| Core Signals primitives                         | `@serve-tools/signal`                         | TC39 Signals proposal implementation                                   |
| Install idle-callback globals                   | `@serve-tools/polyfill-request-idle-callback` | Global mutation                                                        |
| Import idle-callback functions                  | `@serve-tools/ponyfill-request-idle-callback` | No global mutation                                                     |
| Install explicit-resource-management globals    | `@serve-tools/polyfill-resource-management`   | Global mutation                                                        |
| Import explicit-resource-management classes     | `@serve-tools/ponyfill-resource-management`   | No global mutation                                                     |
| Inject required polyfills during Vite builds    | `@serve-tools/vite-polyfills`                 | Build-time detection and injection                                     |

`@serve-tools/lit-signals` re-exports its compatible `Signal` runtime.
Select `@serve-tools/signal` separately only when application code imports it directly.

## Selection rules

- Choose a `client-*` package for imperative state or transport APIs.
- Pair each realtime client with its matching server package.
- Choose the `client-realtime` or `server-realtime` core only when building another transport adapter.
- Choose `@serve-tools/realtime-protocol` directly only for transport integration or protocol infrastructure.
- Choose its `signal-*` counterpart only when consumers need reactive reads.
- Choose a ponyfill for explicit imports and a polyfill only when global compatibility is required.
- Choose `@serve-tools/vite-polyfills` when support should be derived and injected by the build rather than selected in application code.
