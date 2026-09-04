# Ponyfills

Platform-compatible implementations for explicit import without global mutation.

Each immediate subdirectory is an independently versioned npm workspace.

For native-preserving global installation instead, use the matching packages in [`polyfills/`](../polyfills/), including the Observable and Composites counterparts.

## Packages

- [`@serve-tools/ponyfill-composites`](./composites/) creates interned composite values without modifying the global environment.
- [`@serve-tools/ponyfill-observable`](./observable/) provides a Web Observable API subset with a fresh execution per consumption and no global mutation.
- [`@serve-tools/ponyfill-arraybuffer-base64`](./arraybuffer-base64/) encodes `Uint8Array` values as base64 in Node.js without global mutation.
- [`@serve-tools/ponyfill-request-idle-callback`](./request-idle-callback/) provides `requestIdleCallback` and `cancelIdleCallback` without modifying the global environment.
- [`@serve-tools/ponyfill-report-error`](./report-error/) provides a console-backed `reportError()` fallback without reading or modifying the global environment.
- [`@serve-tools/ponyfill-resource-management`](./resource-management/) provides an isolated implementation of ECMAScript Explicit Resource Management.
- [`@serve-tools/ponyfill-urlpattern`](./urlpattern/) provides the `URLPattern` API without modifying the global environment.
