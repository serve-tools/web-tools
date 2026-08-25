# Polyfills

Packages that install missing platform features into the global environment.
Each polyfill preserves an existing native implementation.

Each immediate subdirectory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/polyfill-arraybuffer-base64`](./arraybuffer-base64/) installs `Uint8Array.prototype.toBase64()` in Node.js.
- [`@serve-tools/polyfill-request-idle-callback`](./request-idle-callback/) installs the `requestIdleCallback` and `cancelIdleCallback` globals.
- [`@serve-tools/polyfill-report-error`](./report-error/) installs a missing `reportError()` global while preserving a native implementation.
- [`@serve-tools/polyfill-resource-management`](./resource-management/) installs ECMAScript Explicit Resource Management globals.
- [`@serve-tools/polyfill-urlpattern`](./urlpattern/) installs `URLPattern` while preserving a native implementation.
