# Polyfills

Packages that install missing platform features into the global environment.
Each polyfill preserves an existing native implementation.

Each immediate subdirectory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/polyfill-request-idle-callback`](./request-idle-callback/) installs the `requestIdleCallback` and `cancelIdleCallback` globals.
- [`@serve-tools/polyfill-resource-management`](./resource-management/) installs ECMAScript Explicit Resource Management globals.
