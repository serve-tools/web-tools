# @serve-tools/signal-shared-db

Keep IndexedDB queries current across tabs without broadcasting changes yourself.
One shared worker owns the database connection; committed writes from any connected page refresh the other pages' watched queries.

Compile these two TypeScript modules in the same directory:

```ts
// database-worker.ts
import type { SignalDB } from "@serve-tools/signal-shared-db";
import { listen } from "@serve-tools/signal-shared-db/shared-worker";

export type AppDatabase = {
	notes: SignalDB.Store<string, string>;
};

listen<AppDatabase>("shared-notes-demo", {
	version: 1,
	upgrade(database, { oldVersion }) {
		if (oldVersion < 1) database.createObjectStore("notes");
	},
});
```

```ts
// page.ts
import { effect } from "@serve-tools/signal-effect";
import { SignalDB } from "@serve-tools/signal-shared-db";
import type { AppDatabase } from "./database-worker.js";

const worker = new SharedWorker(new URL("./database-worker.js", import.meta.url), { type: "module" });
const db = SignalDB.connect<AppDatabase>(worker.port);
const note = db.watch("notes", "welcome");
const output = document.createElement("output");
document.body.append(output);
const stop = effect(() => {
	const state = note.get();
	output.value = state.status === "ready" ? (state.value ?? "No note yet")
		: state.status === "pending" ? "Loading…" : `Failed: ${String(state.error)}`;
});
const button = document.createElement("button");
button.textContent = "Save greeting for every tab";
button.addEventListener("click", () => {
	void db.put("notes", `Hello at ${new Date().toLocaleTimeString()}`, { key: "welcome" }).catch(console.error);
});
document.body.append(button);

addEventListener("pagehide", () => {
	stop();
	note.dispose();
	db.close();
	worker.port.close();
});
```

Open two tabs and click the button in one: both outputs refresh after the committed write.
Install `@serve-tools/signal-effect` as well for this rendering recipe.

This first example owns one active page connection and retires it on `pagehide`.
Cached-page restoration requires a fresh client and observation; follow the [back/forward-cache reconnection recipe](../../client/messaging/#backforward-cache).

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-shared-db @serve-tools/signal-effect
```

#### Import from a CDN

```js
import * as signalSharedDb from "https://esm.run/@serve-tools/signal-shared-db";
```

## Add records and indexes

For a separate user database, define records and indexes in its shared-worker entrypoint:

```ts
import type { SignalDB } from "@serve-tools/signal-shared-db";
import { listen } from "@serve-tools/signal-shared-db/shared-worker";

interface User {
	id: string;
	email: string;
	name: string;
}

const server = listen<{
	users: SignalDB.Store<User, string, { byEmail: string }>;
	logs: SignalDB.Store<string, number>;
}>("app", {
	version: 1,
	upgrade(database, { oldVersion }) {
		if (oldVersion < 1) {
			const users = database.createObjectStore("users", { keyPath: "id" });

			users.createIndex("byEmail", "email", { unique: true });
			database.createObjectStore("logs");
		}
	},
});

export type AppDatabase = listen.SchemaType<typeof server>;
```

For the user-query examples below, connect a page to this worker with `SignalDB.connect<AppDatabase>(worker.port)` and retain that connection as `db`.
The earlier notes connection has a different schema.

## Reactive queries

`watch()`, `watchAll()`, `watchAllKeys()`, and `watchCount()` return real computed signals with explicit asynchronous state.

```ts
const selectedUser = db.watch("users", "one");

selectedUser.get(); // { status: "pending" }

// Later: { status: "ready", value: User | undefined }
```

A key or `watchAll()` option can itself be a state or computed signal:

```ts
import { Signal } from "@serve-tools/signal";

const userId = new Signal.State("one");
const selectedUser = db.watch("users", userId);

userId.set("two"); // Refreshes selectedUser.
```

`watchAll()` and `watchAllKeys()` accept reactive `count` and `query` options, while `watchCount()` accepts a reactive `query` option.

The complete query state is:

```ts
type QueryState<T> =
	| { status: "pending" }
	| { status: "ready"; value: T }
	| { status: "error"; error: unknown };
```

Each query registers its remote change subscription before its initial read.
Active queries for the same store share one remote change subscription.
Committed writes made through any client of the same shared worker refresh queries for the affected stores.

Call `query.refresh()` to explicitly read again.
It resolves when the latest refresh requested so far has published its state, even when refreshes overlap.
It accepts `{ signal }`; read failures and cancellation are published as an `error` state rather than rejected from `refresh()`.

Call `query.dispose()` when a query should stop following its key, options, and remote writes.
Refreshing a disposed query rejects with an `InvalidStateError`.
Disposal preserves an already published query snapshot; a pending refresh instead publishes a terminal `InvalidStateError`, and its later database result cannot overwrite that state.
Calling `db.close()` or losing the shared connection disposes all queries and subscriptions.

Use `invalidate()` to explicitly refresh every active query for one or more stores when needed:

```ts
db.invalidate("users");
```

Use `query.refresh()` instead when only one query should rerun.
Mutations routed through the shared client are invalidated automatically.

## Preserve drafts during refresh

Every refresh publishes `{ status: "pending" }` without its previous value, including refreshes after another client commits a write.
Do not turn pending into an empty collection or unmount an editor that already has data.
The [retained-query recipe](./skills/serve-tools-signal-shared-db/references/preserve-editor-drafts.md) keeps the last successful snapshot alongside the current loading/error state and preserves the same textarea during background refresh.
It also treats a successful empty or missing result as new data, rather than retaining the old record forever.

Copy the application-local helpers from the recipe; they are not package exports.

```ts
const editor = mountDraftEditor(db.watch("users", "one"), container, (user) => user.name);

// When this fixed record's view is retired:
editor.dispose();
```

Own drafts separately from fetched records, and recreate the retained-query owner when the record key, filters, account, or tenant changes.
The underlying `QueryState` and default refresh/disposal behavior are unchanged.

## Promise operations

`get()`, `getAll()`, `getAllKeys()`, `has()`, and `count()` are finite queries.
`add()`, `put()`, `delete()`, and `clear()` are finite mutations.
Each creates one short transaction, and mutations resolve only after that transaction commits.

```ts
const stored = await db.get("users", "one");
const firstTen = await db.getAll("users", { count: 10 });
const firstTenKeys = await db.getAllKeys("users", { count: 10 });
const total = await db.count("users");

const user = {
	id: "one",
	email: "one@example.com",
	name: "One",
};

await db.add("users", user); // Create only; rejects if the key already exists.
await db.put("users", { ...user, name: "Updated" }); // Create or replace.

await db.put("logs", "created", { key: 1 });
await db.delete("users", "one");
await db.clear("logs");
```

Every point operation accepts an `AbortSignal`.
An already-aborted signal rejects immediately with its reason.

```ts
const controller = new AbortController();

const stored = db.put("users", user, { signal: controller.signal });

controller.abort();
await stored; // Rejects with the signal's AbortError.
```

## Shared-worker lifecycle

`db.source` exposes the underlying `SharedDBClient`, and `db.closed` is its close-completion promise.
Call `db.close()` when the window no longer needs it, then close the worker port owned by the page.
The remote client intentionally exposes point operations rather than native transactions, cursors, or connection handles because those objects cannot retain their semantics across a message boundary.

`SignalDB` and `Query` also implement `Symbol.dispose` for optional explicit-resource-management interoperability.

## Public API

- `SignalDB` wraps a `SharedDBClient`, exposes finite point operations, and owns `watch()`, `watchAll()`, `watchAllKeys()`, `watchCount()`, `invalidate()`, and query disposal.
- `SignalDB.connect(port)` creates a reactive database from a shared-worker port.
- `Query<T>` is a read-only computed signal with `refresh()` and `dispose()`.
- `QueryState<T>` describes `pending`, `ready`, and `error` states.
- `Watchable<T>` accepts a static value, `Signal.State`, or `Signal.Computed`.
- `OperationOptions`, `MutationOptions`, `WriteOptions`, `GetAllOptions`, `CountOptions`, `WatchAllOptions`, and `WatchCountOptions` describe point operations and reactive query inputs.
- `SignalDB.Store`, `SignalDB.Schema`, `StoreName`, `StoreKey`, and `StoreValue` define and project database schemas.
- The root also re-exports the lower-level shared database change and subscription types used by `source`.
- `@serve-tools/signal-shared-db/shared-worker` exports `listen()` and the corresponding shared database server types.

## Compatibility

The package is an ES module for browser windows and shared workers that provide IndexedDB, `SharedWorker`, `MessagePort`, structured clone, and `AbortSignal`.
It does not install browser APIs in Node.js.
Explicit resource management requires `Symbol.dispose` support or a compatible polyfill; `close()` and `dispose()` are always available.

## Choose database ownership

Use [`@serve-tools/signal-db`](../db/) for queries owned by a single connection.
Use this package for coordinated change subscriptions across tabs.
Use [`@serve-tools/client-shared-db`](../../client/shared-db/) for the same shared-worker database with finite Promise-based reads and explicit change subscriptions.

## Agent Skill

This package includes `skills/serve-tools-signal-shared-db/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs native SharedWorker integration tests in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/signal-shared-db
```

Run the opt-in Chromium benchmarks for query lifecycle, change fanout, and targeted invalidation with:

```shell
npm run benchmark --workspace @serve-tools/signal-shared-db
```

## License

[MIT-0](./LICENSE.md)
