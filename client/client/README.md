# @serve-tools/client

Use several browser tools through one package: typed storage, keyboard shortcuts, context, databases, messaging, routing, and realtime clients.
Each namespace keeps the same implementation and types as its focused package.

Choose a [focused package](#included-packages) when you need one capability.
Choose `@serve-tools/client` when your application combines several and you prefer one dependency with grouped imports.
This is a convenience facade; it does not add another client runtime.

## Try it: save a theme with a keyboard shortcut

Press Command+J on macOS or Control+J elsewhere to toggle a saved theme.
The initial value is restored from local storage, and changes from another same-origin tab update this page too.

```ts
import { keyboard, storage } from "@serve-tools/client";

const preferences = new storage.Storage<{ theme: "light" | "dark" }>();
const controller = new AbortController();
const renderTheme = () => {
	document.documentElement.dataset.theme = preferences.get("theme") ?? "light";
};

renderTheme();
preferences.subscribe("theme", renderTheme, { signal: controller.signal });
window.addEventListener("keydown", (event) => {
	if (!keyboard.matchKeyChord("Mod+J", event)) return;
	event.preventDefault();
	preferences.set("theme", preferences.get("theme") === "dark" ? "light" : "dark");
}, { signal: controller.signal });

export const disposeThemeShortcut = () => controller.abort();

window.addEventListener("pagehide", (event) => {
	if (event.persisted) return;
	disposeThemeShortcut();
}, { signal: controller.signal });
```

Style `[data-theme="dark"]` in your application CSS.
Call `disposeThemeShortcut()` when this feature is retired to remove its listeners and storage subscription.
The pagehide handler preserves them when the browser suspends this page in its back/forward cache.
Browser storage can throw security or quota errors; see the [storage documentation](../storage/) for its full contract.

The same operations are available as focused imports after installing this facade:

```ts
import { matchKeyChord } from "@serve-tools/client/keyboard";
import { Storage } from "@serve-tools/client/storage";
```

## Install

```shell
npm install @serve-tools/client
```

#### Import from a CDN

```js
import * as client from "https://esm.run/@serve-tools/client";
```

## Included packages

| Namespace            | Focused subpath                           | Underlying package                                                   |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `context`            | `@serve-tools/client/context`             | [`@serve-tools/client-context`](../context/)                         |
| `db`                 | `@serve-tools/client/db`                  | [`@serve-tools/client-db`](../db/)                                   |
| `eventSource`        | `@serve-tools/client/event-source`        | [`@serve-tools/client-event-source`](../event-source/)               |
| `httpStream`         | `@serve-tools/client/http-stream`         | [`@serve-tools/client-http-stream`](../http-stream/)                 |
| `input`              | `@serve-tools/client/input`               | [`@serve-tools/client-input`](../input/)                             |
| `interaction`        | `@serve-tools/client/interaction`         | [`@serve-tools/client-interaction`](../interaction/)                 |
| `keyboard`           | `@serve-tools/client/keyboard`            | [`@serve-tools/client-keyboard`](../keyboard/)                       |
| `messaging`          | `@serve-tools/client/messaging`           | [`@serve-tools/client-messaging`](../messaging/)                     |
| `router`             | `@serve-tools/client/router`              | [`@serve-tools/client-router`](../router/)                           |
| `sharedEventSource`  | `@serve-tools/client/shared-event-source` | [`@serve-tools/client-shared-event-source`](../shared-event-source/) |
| `sharedWebsocket`    | `@serve-tools/client/shared-websocket`    | [`@serve-tools/client-shared-websocket`](../shared-websocket/)       |
| `sharedHttpStream`   | `@serve-tools/client/shared-http-stream`  | [`@serve-tools/client-shared-http-stream`](../shared-http-stream/)   |
| `sharedWebtransport` | `@serve-tools/client/shared-webtransport` | [`@serve-tools/client-shared-webtransport`](../shared-webtransport/) |
| `storage`            | `@serve-tools/client/storage`             | [`@serve-tools/client-storage`](../storage/)                         |
| `websocket`          | `@serve-tools/client/websocket`           | [`@serve-tools/client-websocket`](../websocket/)                     |
| `webtransport`       | `@serve-tools/client/webtransport`        | [`@serve-tools/client-webtransport`](../webtransport/)               |

The facade also includes [`@serve-tools/client-shared-db`](../shared-db/) through `@serve-tools/client/db/scope/window` and `@serve-tools/client/db/scope/shared-worker`.
It shares the `db` family rather than adding a `sharedDb` namespace.
The other client-category packages, [`@serve-tools/client-dom-fragment`](../dom-fragment/) and [`@serve-tools/client-realtime`](../realtime/), are separate dependencies and are not included.

The root entrypoint exports namespaces rather than flattening their members, so similarly named operations retain their owning capability.
Use a focused subpath when only one capability is needed.

`router` provides typed route declarations, native Navigation API commitment and completion, installed route arrays, and automatic View Transitions.
Import the focused `@serve-tools/client/router` subpath when routing is the only required browser capability.

In version 0.4, both router import shapes re-export `@serve-tools/client-router` 0.2 and `@serve-tools/router` 0.2.
Successful matches include the declared `path` discriminator, native reloads remain browser-owned, and `shouldIntercept(...)` can decline same-document interception for application-scope changes.
Router 0.2's stricter route and `href()` validation, codec metadata, and frozen option snapshots apply through both import shapes.
Update code that constructs match fixtures or mutates route options as described by the focused router package documentation.

`eventSource` provides typed JSON named events over the native EventSource API, including each event's `lastEventId`.
Use `sharedEventSource` when one SharedWorker should own the physical EventSource and its native reconnection lifecycle for several pages.

Input and interaction utilities retain their owning package's focused entrypoints:

```ts
import { observeDropTarget } from "@serve-tools/client/input/drop";
import { observePointer } from "@serve-tools/client/input/pointer";
import { writeToClipboard } from "@serve-tools/client/interaction/clipboard";
import { openEyeDropper } from "@serve-tools/client/interaction/eyedropper";
import { openFiles } from "@serve-tools/client/interaction/file-picker";
import { share } from "@serve-tools/client/interaction/share";
```

The `input` and `interaction` root namespaces and focused capability subpaths provide the same implementations.

Direct IndexedDB and SharedWorker-coordinated IndexedDB form one database entrypoint family:

```ts
import { DB } from "@serve-tools/client/db";
import { connect } from "@serve-tools/client/db/scope/window";
import { listen } from "@serve-tools/client/db/scope/shared-worker";
```

The root `db` namespace and focused `db` subpath provide direct, in-context IndexedDB operations.
The scoped entrypoints provide the narrower remote client and SharedWorker server APIs, including their shared database types.
They do not add transactions or scans across the message boundary.

Direct messaging and its worker-scope conveniences form one messaging entrypoint family:

```ts
import { connect, serve } from "@serve-tools/client/messaging";
import { SharedWorker } from "@serve-tools/client/messaging/scope/window";
import { listen } from "@serve-tools/client/messaging/scope/worker";
```

The window scope adds a typed `SharedWorker` convenience class and `connect` helper.
The worker scope adds `listen` for dedicated and shared worker globals.
Both scopes also re-export the messaging protocol types and transfer helper.
Messaging uses the generic `Protocol`, `Client`, `Server`, `Listener`, `Handlers`, and `ProtocolType` names, together with the generic option, context, subscription, endpoint, and transfer types.
The same types are available through the `messaging` aggregate namespace and focused re-exports, with operation-specific aliases under the `connect`, `serve`, and `listen` namespaces.

Messaging and WebSocket protocols share one callable declaration shape.
Declare each named request or subscription as a TypeScript method accepting zero parameters or one input value; a request return type is its response, while a subscription return type is each delivered event.
Either `requests` or `subscriptions` may be omitted.
These declarations and their resource brands exist only at compile time, and this harmonization did not change either transport's wire protocol.

`messaging.ProtocolType` extracts a retained inline protocol from branded messaging clients, servers, and listeners, including promise-wrapped resources.
The corresponding `connect.ProtocolType`, `serve.ProtocolType`, and `listen.ProtocolType` aliases are available where those operations are re-exported.

Typed WebSocket requests and subscriptions are available through the `websocket` namespace or focused subpath:

```ts
import { websocket } from "@serve-tools/client";

const pendingClient = websocket.connect<{
	requests: {
		status(): Status;
	};
}>(url);

export type PendingStatusProtocol = websocket.ProtocolType<typeof pendingClient>;
export type StatusProtocol = websocket.connect.ProtocolType<Awaited<typeof pendingClient>>;
```

WebSocket `ProtocolType` accepts both pending and resolved clients through either the top-level type or `connect.ProtocolType` alias.
The focused `@serve-tools/client/websocket` re-export exposes the same contract.

The matching `httpStream`, `sharedHttpStream`, `webtransport`, and `sharedWebtransport` namespaces retain the same callable request and subscription declaration shape.
Use HTTP streaming for separate binary Fetch exchanges, WebSocket for a widely supported bidirectional session, and WebTransport when the application also needs typed best-effort datagrams.

Use a `SharedWorker` when several browser windows should share one physical WebSocket.
Import the window client from `@serve-tools/client` and the worker server from its owning package:

```ts
// presence.worker.ts
import { listen } from "@serve-tools/client-shared-websocket/scope/shared-worker";

export interface AppProtocol {
	subscriptions: {
		presence(room: string): { online: number };
	};
}

export const server = listen<AppProtocol>("wss://example.com/presence");
```

```ts
// presence.ts
import { connect } from "@serve-tools/client/shared-websocket";
import type { AppProtocol } from "./presence.worker.js";

const worker = new SharedWorker(new URL("./presence.worker.js", import.meta.url), {
	name: "presence",
	type: "module",
});

const client = connect<AppProtocol>(worker.port);
```

The window client retains the direct WebSocket request and subscription shape, while closing it leaves the worker's physical socket available to other pages.
Declare `@serve-tools/client-shared-websocket` as a direct dependency when importing its worker entrypoint.

## Compatibility

This package is an ES module for the browser environments supported by its underlying client packages.
Importing the root entrypoint evaluates every namespace; focused subpaths evaluate only the selected capability and its dependencies.
Installing the facade still installs all of its declared dependencies; choose a focused owning package to narrow installation as well.
The facade makes no promise that a root import produces a smaller application bundle.

## Agent Skill

This package includes `skills/serve-tools-client/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm test --workspace @serve-tools/client
```

## License

[MIT-0](./LICENSE.md)
