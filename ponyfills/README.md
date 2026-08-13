# Ponyfills

Platform-compatible implementations for explicit import without global mutation.

Each immediate subdirectory is an independently versioned npm workspace.

## Packages

- [`@serve-tools/ponyfill-request-idle-callback`](./request-idle-callback/) provides `requestIdleCallback` and `cancelIdleCallback` without modifying the global environment.
- [`@serve-tools/ponyfill-resource-management`](./resource-management/) provides an isolated implementation of ECMAScript Explicit Resource Management.
