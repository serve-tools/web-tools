# @serve-tools/client-signals

Combine browser clients with reactive DOM through one package.
Its namespaces include typed storage, databases, messaging, and realtime clients, with Signal reads that update their consumers automatically.

Choose a [focused package](#included-packages) when you need one capability.
Choose this facade when an application combines several Signal-aware clients and you prefer grouped imports.
Each client keeps its original operations, types, and runtime identity alongside its reactive additions.

## Try it: show a saved preference without wiring change handlers

This paragraph displays the saved theme.
Writes through the storage wrapper and storage events from other same-origin tabs update its text automatically.

```ts
import { dom, storage } from "@serve-tools/client-signals";
import { Signal } from "@serve-tools/signal";

const preferences = new storage.SignalStorage<{ theme: "light" | "dark" }>();
const theme = preferences.watch("theme");
const label = new Signal.Computed(() => `Theme: ${theme.get() ?? "light"}`);
const paragraph = dom.html("p", dom.text(label))(document.body);

preferences.set("theme", "dark"); // Saves the preference and updates the paragraph.

const onPageHide = (event: PageTransitionEvent) => {
	if (event.persisted) return;
	disposeThemeDisplay();
};
window.addEventListener("pagehide", onPageHide);

export function disposeThemeDisplay() {
	window.removeEventListener("pagehide", onPageHide);
	dom.dispose(paragraph);
	paragraph.remove();
	theme.dispose();
}
```

An unset preference displays `Theme: light`; the computed label supplies a default for the absent storage key.
Call `disposeThemeDisplay()` when the feature is retired: DOM binding disposal and storage-watch disposal are separate ownership responsibilities.
The pagehide handler preserves the display when the browser suspends this page in its back/forward cache.
Storage can throw browser security or quota errors.
See [Signal Storage](../storage/) and [Signal DOM](../dom/) for lifecycle and scheduling details.

The same capabilities are available through focused imports after installing this facade:

```ts
import { html, text } from "@serve-tools/client-signals/dom";
import { SignalStorage } from "@serve-tools/client-signals/storage";
```

## Install

```shell
npm install @serve-tools/client-signals @serve-tools/signal
```

The example also imports the core `Signal` runtime directly, so declare `@serve-tools/signal` as an application dependency.
The facade itself includes its Signal-aware clients; you do not need to add their underlying imperative packages.

#### Import from a CDN

```js
import * as clientSignals from "https://esm.run/@serve-tools/client-signals";
```

## Included packages

| Namespace            | Focused subpath                                   | Underlying package                                                   |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| `db`                 | `@serve-tools/client-signals/db`                  | [`@serve-tools/signal-db`](../db/)                                   |
| `dom`                | `@serve-tools/client-signals/dom`                 | [`@serve-tools/signal-dom`](../dom/)                                 |
| `eventTarget`        | `@serve-tools/client-signals/event-target`        | [`@serve-tools/signal-event-target`](../event-target/)               |
| `eventSource`        | `@serve-tools/client-signals/event-source`        | [`@serve-tools/signal-event-source`](../event-source/)               |
| `httpStream`         | `@serve-tools/client-signals/http-stream`         | [`@serve-tools/signal-http-stream`](../http-stream/)                 |
| `messaging`          | `@serve-tools/client-signals/messaging`           | [`@serve-tools/signal-messaging`](../messaging/)                     |
| `sharedDb`           | `@serve-tools/client-signals/shared-db`           | [`@serve-tools/signal-shared-db`](../shared-db/)                     |
| `sharedEventSource`  | `@serve-tools/client-signals/shared-event-source` | [`@serve-tools/signal-shared-event-source`](../shared-event-source/) |
| `sharedHttpStream`   | `@serve-tools/client-signals/shared-http-stream`  | [`@serve-tools/signal-shared-http-stream`](../shared-http-stream/)   |
| `sharedWebsocket`    | `@serve-tools/client-signals/shared-websocket`    | [`@serve-tools/signal-shared-websocket`](../shared-websocket/)       |
| `sharedWebtransport` | `@serve-tools/client-signals/shared-webtransport` | [`@serve-tools/signal-shared-webtransport`](../shared-webtransport/) |
| `storage`            | `@serve-tools/client-signals/storage`             | [`@serve-tools/signal-storage`](../storage/)                         |
| `websocket`          | `@serve-tools/client-signals/websocket`           | [`@serve-tools/signal-websocket`](../websocket/)                     |
| `webtransport`       | `@serve-tools/client-signals/webtransport`        | [`@serve-tools/signal-webtransport`](../webtransport/)               |

All fourteen packages in the table are included.
The core Signal primitives, collections, and effects facade is a separate package: [`@serve-tools/signals`](../../signals/signals/).

The root entrypoint exports namespaces rather than flattening their members, so similarly named operations retain their owning capability.
Use a focused subpath when only one adapter is needed.
Each realtime namespace and focused subpath combines the complete underlying client surface with its Signal-specific `observe()` API.
Client operations are direct re-exports and retain their original runtime identity.
The `dom` namespace and focused `dom` subpath include `createBindingScope()` for layouts that suspend observation on removal and reconcile the same nodes on reconnection.
Follow Signal DOM's synchronous capture and explicit resume, suspend, and terminal disposal contract.
Tagged descriptions are available separately from `@serve-tools/signal-dom/template`: use `html` and instantiate with `createFragment(result, owner)` inside the same binding scope.
The umbrella's `dom.html` remains the functional element builder; the template subpath is not flattened into this namespace.

```ts
import { connect, observe } from "@serve-tools/client-signals/event-source";

type Events = { presence: { online: number } };

const client = connect<Events>("/events");
const presence = observe(client, "presence");
```

Messaging and shared transports preserve their environment-specific entrypoints:

```ts
import { listen } from "@serve-tools/client-signals/shared-websocket/scope/shared-worker";
import { connect, observe } from "@serve-tools/client-signals/shared-websocket/scope/window";
```

Signal-aware messaging and direct or shared realtime transports expose an `observe()` operation for subscription state.
Their client types, transport ownership, and lifecycle rules remain distinct, so select the adapter that matches the client being observed.
EventSource observations retain the complete latest event record, including `lastEventId`, alongside parsed JSON data.

```ts
import { sharedWebsocket, websocket } from "@serve-tools/client-signals";

declare const socket: websocket.Client<{ subscriptions: { updates(): string } }>;
declare const sharedSocket: sharedWebsocket.SharedWebSocketClient<{ subscriptions: { updates(): string } }>;

using directUpdates = websocket.observe(socket, "updates");
using sharedUpdates = sharedWebsocket.observe(sharedSocket, "updates");
```

Follow the selected focused package's README for state semantics, cancellation, ownership, disposal, and compatibility requirements.

## Compatibility

This package is an ES module for the browser environments supported by its underlying signal-aware client packages.
Importing the root entrypoint evaluates every namespace; focused subpaths evaluate only the selected capability and its dependencies.
Installing the facade still installs all fourteen declared capability dependencies; choose a focused owning package to narrow installation as well.
The facade makes no promise that a root import produces a smaller application bundle.
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
