# Ponyfills

Platform-compatible implementations for explicit import without global mutation.

Each immediate subdirectory is an independently versioned npm workspace.

For native-preserving global installation instead, use the matching packages in [`polyfills/`](../polyfills/), including the Observable and Composites counterparts.

## Choose an explicit implementation

Use a ponyfill when the application wants an imported API with documented fallback behavior rather than a native-aware selection.
For example, import `{ URLPattern }` from `@serve-tools/ponyfill-urlpattern`, then call `new URLPattern({ pathname: "/books/:id" })`.
The constructor remains the same package implementation across runtimes.

For native-aware imported values, use the [matching polyfill's documented value subpath](../polyfills/).
For application-owned global installation, use its root or selective `apply/*` import.
Scoped-registry installation is the exception: its import is inert, but calling its installer changes coordinated DOM APIs.
The experimental Observable, Composites, and scoped-registry packages each document limits that cannot be hidden by an import choice.

## Packages

- [`@serve-tools/ponyfill-decorator-metadata`](./decorator-metadata/) provides an explicitly shared metadata symbol.
- [`@serve-tools/ponyfill-prioritized-task-scheduling`](./prioritized-task-scheduling/) queues abortable work with local priorities.
- [`@serve-tools/ponyfill-composites`](./composites/) creates interned composite values without modifying the global environment.
- [`@serve-tools/ponyfill-custom-element-registry`](./custom-element-registry/) provides explicit installation of iframe-backed scoped registries without import-time mutation.
- [`@serve-tools/ponyfill-observable`](./observable/) provides a Web Observable API subset with a fresh execution per consumption and no global mutation.
- [`@serve-tools/ponyfill-arraybuffer-base64`](./arraybuffer-base64/) encodes `Uint8Array` values as base64 in Node.js without global mutation.
- [`@serve-tools/ponyfill-request-idle-callback`](./request-idle-callback/) provides `requestIdleCallback` and `cancelIdleCallback` without modifying the global environment.
- [`@serve-tools/ponyfill-report-error`](./report-error/) provides a console-backed `reportError()` fallback without reading or modifying the global environment.
- [`@serve-tools/ponyfill-resource-management`](./resource-management/) provides an isolated implementation of ECMAScript Explicit Resource Management.
- [`@serve-tools/ponyfill-urlpattern`](./urlpattern/) provides the `URLPattern` API without modifying the global environment.
