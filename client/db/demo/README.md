# @serve-tools/client-db demo

A private multi-page Vite application demonstrating `@serve-tools/client-db` in the browser with IndexedDB.

## Run

From the repository root, build the database package and start the demo:

```sh
npm run build --workspace @serve-tools/client-db
npm run dev --workspace @serve-tools/client-db-demo
```

Then open the displayed local URL. The pages demonstrate schema-aware point operations, atomic multi-store transactions,
paged async scans, and cancellation with `AbortSignal`. Demo records persist in the browser for the current origin.
Actions that replace the contact dataset also clear its related activity records, preserving the demo's data invariants.

Build and type-check every page with:

```sh
npm run build --workspace @serve-tools/client-db-demo
```
