# Common combinations

## Shared typed routes and browser navigation

Use `@serve-tools/router` for route declarations shared between browser and server entrypoints.
Use `@serve-tools/client-router` for native browser navigation, installed route arrays, rendering, and automatic View Transitions.
The browser router re-exports the shared route helpers, so add `@serve-tools/router` as a direct dependency only when another application module imports the environment-neutral package directly.

## Typed JSON HTTP contracts and shared routes

Use `@serve-tools/router` for schema-free pathname and search declarations shared between application entrypoints.
Use `@serve-tools/http-contract` to bind explicit JSON operations to Standard Schema request/response validators; omit a route value when string path parameters are sufficient, or provide a router route for typed codecs.
Import application contract values only into trusted handlers and optional OpenAPI generation; browser clients import the exposed contract only as a type.
Use `@serve-tools/http-contract/client/static` for fixed endpoints or `@serve-tools/http-contract/client` for pathname/search inputs and custom hrefs.
Put native per-request Fetch metadata under `init`, narrow client results by `status` and `body`, and use server-context `respond({ status, body?, headers? })` for typed short circuits.
Use existing binary HTTP-stream packages instead when requests require streaming subscriptions or non-JSON payloads.

## Typed realtime client and server

Use `@serve-tools/client-websocket` for each browser-owned connection and `@serve-tools/server-websocket` for typed handlers and runtime integration when reactive subscription state is unnecessary.
Both use `@serve-tools/realtime-protocol`; import it directly only for custom transport adapters or reliable-stream framing.
Use the capability-complete `@serve-tools/signal-websocket` or `@serve-tools/signal-shared-websocket` client instead when subscription state should be reactive.

Use `@serve-tools/client-webtransport` with `@serve-tools/server-webtransport` when the same session also needs typed best-effort datagrams for replaceable recent state.
Use `@serve-tools/client-http-stream` with `@serve-tools/server-http-stream` when client operations can be separate Fetch exchanges and only server-to-client subscriptions stream.
Use `@serve-tools/client-event-source` with `@serve-tools/server-event-source` for browser-managed SSE reconnection, named JSON events, and `Last-Event-ID` replay cursors.
Choose the corresponding `client-shared-*` package when a `SharedWorker` should own the transport without reactive state, or its capability-complete `signal-shared-*` counterpart when subscription values should be consumed as latest state.
Use the client and server realtime cores directly only to implement another adapter.

## Reactive cross-tab database state

Use `@serve-tools/signal-shared-db` for a worker-owned database connection with reactive query state.
Use `@serve-tools/signal-db` for reactive queries local to one typed connection, and use the corresponding `client-*` package alone when reactive observation is unnecessary.

## Reactive worker messaging

Use `@serve-tools/client-messaging` for request and subscription transport without reactive state, or the capability-complete `@serve-tools/signal-messaging` package when subscriptions must be consumed as Signal state.

## Signal-aware web components

Use `@serve-tools/aui` when the element should own a persistent layout and automatically suspend its signal bindings while disconnected.
In this guide version, AUI is available only from the repository workspace and is not yet published to npm.
Import `@serve-tools/signal-dom` for functional layout helpers and `@serve-tools/signal` when application code creates state directly.
For tagged literals, use `html` from `@serve-tools/signal-dom/template` and materialize its inert result with `createFragment(result, owner)` inside a binding scope.
AUI's `/template` subpath re-exports the same renderer; return an `html` result from `layout()` and the base supplies context and ownership automatically.
Outside binding capture, `createFragment` creates a standalone view that stays reactive while detached and needs explicit disposal.
Legacy `html(owner)` and `scopedHtml(owner)` adapters remain available for compatibility.
Use Signal DOM alone when the application already owns its component lifecycle or only needs standalone DOM construction.

## Signal-aware Lit components

Use `@serve-tools/lit-signals` for Lit lifecycle integration.
`@serve-tools/lit-signals` re-exports `Signal`; add `@serve-tools/signal` only when importing it directly.
Add `@serve-tools/signal-effect` or `@serve-tools/signal-collections` only when the component directly needs those APIs.
Use `@serve-tools/signals` instead when a non-Lit application module intentionally combines several core Signal capabilities.

## Browser compatibility

Use ponyfills when the fallback implementation itself should be imported explicitly.
Use non-apply polyfill exports to select native platform behavior first, and apply entrypoints when third-party code requires missing globals.
Use `@serve-tools/vite-polyfills` when Vite should inject feature-specific polyfills for configured targets.

For decorators, use `@serve-tools/rolldown-decorators` to transform syntax and implement decorator runtime semantics.
Add `@serve-tools/polyfill-decorator-metadata` only when another decorator transform or runtime expects global `Symbol.metadata`; use the ponyfill only for explicitly shared module-scoped symbol identity.

## Facade versus focused packages

Use `@serve-tools/client` when one module intentionally exposes several client namespaces.
Use `@serve-tools/client-signals` when those namespaces should include their Signal-aware variants.
Use `@serve-tools/signals` when one module intentionally combines the core Signal packages through a flat API.
Use focused packages for isolated capabilities, smaller dependency surfaces, and clearer ownership.
