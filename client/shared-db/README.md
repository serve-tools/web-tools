# @serve-tools/client-shared-db

The `@serve-tools/client-shared-db` package coordinates typed IndexedDB operations and post-commit change subscriptions through a `SharedWorker`.

```ts
import { connect } from "@serve-tools/client-shared-db/scope/window";
import type { AppSchema } from "./database-worker.js";

const worker = new SharedWorker(new URL("./database-worker.js", import.meta.url), { type: "module" });
const database = connect<AppSchema>(worker.port);

await database.put("users", { id: "ada", name: "Ada Lovelace" });

console.log(await database.get("users", "ada"));
```

This package keeps one `@serve-tools/client-db` connection and post-commit change feed behind a `SharedWorker`, allowing every tab to use the same coordinator.
Finite operations remain Promise-based; subscriptions provide the explicit bridge for reactive adapters.

## Install

```shell
npm install @serve-tools/client-shared-db @serve-tools/client-db
```

## Usage

Once the worker is listening, the connected database provides the familiar Promise-based point operations from `@serve-tools/client-db`.
The result of `get()` is typed from the worker schema; the same client also provides `add`, `put`, `delete`, `clear`, `has`, `count`, `getAll`, and `getAllKeys`.

The worker entrypoint defines the schema and owns the underlying IndexedDB connection:

```ts
import type { DB } from "@serve-tools/client-db";
import { listen } from "@serve-tools/client-shared-db/scope/shared-worker";

const server = listen<{
	users: DB.Store<{ id: string; name: string }, string>;
}>("app", {
	version: 1,
	upgrade(database, { oldVersion }) {
		if (oldVersion < 1) database.createObjectStore("users", { keyPath: "id" });
	},
});

export type AppSchema = listen.SchemaType<typeof server>;
```

## Change subscriptions

The client can additionally subscribe to committed changes.
`onReady` confirms that the remote subscription is registered before the initial query begins:

```ts
import { connect } from "@serve-tools/client-shared-db/scope/window";
import type { AppSchema } from "./database-worker.js";

const worker = new SharedWorker(new URL("./database-worker.js", import.meta.url), { type: "module" });
const database = connect<AppSchema>(worker.port);
const ready = Promise.withResolvers<number>();

const changes = database.subscribe("users", console.log, {
	onReady: ready.resolve,
	onError: ready.reject,
});

await ready.promise;
const users = await database.getAll("users");

addEventListener(
	"pagehide",
	() => {
		changes.unsubscribe();
		database.close();
		worker.port.close();
	},
	{ once: true },
);
```

### Change semantics

`add` emits an `added` record.
A single-key `delete` emits `removed`.
`put` emits a key-scoped `invalidated` record because it cannot distinguish insertion from replacement without another read.
Range deletion and `clear` invalidate the whole store.
Every change is emitted after commit and carries a revision that increases for the lifetime of that worker.
Reconnecting after a worker restart requires a fresh query.

`onReady` runs after the database opens and the remote subscription is registered.
A reactive adapter can wait for it, start its initial query, buffer changes received while that query is pending, and rerun when an invalidation makes the snapshot stale.
This package delivers occurrences; it does not expose Signals or a `watch` API itself.

The remote client intentionally omits transactions and scans because callbacks, transaction handles, and async iterators do not retain their native semantics across a message boundary.
Native `IDBKeyRange` arguments to point operations are encoded and reconstructed automatically.

Only mutations routed through the worker produce changes.
Direct IndexedDB access from another connection bypasses the feed.
Once passed to `connect()`, the port is protocol-owned and must not carry unrelated messages.
Closing the client does not close the port; the page that created the `SharedWorker` remains responsible for it.

## Public API

The package exports shared declarations from its root entrypoint and runtime operations from scope-specific entrypoints:

- `@serve-tools/client-shared-db/scope/shared-worker` exports `listen`, which opens and owns one database inside a `SharedWorker`, then serves every connecting port.
- `@serve-tools/client-shared-db/scope/window` exports `connect`, which creates a typed point-operation client for one `MessagePort`.
- `SharedDBClient`, `SharedDBServer`, and `SharedDBSubscription` describe the corresponding disposable resources.
- `SchemaType` extracts the schema retained by the result of `listen<Schema>()`.
- `SharedDBChange`, `SharedDBSubscriber`, and `SharedDBSubscribeOptions` describe post-commit change delivery.

## Compatibility

The package is an ES module for browser windows and shared workers that provide IndexedDB, `SharedWorker`, `MessagePort`, structured clone, and `AbortSignal`.
It does not install browser APIs in Node.js.
Using `await using` for cleanup additionally requires `Symbol.dispose` support or a compatible polyfill.

The subscription protocol cannot reliably detect every abruptly destroyed tab; applications that require crash detection should add a heartbeat policy.

The examples above are covered by the package's TypeScript fixture and native browser integration test.

## Agent Skill

This package includes `skills/serve-tools-client-shared-db/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs the native SharedWorker integration test in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/client-shared-db
```

Run the opt-in Chromium benchmarks for SharedWorker database round trips and multi-client change fanout with:

```shell
npm run benchmark --workspace @serve-tools/client-shared-db
```

Benchmark results report warmup-separated mean, median, p95, and operations per second.
They are descriptive measurements and do not impose environment-sensitive pass/fail thresholds.

## License

[MIT-0](./LICENSE.md)
