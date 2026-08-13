# @serve-tools/signal-storage

The `@serve-tools/signal-storage` package adds signal-backed watches to the typed, observable Web Storage client from `@serve-tools/client-storage`.

```ts
import { SignalStorage } from "@serve-tools/signal-storage";

const storage = new SignalStorage<{ theme: "dark" | "light" }>();
const theme = storage.watch("theme");

storage.set("theme", "dark");

console.log(theme.get()); // "dark"
```

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-storage
```

## Typed storage

Describe the keys and their string values once.
The schema exists only in TypeScript and adds nothing at runtime.

```ts
import { SignalStorage } from "@serve-tools/signal-storage";

interface AppStorage {
	theme: "dark" | "light";
	token: string;
}

const storage = new SignalStorage<AppStorage>();

storage.set("theme", "dark");
storage.get("theme"); // "dark" | "light" | null
storage.has("theme"); // true
storage.delete("theme"); // true
```

Pass `session` to use `sessionStorage` instead, or a separate window to handle different browsing contexts.

```ts
const session = new SignalStorage<AppStorage>("session", window.top);
```

## Change subscriptions

`subscribe` synchronously delivers every change occurrence for one key.
It receives writes made through the wrapper in the current document and native `storage` events from other documents using the same storage area.

```ts
const unsubscribe = storage.subscribe("theme", (change) => {
	switch (change.kind) {
		case "added":
		case "updated":
			console.log(change.value);
	}
});

storage.set("theme", "light");

unsubscribe();
```

Changes are discriminated as `added`, `updated`, `removed`, or `invalidated`.
An invalidation means the current value should be read again.
Unchanged writes do not notify subscribers.
Subscriptions are removed explicitly with the returned function or automatically with an `AbortSignal`.

Each occurrence uses a registration-order snapshot.
A subscriber added during delivery waits until the next occurrence; a subscriber removed before its turn is skipped.
If callbacks fail, every later active subscriber still runs.
After delivery, one error is rethrown unchanged, while multiple errors are reported in delivery order in an `AggregateError`.
Writes made through `set` or `delete` are committed before callback errors surface.

```ts
const controller = new AbortController();

storage.subscribe("token", updateAuthentication, { signal: controller.signal });
controller.abort();
```

The package listens for the global `storage` event only while at least one subscription or watch is active and filters events by storage area.
Native clear events do not identify individual keys, so they invalidate every actively observed key.

## Reactive watches

`watch` returns a read-only computed signal containing the current value.
Known changes apply their exact deltas without rereading storage.
Invalidations and explicit `refresh()` calls reread storage synchronously.
Signal consumers may coalesce intermediate changes and observe only the latest value; use `subscribe` when every occurrence matters.

```ts
const theme = storage.watch("theme");

theme.get(); // "dark" | "light" | null

storage.set("theme", "light");

theme.get(); // "light"

storage.source.setItem("theme", "dark");

theme.get(); // still "light"

theme.refresh();

theme.get(); // "dark"

theme.dispose();
```

Direct same-document writes through `source` do not emit a `storage` event in that document, so call `refresh()` to make them visible to an active watch.
Call `dispose()` or `Symbol.dispose` to stop following storage changes.
Disposal is idempotent; a disposed signal retains its last observed value, and later refreshes are no-ops.

## Public API

- `SignalStorage` extends `@serve-tools/client-storage` with `watch()` while preserving `size`, `get`, `has`, `set`, `delete`, `clear`, `subscribe`, `source`, and `target`.
- `StorageSignal<Value>` is a read-only computed signal with synchronous `refresh()` and terminal `dispose()` methods.
- `SignalStorage.Schema` is the unrestricted string-keyed schema.
- `StorageChange`, `StorageSubscriber`, `StorageSubscribeOptions`, `StorageKey`, and `StorageValue` are re-exported from `@serve-tools/client-storage`.

## Compatibility

The package is an ES module for browser windows with Web Storage and a compatible `@serve-tools/signal` installation.
Storage availability, persistence, quota, and privacy behavior remain controlled by the browser.
Explicit resource management requires `Symbol.dispose` support or a compatible polyfill; `dispose()` is always available.

## Agent Skill

This package includes `skills/serve-tools-signal-storage/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs native Web Storage tests in Chromium, Firefox, and WebKit.

```shell
npx playwright install chromium firefox webkit
npm test --workspace @serve-tools/signal-storage
```

Run the opt-in Chromium benchmarks for watch lifecycle, change fanout, sparse updates, and refresh with:

```shell
npm run benchmark --workspace @serve-tools/signal-storage
```

## License

[MIT-0](./LICENSE.md)
