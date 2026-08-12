# @serve-tools/client-storage demo

A private Vite application demonstrating local and session storage with synchronous subscriptions.

## Run

[Open this directory in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/storage/demo), or run it as a standalone project:

```shell
npm install
npm run dev
```

The standalone project installs the published `@serve-tools/client-storage` package.
From the repository root, use the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-storage
npm run dev --workspace @serve-tools/client-storage-demo
```

The local theme persists across browser restarts, while the session note belongs to the current tab.
The event log shows the exact change records delivered for wrapper mutations and clear invalidation.

Build and type-check the demo with:

```shell
npm run build --workspace @serve-tools/client-storage-demo
```
