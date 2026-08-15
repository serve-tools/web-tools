# Package selection

Select the narrowest package that owns the required behavior.

| Need                                            | Package                                       | Distinguishing behavior                                                |
| ----------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Several browser utilities through namespaces    | `@serve-tools/client`                         | Facade with focused capability subpaths                                |
| DOM context propagation                         | `@serve-tools/client-context`                 | Provider and consumer lifecycle with late-registration replay          |
| Direct IndexedDB operations                     | `@serve-tools/client-db`                      | Promise-based databases, transactions, and scans                       |
| Pointer or drag-and-drop sessions               | `@serve-tools/client-input`                   | Explicitly owned input-session lifecycles                              |
| Clipboard, picker, share, or eyedropper actions | `@serve-tools/client-interaction`             | One-shot browser interactions with explicit outcomes                   |
| Keyboard chords and accessible labels           | `@serve-tools/client-keyboard`                | Platform-aware matching, symbols, and ARIA shortcuts                   |
| Worker or port requests and subscriptions       | `@serve-tools/client-messaging`               | Typed finite requests and streaming subscriptions                      |
| IndexedDB coordinated through a SharedWorker    | `@serve-tools/client-shared-db`               | Cross-tab operations and change subscriptions                          |
| Observable local or session storage             | `@serve-tools/client-storage`                 | Storage reads, writes, and watches                                     |
| Binary WebSocket requests and subscriptions     | `@serve-tools/client-websocket`               | Typed structured-data protocol over WebSocket                          |
| Signal-aware DOM templates                      | `@serve-tools/signal-dom`                     | Functional HTML, SVG, and MathML templating                            |
| EventTarget state as Signals                    | `@serve-tools/signal-event-target`            | Events and media queries exposed as read-only Signals                  |
| Messaging subscriptions as Signals              | `@serve-tools/signal-messaging`               | Explicit reactive subscription state                                   |
| Shared IndexedDB queries as Signals             | `@serve-tools/signal-shared-db`               | Reactive queries over the SharedWorker client                          |
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

## Selection rules

- Choose a `client-*` package for imperative state or transport APIs.
- Choose its `signal-*` counterpart only when consumers need reactive reads.
- Choose a ponyfill for explicit imports and a polyfill only when global compatibility is required.
- Choose `@serve-tools/vite-polyfills` when support should be derived and injected by the build rather than selected in application code.
