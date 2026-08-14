---
name: serve-tools-client
description: Use @serve-tools/client for namespaced browser database, messaging, input, storage, and WebSocket APIs. Prefer focused packages when possible.
---

# Use @serve-tools/client

## Choose the import shape

- Import named namespaces such as `context`, `keyboard`, or `storage` from `@serve-tools/client` when one module coordinates several client capabilities.
- Import `@serve-tools/client/context`, `@serve-tools/client/keyboard`, or another focused subpath when only one capability is needed.
- Do not expect a flat root API; the root intentionally preserves capability ownership through namespaces.

## Keep capability semantics intact

- Treat every namespace and focused subpath as a re-export of its corresponding `@serve-tools/client-*` package.
- Follow the owning package's lifecycle, cancellation, disposal, platform, and compatibility requirements.
- Use Promise-returning operations for finite work and subscriptions only for ongoing occurrences.
- Preserve transient activation around clipboard, picker, sharing, and eyedropper calls.
- Dispose input sessions, database clients, messaging clients, WebSocket clients, storage subscriptions, providers, and consumers according to their owning API.

## Use scope-specific entrypoints directly

- Import pointer and drop-target observers from `@serve-tools/client/input/pointer` and `@serve-tools/client/input/drop` when only one input capability is needed.
- Import clipboard, eyedropper, file-picker, and sharing operations from their focused `@serve-tools/client/interaction/*` subpaths when only one interaction capability is needed.
- Import the messaging window helpers from `@serve-tools/client/messaging/scope/window` and worker helpers from `@serve-tools/client/messaging/scope/worker`; both preserve the generic messaging types and their `connect` or `listen` namespace aliases.
- Import typed binary WebSocket clients from `@serve-tools/client/websocket`; it has the same type and runtime identity as the aggregate `websocket` namespace.
- Import direct IndexedDB from `@serve-tools/client/db`.
- Import the shared database client from `@serve-tools/client/db/scope/window` and its server from `@serve-tools/client/db/scope/shared-worker`.
- Do not treat the scoped shared database client as a remote transaction or cursor API; it intentionally exposes point operations and committed-change subscriptions.

## Declare messaging and WebSocket protocols

- Declare `requests` and `subscriptions` as named TypeScript method signatures with zero parameters or one input value.
- Treat request return types as response values and subscription return types as delivered event values; omit either unused section.
- Use messaging's generic `Protocol`, `Client`, `Server`, `Listener`, `Handlers`, `ProtocolType`, option, context, subscription, endpoint, and transfer names instead of worker-prefixed names.
- Use the matching type aliases under the messaging `connect`, `serve`, and worker-scope `listen` namespaces when they keep ownership clear.
- Extract messaging protocols with `ProtocolType` from branded clients, servers, listeners, or promise-wrapped versions of those resources.
- Extract WebSocket protocols from either pending or resolved clients with the top-level `ProtocolType` or `connect.ProtocolType` alias.
- Treat protocol declarations and resource brands as compile-time-only metadata; the harmonized declaration contract does not change worker-message or binary WebSocket wire protocols.

## Validate changes

Update namespace exports, focused and scope-specific subpaths, dependencies, README examples, browser tests, type fixtures, package metadata, and package shape together.
Verify that each root namespace has the same type and runtime identity as its focused subpath module.
