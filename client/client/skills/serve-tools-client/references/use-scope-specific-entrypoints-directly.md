# Use scope-specific entrypoints directly

- Import pointer and drop-target observers from `@serve-tools/client/input/pointer` and `@serve-tools/client/input/drop` when only one input capability is needed.
- Import clipboard, eyedropper, file-picker, and sharing operations from their focused `@serve-tools/client/interaction/*` subpaths when only one interaction capability is needed.
- Import the messaging window helpers from `@serve-tools/client/messaging/scope/window` and worker helpers from `@serve-tools/client/messaging/scope/worker`; both preserve the generic messaging types and their `connect` or `listen` namespace aliases.
- Import typed binary WebSocket clients from `@serve-tools/client/websocket`; it has the same type and runtime identity as the aggregate `websocket` namespace.
- Import binary HTTP stream clients from `@serve-tools/client/http-stream` and reliable-plus-datagram WebTransport clients from `@serve-tools/client/webtransport`; each matches its aggregate namespace.
- Import direct IndexedDB from `@serve-tools/client/db`.
- Import the shared database client from `@serve-tools/client/db/scope/window` and its server from `@serve-tools/client/db/scope/shared-worker`.
- Do not treat the scoped shared database client as a remote transaction or cursor API; it intentionally exposes point operations and committed-change subscriptions.
