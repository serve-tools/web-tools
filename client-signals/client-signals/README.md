# @serve-tools/client-signals

The `@serve-tools/client-signals` package provides namespaced access to the Serve Tools signal-aware client libraries without flattening unrelated APIs into one export surface.

```ts
import { sharedWebsocket, websocket } from "@serve-tools/client-signals";

const direct = websocket.observe(socket, "updates");
const shared = sharedWebsocket.observe(sharedSocket, "updates");
```

Each namespace is also available as a focused subpath:

```ts
import { observe as observeWebSocket } from "@serve-tools/client-signals/websocket";
import { observe as observeSharedWebSocket } from "@serve-tools/client-signals/shared-websocket";
```

## Install

```shell
npm install @serve-tools/client-signals
```

## Namespaces

| Namespace            | Focused subpath                                   | Underlying package                        |
| -------------------- | ------------------------------------------------- | ----------------------------------------- |
| `dom`                | `@serve-tools/client-signals/dom`                 | `@serve-tools/signal-dom`                 |
| `eventTarget`        | `@serve-tools/client-signals/event-target`        | `@serve-tools/signal-event-target`        |
| `messaging`          | `@serve-tools/client-signals/messaging`           | `@serve-tools/signal-messaging`           |
| `sharedDb`           | `@serve-tools/client-signals/shared-db`           | `@serve-tools/signal-shared-db`           |
| `sharedHttpStream`   | `@serve-tools/client-signals/shared-http-stream`  | `@serve-tools/signal-shared-http-stream`  |
| `sharedWebsocket`    | `@serve-tools/client-signals/shared-websocket`    | `@serve-tools/signal-shared-websocket`    |
| `sharedWebtransport` | `@serve-tools/client-signals/shared-webtransport` | `@serve-tools/signal-shared-webtransport` |
| `storage`            | `@serve-tools/client-signals/storage`             | `@serve-tools/signal-storage`             |
| `websocket`          | `@serve-tools/client-signals/websocket`           | `@serve-tools/signal-websocket`           |
| `webtransport`       | `@serve-tools/client-signals/webtransport`        | `@serve-tools/signal-webtransport`        |

The root entrypoint exports namespaces rather than flattening their members, so similarly named operations retain their owning capability.
Use a focused subpath when only one adapter is needed.
The namespace and focused-subpath exports are direct re-exports of the underlying packages and add no wrapper runtime.

Signal-aware messaging and direct or shared realtime transports expose an `observe()` operation for subscription state.
Their client types, transport ownership, and lifecycle rules remain distinct, so select the adapter that matches the client being observed.

```ts
import type { Client } from "@serve-tools/client-websocket";
import type { SharedWebSocketClient } from "@serve-tools/client-shared-websocket/scope/window";
import { sharedWebsocket, websocket } from "@serve-tools/client-signals";

declare const socket: Client<{ subscriptions: { updates(): string } }>;
declare const sharedSocket: SharedWebSocketClient<{ subscriptions: { updates(): string } }>;

using directUpdates = websocket.observe(socket, "updates");
using sharedUpdates = sharedWebsocket.observe(sharedSocket, "updates");
```

Follow the selected focused package's README for state semantics, cancellation, ownership, disposal, and compatibility requirements.

## Compatibility

This package is an ES module for the browser environments supported by its underlying signal-aware client packages.
Importing the root entrypoint evaluates every namespace; focused subpaths let applications load a single capability directly.
Each underlying package may require additional browser APIs such as DOM events, storage, IndexedDB, workers, or WebSocket.

## Agent Skill

This package includes `skills/serve-tools-client-signals/SKILL.md` with version-aligned guidance for choosing root namespaces or focused imports.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm test --workspace @serve-tools/client-signals
```

The namespace and focused-import shapes are compile-checked by [`test/client-signals.recipes.ts`](./test/client-signals.recipes.ts).

## License

[MIT-0](./LICENSE.md)
| `db` | `@serve-tools/client-signals/db` | `@serve-tools/signal-db` |
| `httpStream` | `@serve-tools/client-signals/http-stream` | `@serve-tools/signal-http-stream` |
