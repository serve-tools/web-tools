# Common combinations

## Typed realtime client and server

Use `@serve-tools/client-websocket` for each browser-owned connection and `@serve-tools/server-websocket` for typed handlers and runtime integration.
Both use `@serve-tools/realtime-protocol`; import it directly only for custom transport adapters or reliable-stream framing.
Use `@serve-tools/signal-websocket` or `@serve-tools/signal-shared-websocket` when subscription state should be reactive.

## Reactive cross-tab database state

Use `@serve-tools/client-shared-db` for the worker-owned database connection and `@serve-tools/signal-shared-db` for reactive query state.
Use `@serve-tools/client-db` alone when coordination and reactive observation are unnecessary.

## Reactive worker messaging

Use `@serve-tools/client-messaging` for request and subscription transport and `@serve-tools/signal-messaging` when a subscription must be consumed as Signal state.

## Signal-aware Lit components

Use `@serve-tools/lit-signals` for Lit lifecycle integration.
`@serve-tools/lit-signals` re-exports `Signal`; add `@serve-tools/signal` only when importing it directly.
Add `@serve-tools/signal-effect` or `@serve-tools/signal-collections` only when the component directly needs those APIs.

## Browser compatibility

Use ponyfills when the application can import the fallback explicitly.
Use polyfills when third-party code requires missing globals.
Use `@serve-tools/vite-polyfills` when Vite should inject feature-specific polyfills for configured targets.

## Facade versus focused packages

Use `@serve-tools/client` when one module intentionally exposes several client namespaces.
Use focused packages for isolated capabilities, smaller dependency surfaces, and clearer ownership.
