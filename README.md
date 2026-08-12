# @serve-tools/web-tools

Client libraries, Lit integrations, polyfills, ponyfills, Signal libraries, and Vite plugins maintained under the `@serve-tools` npm scope.

## Workspace layout

- [`client/`](./client/) contains libraries for browser databases, storage, messaging, and other client runtime capabilities.
- [`client-signals/`](./client-signals/) contains signal-aware browser database, storage, and DOM libraries.
- [`lit/`](./lit/) contains Lit integrations.
- [`polyfills/`](./polyfills/) contains polyfills that modify the global environment.
- [`ponyfills/`](./ponyfills/) contains ponyfills imported without global modification.
- [`signals/`](./signals/) contains a Signals implementation and signal-aware libraries.
- [`vite/`](./vite/) contains Vite plugins.

Each publishable project lives in its own immediate subdirectory and owns its package metadata, source, tests, and documentation.

## Packages

- [`@serve-tools/client-db`](./client/db/) provides promise-based IndexedDB operations, transactions, and scans.
- [`@serve-tools/client-messaging`](./client/messaging/) provides requests and subscriptions across workers and message ports.
- [`@serve-tools/client-shared-db`](./client/shared-db/) coordinates IndexedDB operations and change subscriptions through a SharedWorker.
- [`@serve-tools/client-storage`](./client/storage/) provides observable access to local and session storage.
- [`@serve-tools/lit-signals`](./lit/signals/) provides fine-grained Signal directives and signal-backed reactive decorators for Lit elements.
- [`@serve-tools/polyfill-request-idle-callback`](./polyfills/request-idle-callback/) installs the `requestIdleCallback` and `cancelIdleCallback` globals.
- [`@serve-tools/polyfill-resource-management`](./polyfills/resource-management/) installs ECMAScript Explicit Resource Management globals.
- [`@serve-tools/ponyfill-request-idle-callback`](./ponyfills/request-idle-callback/) provides `requestIdleCallback` and `cancelIdleCallback` without global mutation.
- [`@serve-tools/ponyfill-resource-management`](./ponyfills/resource-management/) provides a side-effect-free implementation of ECMAScript Explicit Resource Management.
- [`@serve-tools/signal`](./signals/signal/) implements the TC39 Signals proposal.
- [`@serve-tools/signal-effect`](./signals/effect/) provides microtask-batched effects.
- [`@serve-tools/signal-collections`](./signals/collections/) provides signal-aware native collections.
- [`@serve-tools/signal-messaging`](./client-signals/messaging/) observes typed messaging subscriptions as explicit Signal state.
- [`@serve-tools/signal-shared-db`](./client-signals/shared-db/) adds reactive queries to the shared IndexedDB client.
- [`@serve-tools/signal-storage`](./client-signals/storage/) adds reactive watches to the Web Storage client.
- [`@serve-tools/signal-dom`](./client-signals/dom/) provides functional signal-aware DOM templating.
- [`@serve-tools/vite-polyfills`](./vite/polyfills/) detects and injects polyfills for unsupported JavaScript features in Vite projects.

## Agent Skills

Every published package includes one version-aligned Agent Skill under `skills/serve-tools-<package>/SKILL.md`.
The Skills teach compatible coding agents how to choose APIs, preserve lifecycle and platform semantics, avoid sibling-package confusion, and validate package-specific changes.

Installing an npm package does not automatically trust or activate its Skill.
Use a compatible Agent Skills installer that recognizes package-root `skills/` directories, restrict discovery to direct dependencies, and allowlist the `@serve-tools/*` scope.
Do not mount instructions from arbitrary transitive dependencies.

Within this repository, Codex discovers the repo-only `maintain-serve-tools` Skill from `.agents/skills/`.
It routes maintenance work to the affected package's canonical Skill without publishing maintainer instructions in package tarballs.

## Development

Node.js 22.14 or newer and npm 11.5.1 or newer are required.
CI uses the npm 12.0.2 version pinned by `packageManager`.

```shell
npm ci --ignore-scripts
npm run verify
```

## License

[MIT-0](./LICENSE.md)
