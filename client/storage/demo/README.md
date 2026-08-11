# @serve-tools/client-storage demo

A private Vite application demonstrating local and session storage with synchronous subscriptions.

## Run

From the repository root, build the storage package and start the demo:

```sh
npm run build --workspace @serve-tools/client-storage
npm run dev --workspace @serve-tools/client-storage-demo
```

The local theme persists across browser restarts, while the session note belongs to the current tab. The event log shows
the exact change records delivered for wrapper mutations and clear invalidation.

Build and type-check the demo with:

```sh
npm run build --workspace @serve-tools/client-storage-demo
```
