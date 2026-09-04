# @serve-tools/signal-db

`@serve-tools/signal-db` adds explicit Signal-backed query state to `@serve-tools/client-db`.

```ts
import { SignalDB } from "@serve-tools/signal-db";

await using db = await SignalDB.open<{ notes: SignalDB.Store<string, string> }>("notes");
using note = db.watch("notes", "welcome");
```

## Install

```shell
npm install @serve-tools/signal-db
```

`watch()`, `watchAll()`, `watchAllKeys()`, and `watchCount()` expose `pending`, `ready`, or `error` state and refresh when signal-backed inputs change.
`watchAll()` and `watchAllKeys()` accept reactive `count` and `query` options, while `watchCount()` accepts a reactive `query` option.
Committed point writes and read/write transactions made through the same `SignalDB` automatically invalidate affected stores.
Call `invalidate()` after writes made through another connection or API because native IndexedDB does not broadcast record changes.
Use `@serve-tools/signal-shared-db` when multiple tabs need coordinated post-commit change subscriptions.

Finite operations, transactions, and scans retain the underlying client's Promise and IndexedDB semantics.
Dispose queries independently or close the wrapper to dispose every query and close its source connection.
Disposal preserves an already published query snapshot; a pending refresh instead publishes a terminal `InvalidStateError`, and its later database result cannot overwrite that state.

## Preserve drafts during refresh

Every refresh publishes `{ status: "pending" }` without its previous value, including refreshes after committed writes.
Do not turn pending into an empty collection or unmount an editor that already has data.
The [retained-query recipe](./skills/serve-tools-signal-db/references/preserve-editor-drafts.md) keeps the last successful snapshot alongside the current loading/error state and preserves the same textarea during background refresh.
It also treats a successful empty or missing result as new data, rather than retaining the old record forever.

Copy the application-local helpers from the recipe; they are not package exports.

```ts
const editor = mountDraftEditor(db.watch("notes", "welcome"), container, (note) => note);

// When this fixed record's view is retired:
editor.dispose();
```

Own drafts separately from fetched records, and recreate the retained-query owner when the record key, filters, account, or tenant changes.
The underlying `QueryState` and default refresh/disposal behavior are unchanged.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-db`](./skills/serve-tools-signal-db/SKILL.md).

## Development

The default test command runs unit tests in Node.js and native IndexedDB integration tests in Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/signal-db
```

## License

[MIT-0](./LICENSE.md)
