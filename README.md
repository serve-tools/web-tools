# @serve-tools/web-tools

Client libraries, polyfills, ponyfills, and Vite plugins maintained under the
`@serve-tools` npm scope.

## Workspace layout

- [`client/`](./client/) contains libraries for browser databases, storage,
  messaging, and other client runtime capabilities.
- [`polyfill/`](./polyfill/) contains polyfills that modify the global
  environment.
- [`ponyfill/`](./ponyfill/) contains ponyfills imported without global
  modification.
- [`vite/`](./vite/) contains Vite plugins.

Each publishable project lives in its own immediate subdirectory and owns its
package metadata, source, tests, and documentation.

## Packages

- [`@serve-tools/client-db`](./client/db/) provides promise-based IndexedDB operations, transactions, and scans.
- [`@serve-tools/client-messaging`](./client/messaging/) provides requests and subscriptions across workers and message ports.
- [`@serve-tools/client-shared-db`](./client/shared-db/) coordinates IndexedDB operations and change subscriptions through
  a SharedWorker.
- [`@serve-tools/client-storage`](./client/storage/) provides observable access to local and session storage.
- [`@serve-tools/polyfill-request-idle-callback`](./polyfill/request-idle-callback/)
  installs the `requestIdleCallback` and `cancelIdleCallback` globals.
- [`@serve-tools/polyfill-resource-management`](./polyfill/resource-management/)
  installs ECMAScript Explicit Resource Management globals.
- [`@serve-tools/ponyfill-request-idle-callback`](./ponyfill/request-idle-callback/)
  provides `requestIdleCallback` and `cancelIdleCallback` without global mutation.
- [`@serve-tools/ponyfill-resource-management`](./ponyfill/resource-management/)
  provides a side-effect-free implementation of ECMAScript Explicit Resource
  Management.
- [`@serve-tools/vite-polyfills`](./vite/polyfills/) detects and injects
  polyfills for unsupported JavaScript features in Vite projects.

## Development

Node.js 22.14 or newer and npm 11.5.1 or newer are required. CI uses the npm
12.0.2 version pinned by `packageManager`.

```sh
npm ci --ignore-scripts
npm run verify
```

## License

[MIT-0](./LICENSE.md)
