---
name: serve-tools-client
description: Use @serve-tools/client for namespaced access to client context, database, input, interaction, keyboard, messaging, and storage APIs, including scoped shared database coordination. Prefer a focused subpath when only one capability is needed.
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
- Dispose input sessions, database clients, messaging clients, storage subscriptions, providers, and consumers according to their owning API.

## Use scope-specific entrypoints directly

- Import pointer and drop-target observers from `@serve-tools/client/input/pointer` and `@serve-tools/client/input/drop` when only one input capability is needed.
- Import clipboard, eyedropper, file-picker, and sharing operations from their focused `@serve-tools/client/interaction/*` subpaths when only one interaction capability is needed.
- Import the messaging window helpers from `@serve-tools/client/messaging/scope/window` and worker helpers from `@serve-tools/client/messaging/scope/worker`.
- Import direct IndexedDB from `@serve-tools/client/db`.
- Import the shared database client from `@serve-tools/client/db/scope/window` and its server from `@serve-tools/client/db/scope/shared-worker`.
- Do not treat the scoped shared database client as a remote transaction or cursor API; it intentionally exposes point operations and committed-change subscriptions.

## Validate changes

Update namespace exports, focused and scope-specific subpaths, dependencies, README examples, browser tests, type fixtures, package metadata, and package shape together.
Verify that each root namespace has the same type and runtime identity as its focused subpath module.
