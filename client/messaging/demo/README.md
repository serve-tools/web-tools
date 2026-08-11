# @serve-tools/client-messaging demo

A private multi-page Vite application demonstrating requests and subscriptions with one `SharedWorker`.

## Run

From the repository root, build the library and start the demo:

```sh
npm run build --workspace @serve-tools/client-messaging
npm run dev --workspace @serve-tools/client-messaging-demo
```

The pages demonstrate promised requests, shared state observed by multiple tabs, `AbortSignal` cancellation, and
zero-copy `ArrayBuffer` transfer. Open the shared-state page in two tabs to see both clients observe the same worker
state.

Build and type-check every page with:

```sh
npm run build --workspace @serve-tools/client-messaging-demo
```
