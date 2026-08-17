# Ponyfills

Platform-compatible implementations for explicit import without global mutation.

Each immediate subdirectory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/ponyfill-arraybuffer-base64`](./arraybuffer-base64/) encodes `Uint8Array` values as base64 in Node.js without global mutation.
- [`@serve-tools/ponyfill-request-idle-callback`](./request-idle-callback/) provides `requestIdleCallback` and `cancelIdleCallback` without modifying the global environment.
- [`@serve-tools/ponyfill-report-error`](./report-error/) provides a console-backed `reportError()` fallback without reading or modifying the global environment.
- [`@serve-tools/ponyfill-resource-management`](./resource-management/) provides an isolated implementation of ECMAScript Explicit Resource Management.
