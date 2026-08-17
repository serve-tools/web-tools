# @serve-tools/client

The `@serve-tools/client` package provides namespaced access to the Serve Tools client libraries without flattening unrelated APIs into one export surface.

```ts
import { context, keyboard } from "@serve-tools/client";

const themeContext = context.createContext<"light" | "dark">(Symbol("theme"));
const saveChord = keyboard.getKeyChordLabel("Mod+S");
```

Each namespace is also available as a focused subpath:

```ts
import { createContext } from "@serve-tools/client/context";
import { getKeyChordLabel } from "@serve-tools/client/keyboard";
```

## Install

```shell
npm install @serve-tools/client
```

## Namespaces

| Namespace            | Focused subpath                           | Underlying package                        |
| -------------------- | ----------------------------------------- | ----------------------------------------- |
| `context`            | `@serve-tools/client/context`             | `@serve-tools/client-context`             |
| `db`                 | `@serve-tools/client/db`                  | `@serve-tools/client-db`                  |
| `httpStream`         | `@serve-tools/client/http-stream`         | `@serve-tools/client-http-stream`         |
| `input`              | `@serve-tools/client/input`               | `@serve-tools/client-input`               |
| `interaction`        | `@serve-tools/client/interaction`         | `@serve-tools/client-interaction`         |
| `keyboard`           | `@serve-tools/client/keyboard`            | `@serve-tools/client-keyboard`            |
| `messaging`          | `@serve-tools/client/messaging`           | `@serve-tools/client-messaging`           |
| `sharedWebsocket`    | `@serve-tools/client/shared-websocket`    | `@serve-tools/client-shared-websocket`    |
| `sharedHttpStream`   | `@serve-tools/client/shared-http-stream`  | `@serve-tools/client-shared-http-stream`  |
| `sharedWebtransport` | `@serve-tools/client/shared-webtransport` | `@serve-tools/client-shared-webtransport` |
| `storage`            | `@serve-tools/client/storage`             | `@serve-tools/client-storage`             |
| `websocket`          | `@serve-tools/client/websocket`           | `@serve-tools/client-websocket`           |
| `webtransport`       | `@serve-tools/client/webtransport`        | `@serve-tools/client-webtransport`        |

The root entrypoint exports namespaces rather than flattening their members, so similarly named operations retain their owning capability.
Use a focused subpath when only one capability is needed.

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
Importing the root entrypoint evaluates every namespace; focused subpaths let applications load a single capability directly.

## Agent Skill

This package includes `skills/serve-tools-client/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm test --workspace @serve-tools/client
```

## License

[MIT-0](./LICENSE.md)
