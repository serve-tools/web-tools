# @serve-tools/signal-shared-db

The `@serve-tools/signal-shared-db` package provides Signal-backed reactive queries over a `SharedWorker`-coordinated IndexedDB client.

```ts
import { SignalDB } from "@serve-tools/signal-shared-db";
import type { AppDatabase } from "./database-worker.js";

const worker = new SharedWorker(new URL("./database-worker.js", import.meta.url), { type: "module" });
const db = SignalDB.connect<AppDatabase>(worker.port);
const user = db.watch("users", "one");

user.get(); // { status: "pending" }
```

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-shared-db
```

## Connect to a typed shared database

Define the database and listen for connections in a shared-worker entrypoint:

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

Connect from each window and wrap the shared client with `SignalDB.connect()` as shown above.

## Reactive queries

`watch()` and `watchAll()` return real computed signals with explicit asynchronous state.

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

The complete query state is:

```ts
type QueryState<T> =
	| { status: "pending" }
	| { status: "ready"; value: T }
	| { status: "error"; error: unknown };
```

Each query registers its remote change subscription before its initial read.
Committed writes made through any client of the same shared worker refresh queries for the affected stores.

Call `query.refresh()` to explicitly read again.
It resolves when the latest refresh requested so far has published its state, even when refreshes overlap.
It accepts `{ signal }`; read failures and cancellation are published as an `error` state rather than rejected from `refresh()`.

Call `query.dispose()` when a query should stop following its key, options, and remote writes.
Refreshing a disposed query rejects with an `InvalidStateError`; a request already in flight may still publish its result.
Calling `db.close()` or losing the shared connection disposes all queries and subscriptions.

Use `invalidate()` to explicitly refresh every active query for one or more stores when needed:

```ts
db.invalidate("users");
```

Use `query.refresh()` instead when only one query should rerun.
Mutations routed through the shared client are invalidated automatically.

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

`db.source` exposes the underlying `SharedDBClient`.
Call `db.close()` when the window no longer needs it, then close the worker port owned by the page.
The remote client intentionally exposes point operations rather than native transactions, cursors, or connection handles because those objects cannot retain their semantics across a message boundary.

`SignalDB` and `Query` also implement `Symbol.dispose` for optional explicit-resource-management interoperability.

## Agent Skill

This package includes `skills/serve-tools-signal-shared-db/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Listening is explicit; installing the package does not automatically trust or enable it.
