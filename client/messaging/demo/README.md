# @serve-tools/client-messaging demo

A private multi-page Vite application demonstrating requests and subscriptions with one `SharedWorker`.

[Open the hosted demo](https://serve-tools.github.io/web-tools/client/messaging/).

## Run

[Open this directory in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/messaging/demo), or run it as a standalone project:

```shell
npm install
npm run dev
```

The standalone project installs the published `@serve-tools/client-messaging` package.
From the repository root, use the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-messaging
npm run dev --workspace @serve-tools/client-messaging-demo
```

The pages demonstrate promised requests, shared state observed by multiple tabs, `AbortSignal` cancellation, and zero-copy `ArrayBuffer` transfer.
Open the shared-state page in two tabs to see both clients observe the same worker state.

Build and type-check every page with:

```shell
npm run build --workspace @serve-tools/client-messaging-demo
```
