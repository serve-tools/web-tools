# @serve-tools/signal-db

Query IndexedDB once and let the query refresh after committed writes through the same connection.
A watch is a read-only signal with explicit loading, success, and error states.

```ts
import { effect } from "@serve-tools/signal-effect";
import { SignalDB } from "@serve-tools/signal-db";

const db = await SignalDB.open<{ notes: SignalDB.Store<string, string> }>("notes-demo", {
	version: 1,
	upgrade(database, { oldVersion }) {
		if (oldVersion < 1) database.createObjectStore("notes");
	},
});
const note = db.watch("notes", "welcome");
const output = document.createElement("output");
document.body.append(output);
const stop = effect(() => {
	const state = note.get();
	output.value = state.status === "ready" ? (state.value ?? "No note yet")
		: state.status === "pending" ? "Loading…" : `Failed: ${String(state.error)}`;
});

addEventListener("pagehide", (event) => {
	if (event.persisted) return;

	stop();
	note.dispose();
	db.close();
});

await db.put("notes", "Hello, Ada!", { key: "welcome" });
// The output refreshes to "Hello, Ada!" after the committed write and query refresh.
```

The upgrade creates the store, the watch reads it, and the write invalidates it automatically.
The effect renders the watched state; Signal-aware UI libraries can consume the same observation directly.

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-db @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalDb from "https://esm.run/@serve-tools/signal-db";
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
const editor = mountDraftEditor(db.watch("notes", "welcome"), document.body, (note) => note);

// When this fixed record's view is retired:
editor.dispose();
```

Own drafts separately from fetched records, and recreate the retained-query owner when the record key, filters, account, or tenant changes.
The underlying `QueryState` and default refresh/disposal behavior are unchanged.

## Filter without rebuilding the query

Signal-backed query options keep the same query owner while inputs change.
Continue with the `db` connection from the first example:

```ts
import { Signal } from "@serve-tools/signal";

const limit = new Signal.State(10);
const notes = db.watchAll("notes", { count: limit });
const stopList = effect(() => {
	const state = notes.get();
	if (state.status === "ready") console.log(state.value);
});

limit.set(20); // Refreshes the same watch with a larger result limit.

addEventListener("pagehide", (event) => {
	if (event.persisted) return;

	stopList();
	notes.dispose();
});
```

Use [`@serve-tools/client-db`](../../client/db/) for finite Promise-based operations without reactive views.
Use [`@serve-tools/signal-shared-db`](../shared-db/) for automatic coordinated invalidation across tabs.

## Agent Skill

The package includes an Agent Skill at [`skills/serve-tools-signal-db`](./skills/serve-tools-signal-db/SKILL.md).

## Development

The default test command runs unit tests in Node.js and native IndexedDB integration tests in Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/signal-db
```

## License

[MIT-0](./LICENSE.md)
