# @serve-tools/client-storage

The `@serve-tools/client-storage` package provides typed, observable access to local and session storage.

```ts
import { Storage } from "@serve-tools/client-storage";

const storage = new Storage<{
	theme: "light" | "dark";
	token: string;
}>();

const theme = storage.get("theme"); // "light" | "dark" | null

storage.set("theme", "dark"); // true if changed, otherwise false

storage.has("token"); // true if present, otherwise false
storage.delete("token"); // true if deleted, false if not present
```

## Install

```shell
npm install @serve-tools/client-storage
```

## Recipes

### Define storage

```ts
import { Storage } from "@serve-tools/client-storage";

interface AppStorage {
	theme: "light" | "dark";
	token: string;
}

const storage = new Storage<AppStorage>();
const session = new Storage<AppStorage>("session");
```

Pass `session` to use `sessionStorage` instead, or a separate window to handle different browsing contexts.

```ts
const session = new Storage<AppStorage>("session", window.top);
```

### Read and write

```ts
const theme = storage.get("theme"); // "light" | "dark" | null
const hasToken = storage.has("token");

storage.set("theme", "dark");
storage.delete("token");

console.log(storage.size);
storage.clear();
```

`set`, `delete`, and `clear` return whether storage changed.
Setting a value to `null` removes it.
Values remain strings, matching the Web Storage platform API; the schema supplies key names and narrower string types without serialization.

The underlying platform object is available as `storage.source`.
Storage access can still throw the platform's security or quota exceptions.

### Subscribe to changes

```ts
const controller = new AbortController();

storage.subscribe(
	"theme",
	(change) => {
		switch (change.kind) {
			case "added":
			case "updated":
				console.log(change.value);
				break;
			case "removed":
				console.log(change.previous);
				break;
			case "invalidated":
				console.log(storage.get(change.key));
		}
	},
	{ signal: controller.signal },
);

controller.abort();
```

Subscriptions receive synchronous changes made through the same wrapper and `storage` events from other documents.
Writes made directly to the underlying `localStorage` or `sessionStorage` in the same document do not emit a platform event; use the wrapper when local observation matters.

Added, updated, and removed records include the exact value delta.
A clear event invalidates every key observed when the event began because the platform event does not identify individual cleared keys.
Subscribers run in registration order from a snapshot.
Unsubscribing is idempotent, and an already-aborted signal does not create a subscription.

If a subscriber throws, all other active subscribers still run.
One error is rethrown by identity; multiple errors are combined in delivery order in an `AggregateError`.
The storage mutation has already committed when the error is thrown.

## Compatibility

The package is an ES module for browser windows with the Web Storage API.
It requires a `Window` because subscriptions combine wrapper-local changes with that window's cross-document `storage` events; workers do not expose this API.
Storage availability, persistence, quota, and privacy behavior remain controlled by the browser and may vary in private browsing or restricted third-party contexts.

The recipes above are covered by the package's TypeScript fixtures in addition to its browser integration tests.

## Public API

- `Storage` provides `size`, `get`, `has`, `set`, `delete`, `clear`, and `subscribe`.
- `StorageChange` describes added, updated, removed, and invalidated keys.
- `StorageSubscriber` and `StorageSubscribeOptions` describe subscription callbacks and cancellation.
- `StorageKey` and `StorageValue` project keys and values from an application schema.
- `Storage.Schema` is the unrestricted string-keyed schema.

## Demo

The [`demo`](./demo) workspace demonstrates local and session values, same-document subscriptions, deletion, and clear invalidation:

[Try the demo in StackBlitz](https://stackblitz.com/fork/github/serve-tools/web-tools/tree/main/client/storage/demo)

The demo directory is standalone-importable and installs the published package when it is used outside this repository.
To run it against the local workspace package instead:

```shell
npm run build --workspace @serve-tools/client-storage
npm run dev --workspace @serve-tools/client-storage-demo
```

## Agent Skill

This package includes `skills/serve-tools-client-storage/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs unit tests and native Web Storage integration tests in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/client-storage
```

Run the opt-in Chromium benchmarks for native-relative wrapper overhead and subscription fanout with:

```shell
npm run benchmark --workspace @serve-tools/client-storage
```

Benchmark results report warmup-separated mean, median, p95, and operations per second.
They are descriptive measurements and do not impose environment-sensitive pass/fail thresholds.

## License

[MIT-0](./LICENSE.md)
