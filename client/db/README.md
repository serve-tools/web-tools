# @serve-tools/client-db

The `@serve-tools/client-db` package provides typed, Promise-based IndexedDB operations, transactions, and paged scans.

```ts
import { DB } from "@serve-tools/client-db";

await using db = await DB.open<{ notes: DB.Store<string, string> }>("notes", {
	version: 1,
	upgrade(database) {
		database.createObjectStore("notes");
	},
});

await db.put("notes", "Hello", { key: "welcome" });

console.log(await db.get("notes", "welcome")); // "Hello"
```

`DB` adds promises, cancellation, schema-aware operations, paged async iteration, and explicit resource management to the browser's IndexedDB storage model.

## Install

```shell
npm install @serve-tools/client-db
```

## Recipes

### Define and open a database

```ts
import { DB } from "@serve-tools/client-db";

interface AppSchema {
	users: DB.Store<
		{ id: string; email: string; name: string },
		string,
		{ byEmail: string }
	>;
	logs: DB.Store<{ message: string; time: number }, number>;
}

await using db = await DB.open<AppSchema>("app", {
	version: 2,
	upgrade(database, { oldVersion, transaction }) {
		if (oldVersion < 1) {
			const users = database.createObjectStore("users", { keyPath: "id" });
			users.createIndex("byEmail", "email", { unique: true });
		}

		if (oldVersion < 2) {
			database.createObjectStore("logs", { autoIncrement: true });
		}
	},
});
```

`version` and `upgrade` follow the platform's versionchange model.
Upgrade work must stay synchronous or use `IDBRequest` callbacks so it remains inside the native upgrade transaction.
Without a `versionchange` handler, the connection closes automatically when another context upgrades the database.

The schema describes each object store's value, primary key, and indexes through `DB.Store`.
It is erased at runtime; stored values remain ordinary structured-clone values.

### Point operations

```ts
const user = await db.get("users", userID, { signal });
const users = await db.getAll("users", { count: 20, signal });
const exists = await db.has("users", userID);

await db.add("users", { id: userID, email, name });
await db.put("users", { id: userID, email, name }, { durability: "relaxed" });
await db.delete("users", userID);
await db.clear("logs");
```

Every operation resolves after its transaction commits, not merely when its request succeeds.
Write options accept IndexedDB's native `durability` hint.
`AbortSignal` cancels an in-flight transaction.

### Transactions

```ts
await db.transaction(["users", "logs"], { mode: "readwrite", signal }, async (transaction) => {
	const users = transaction.objectStore("users");
	const existing = await users.index("byEmail").get(email);

	if (!existing) await users.add({ id: crypto.randomUUID(), email, name });
});
```

Object stores and indexes expose promises instead of `IDBRequest` objects.
The callback resolves after commit and aborts on an error.
As with native IndexedDB, only await requests started from the same active transaction; awaiting unrelated asynchronous work may allow the browser to auto-commit it.

For integration that requires manual transaction control:

```ts
const transaction = db.transaction("users", { mode: "readwrite" });

try {
	await transaction.objectStore("users").put(user);
	transaction.commit();
	await transaction.done;
} catch (error) {
	try {
		transaction.abort();
	} catch {}
	throw error;
}
```

### Scans

```ts
for await (const { key, value } of db.scan("users", {
	query: IDBKeyRange.bound("a", "m"),
	batchSize: 100,
	limit: 500,
	signal,
})) {
	// ...
}
```

`scan`, `scanKeys`, and `scanValues` read independently committed pages.
This avoids holding a transaction open across consumer work, but writes committed between pages can appear in the scan.
Use a transaction and bounded `getAll` call when a single-transaction snapshot is required.

For one coordinated database connection and post-commit change subscriptions shared across tabs, use [`@serve-tools/client-shared-db`](../shared-db/).

### Connection lifecycle

```ts
db.close();
await DB.delete("app", { blocked(event) {} });
```

Connections implement `Disposable`; transactions expose their completion through `done`.

## Compatibility

The package is an ES module for browser windows and workers that provide IndexedDB.
It relies on the platform's `indexedDB`, `IDBKeyRange`, structured-clone, and `AbortSignal`; it does not install an IndexedDB implementation in Node.js.
Using `await using` for connection cleanup additionally requires `Symbol.dispose` support or a compatible polyfill.
Upgrade callbacks have the same synchronous lifetime constraints as native `upgradeneeded` handlers.

The recipes above are covered by the package's TypeScript fixtures in addition to its runtime tests.

## Public API

The package exports the `DB` connection class and these supporting declarations:

- `DBEntry`, `DBIndex`, `DBObjectStore`, and `DBTransaction` describe records and transaction-scoped resources.
- `DBOpenOptions`, `DBDeleteOptions`, `DBOperationOptions`, `DBMutationOptions`, `DBWriteOptions`, `DBTransactionOptions`, `DBQueryOptions`, `DBGetAllOptions`, `DBCountOptions`, and `DBScanOptions` describe operation dictionaries.
- `DBUpgradeContext`, `DBUpgradeDatabase`, `DBUpgradeObjectStore`, and `DBUpgradeTransaction` describe the synchronous versionchange surface.
- `DBTransactionCallback`, `StoreName`, `StoreKey`, and `StoreValue` support reusable application declarations.
- `DB.Store` and `DB.Schema` define database schemas.

## Demo

The [`demo`](./demo) workspace contains focused browser examples for point operations, atomic transactions, paged scans, and cancellation:

[Try the demo in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/db/demo)

The demo directory is standalone-importable and installs the published package when it is used outside this repository.
To run it against the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-db
npm run dev --workspace @serve-tools/client-db-demo
```

## Agent Skill

This package includes `skills/serve-tools-client-db/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs unit tests and native IndexedDB integration tests in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/client-db
```

Run the opt-in Chromium benchmarks for point reads, point writes, and batched transactions with:

```shell
npm run benchmark --workspace @serve-tools/client-db
```

Benchmark results report warmup-separated mean, median, p95, and operations per second.
They are descriptive measurements and do not impose environment-sensitive pass/fail thresholds.

## License

[MIT-0](./LICENSE.md)
