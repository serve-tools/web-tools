# @serve-tools/client-db demo

A private multi-page Vite application demonstrating `@serve-tools/client-db` in the browser with IndexedDB.

[Open the hosted demo](https://serve-tools.github.io/web-tools/client/db/).

## Run

[Open this directory in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/db/demo), or run it as a standalone project:

```shell
npm install
npm run dev
```

The standalone project installs the published `@serve-tools/client-db` package.
From the repository root, use the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-db
npm run dev --workspace @serve-tools/client-db-demo
```

Then open the displayed local URL.
The pages demonstrate schema-aware point operations, atomic multi-store transactions, paged async scans, and cancellation with `AbortSignal`.
Demo records persist in the browser for the current origin.
Actions that replace the contact dataset also clear its related activity records, preserving the demo's data invariants.

Build and type-check every page with:

```shell
npm run build --workspace @serve-tools/client-db-demo
```
