# @serve-tools/web-tools

Core, client and server libraries, realtime protocols, Lit integrations, polyfills, ponyfills, Signal libraries, and Vite plugins maintained under the `@serve-tools` npm scope.

## Workspace layout

- [`client/`](./client/) contains libraries for browser databases, storage, messaging, and other client runtime capabilities.
- [`client-signals/`](./client-signals/) contains signal-aware browser database, storage, and DOM libraries.
- [`core/`](./core/) contains general runtime-neutral APIs.
- [`lit/`](./lit/) contains Lit integrations.
- [`polyfills/`](./polyfills/) contains polyfills that modify the global environment.
- [`ponyfills/`](./ponyfills/) contains ponyfills imported without global modification.
- [`server/`](./server/) contains server runtime libraries and adapters.
- [`signals/`](./signals/) contains a Signals implementation and signal-aware libraries.
- [`suite/`](./suite/) contains the published package-selection Skill for the full suite.
- [`vite/`](./vite/) contains Vite plugins.
- [`realtime/`](./realtime/) contains transport-neutral realtime protocol infrastructure shared by clients and servers.

Each package directory owns its package metadata, source, tests, and documentation.

## Demos

Interactive demos for the client, signal-aware client, and Lit packages are published at [serve-tools.github.io/web-tools](https://serve-tools.github.io/web-tools/).
The `Pages` workflow rebuilds and deploys them after every push to `main`.

Build the same static site locally with:

```shell
npm run build:pages
```

The generated site is written to `dist/pages`.
To activate a new repository deployment, select **GitHub Actions** as the source under **Settings → Pages** once; subsequent pushes deploy automatically.

## Packages

- [`@serve-tools/async-operation`](./core/async-operation/) provides owned asynchronous work with typed events, terminal results, cancellation, backpressure, and disposal.
- [`@serve-tools/client`](./client/client/) provides namespace-oriented access to the client libraries and focused capability subpaths.
- [`@serve-tools/client-context`](./client/context/) provides interoperable context events, lifecycle-owned providers and consumers, and indexed late-registration replay.
- [`@serve-tools/client-db`](./client/db/) provides promise-based IndexedDB operations, transactions, and scans.
- [`@serve-tools/client-input`](./client/input/) observes pointer and drag-and-drop input sessions with explicit lifecycle ownership.
- [`@serve-tools/client-interaction`](./client/interaction/) provides one-shot clipboard, picker, sharing, and eyedropper interactions with explicit outcomes.
- [`@serve-tools/client-keyboard`](./client/keyboard/) provides platform-aware keyboard chords, labels, symbols, and ARIA shortcuts.
- [`@serve-tools/client-messaging`](./client/messaging/) provides requests and subscriptions across workers and message ports.
- [`@serve-tools/client-realtime`](./client/realtime/) provides the sans-I/O operation core for custom client transports.
- [`@serve-tools/client-http-stream`](./client/http-stream/) provides typed binary HTTP requests and streaming subscriptions with author headers.
- [`@serve-tools/client-shared-db`](./client/shared-db/) coordinates IndexedDB operations and change subscriptions through a SharedWorker.
- [`@serve-tools/client-shared-http-stream`](./client/shared-http-stream/) coordinates typed HTTP requests and streaming subscriptions through a SharedWorker.
- [`@serve-tools/client-shared-websocket`](./client/shared-websocket/) shares one typed WebSocket across browser windows through a SharedWorker.
- [`@serve-tools/client-shared-webtransport`](./client/shared-webtransport/) shares typed WebTransport operations and datagrams through a SharedWorker.
- [`@serve-tools/client-storage`](./client/storage/) provides observable access to local and session storage.
- [`@serve-tools/client-websocket`](./client/websocket/) provides typed requests and subscriptions over binary structured-data WebSockets.
- [`@serve-tools/client-webtransport`](./client/webtransport/) combines reliable typed operations with typed best-effort WebTransport datagrams.
- [`@serve-tools/realtime-protocol`](./realtime/protocol/) provides the shared binary serializer, wire messages, guards, types, and reliable-stream framing.
- [`@serve-tools/server-realtime`](./server/realtime/) provides the sans-I/O operation server for custom transport adapters.
- [`@serve-tools/server-http-stream`](./server/http-stream/) provides typed WHATWG Fetch handlers for binary requests and streaming subscriptions.
- [`@serve-tools/server-websocket`](./server/websocket/) serves typed requests and subscriptions through a sans-I/O core and Node.js, Deno, Bun, or crossws adapters.
- [`@serve-tools/server-webtransport`](./server/webtransport/) serves reliable typed operations and typed best-effort datagrams over WebTransport.
- [`@serve-tools/signal-dom`](./client-signals/dom/) provides functional signal-aware DOM, SVG, and MathML templating.
- [`@serve-tools/signal-event-target`](./client-signals/event-target/) observes EventTarget state and media-query matches as read-only Signals.
- [`@serve-tools/signal-messaging`](./client-signals/messaging/) observes typed messaging subscriptions as explicit Signal state.
- [`@serve-tools/signal-db`](./client-signals/db/) adds reactive queries to one typed IndexedDB connection.
- [`@serve-tools/signal-http-stream`](./client-signals/http-stream/) observes HTTP streaming subscriptions as explicit Signal state.
- [`@serve-tools/signal-shared-db`](./client-signals/shared-db/) adds reactive queries to the shared IndexedDB client.
- [`@serve-tools/signal-shared-http-stream`](./client-signals/shared-http-stream/) observes shared HTTP streaming subscriptions as explicit Signal state.
- [`@serve-tools/signal-websocket`](./client-signals/websocket/) observes typed WebSocket subscriptions as explicit Signal state.
- [`@serve-tools/signal-shared-websocket`](./client-signals/shared-websocket/) observes shared WebSocket subscriptions as explicit Signal state.
- [`@serve-tools/signal-webtransport`](./client-signals/webtransport/) observes reliable WebTransport subscriptions as explicit Signal state.
- [`@serve-tools/signal-shared-webtransport`](./client-signals/shared-webtransport/) observes shared reliable WebTransport subscriptions as explicit Signal state.
- [`@serve-tools/client-signals`](./client-signals/client-signals/) provides namespace-oriented access to signal-aware client libraries.
- [`@serve-tools/signal-storage`](./client-signals/storage/) adds reactive watches to the Web Storage client.
- [`@serve-tools/lit-signals`](./lit/signals/) provides signal-native Lit templates, reactive host styles, lifecycle tracking, directives, and decorators.
- [`@serve-tools/polyfill-request-idle-callback`](./polyfills/request-idle-callback/) installs the `requestIdleCallback` and `cancelIdleCallback` globals.
- [`@serve-tools/polyfill-resource-management`](./polyfills/resource-management/) installs ECMAScript Explicit Resource Management globals.
- [`@serve-tools/ponyfill-request-idle-callback`](./ponyfills/request-idle-callback/) provides `requestIdleCallback` and `cancelIdleCallback` without global mutation.
- [`@serve-tools/ponyfill-resource-management`](./ponyfills/resource-management/) provides a side-effect-free implementation of ECMAScript Explicit Resource Management.
- [`@serve-tools/signal-collections`](./signals/collections/) provides signal-aware native collections.
- [`@serve-tools/signal-effect`](./signals/effect/) provides microtask-batched effects.
- [`@serve-tools/signal`](./signals/signal/) implements the TC39 Signals proposal.
- [`@serve-tools/signals`](./signals/signals/) provides flat access to the compatible Signal runtime, collections, and effects.
- [`@serve-tools/skills`](./suite/) provides package-selection guidance for the complete suite without runtime JavaScript.
- [`@serve-tools/vite-polyfills`](./vite/polyfills/) detects and injects polyfills for unsupported JavaScript features in Vite projects.

## Agent Skills

Every published package includes one version-aligned Agent Skill under `skills/serve-tools-<unscoped-package-name>/`.
Each compact `SKILL.md` routes agents to focused references with API contracts and compile-checked recipes.
The separate `@serve-tools/skills` package provides suite-wide package selection without adding runtime JavaScript.

Installing an npm package does not automatically trust or activate its Skill.
Use a compatible Agent Skills installer or project sync script that copies the complete Skill directory, including `references/` and `agents/`.
Restrict discovery to direct dependencies and allowlist the `@serve-tools/*` scope.
Do not mount instructions from arbitrary transitive dependencies.

Within this repository, Codex discovers the repo-only `maintain-serve-tools` Skill from `.agents/skills/`.
It routes maintenance work to the affected package's canonical Skill without publishing maintainer instructions in package tarballs.

The repository also includes a paired [package Skill evaluation benchmark](./benchmark/skills/) covering package selection, cross-package composition, focused reference retrieval, public API use, and generated TypeScript compilation.
Run `npm run check:skill-bench` for its offline self-test or `npm run benchmark:skills -- --help` to configure repeated live model comparisons.

## Development

Node.js 22.14 or newer and npm 11.5.1 or newer are required.
CI uses the npm 12.0.2 version pinned by `packageManager`.

```shell
npm ci --ignore-scripts
npm run verify
```

`npm run build` uses the root TypeScript project graph for an incremental build, then checks and bundles the demos.
Use `npm run build:fresh` to remove the configured TypeScript and demo outputs before running the same build.
Run `npm run sync:tsconfig-references` after changing workspace dependencies or TypeScript build configurations.
`npm test` builds that graph once, then runs the consolidated Node and browser test projects.
Package-level test scripts remain available for focused validation.

## License

[MIT-0](./LICENSE.md)
