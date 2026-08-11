# @serve-tools/client-storage

Observable access to local and session storage.

`Storage` presents collection-style reads and writes over `localStorage` or `sessionStorage`, and delivers precise
change records for local mutations and changes from other documents.

## Install

```sh
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

Instances use the current window's local storage by default. Pass `"session"` for session storage or a `Window` as the
second argument when working with another browsing context.

### Read and write

```ts
const theme = storage.get("theme"); // "light" | "dark" | null
const hasToken = storage.has("token");

storage.set("theme", "dark");
storage.delete("token");

console.log(storage.size);
storage.clear();
```

`set`, `delete`, and `clear` return whether storage changed. Setting a value to `null` removes it. Values remain strings,
matching the Web Storage platform API; the schema supplies key names and narrower string types without serialization.

The underlying platform object is available as `storage.source`. Storage access can still throw the platform's security
or quota exceptions.

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
Writes made directly to the underlying `localStorage` or `sessionStorage` in the same document do not emit a platform
event; use the wrapper when local observation matters.

Added, updated, and removed records include the exact value delta. A clear event invalidates every key observed when the
event began because the platform event does not identify individual cleared keys. Subscribers run in registration order
from a snapshot. Unsubscribing is idempotent, and an already-aborted signal does not create a subscription.

If a subscriber throws, all other active subscribers still run. One error is rethrown by identity; multiple errors are
combined in delivery order in an `AggregateError`. The storage mutation has already committed when the error is thrown.

## Compatibility

The package is an ES module for browser windows with the Web Storage API. It requires a `Window` because subscriptions
combine wrapper-local changes with that window's cross-document `storage` events; workers do not expose this API.
Storage availability, persistence, quota, and privacy behavior remain controlled by the browser and may vary in private
browsing or restricted third-party contexts.

The recipes above are covered by the package's TypeScript fixtures in addition to its browser integration tests.

## Public API

- `Storage` provides `size`, `get`, `has`, `set`, `delete`, `clear`, and `subscribe`.
- `StorageChange` describes added, updated, removed, and invalidated keys.
- `StorageSubscriber` and `StorageSubscribeOptions` describe subscription callbacks and cancellation.
- `StorageKey` and `StorageValue` project keys and values from an application schema.
- `Storage.Schema` is the unrestricted string-keyed schema.

## Demo

The [`demo`](./demo) workspace demonstrates local and session values, same-document subscriptions, deletion, and clear
invalidation:

```sh
npm run build --workspace @serve-tools/client-storage
npm run dev --workspace @serve-tools/client-storage-demo
```

## Development

The default test command runs unit tests and native Web Storage integration tests in Chromium, Firefox, and WebKit.

```sh
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/client-storage
```

## License

[MIT-0](./LICENSE.md)
