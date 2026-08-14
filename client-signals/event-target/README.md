# @serve-tools/signal-event-target

The `@serve-tools/signal-event-target` package observes current `EventTarget` state as read-only TC39 Signals.

```ts
import { EventTargetSignal } from "@serve-tools/signal-event-target";

const visibility = new EventTargetSignal(document, "visibilitychange", () => document.visibilityState);

visibility.get(); // "visible" or "hidden"
```

## Install

```shell
npm install @serve-tools/signal @serve-tools/signal-event-target
```

## Event target state

`EventTargetSignal` reads its initial value synchronously, listens eagerly for one event type, and rereads the value after each matching event.
It presents that state through a read-only `Signal.Computed` façade, so consumers cannot replace source-owned state with `set()`.

```ts
const online = new EventTargetSignal(window, "online", () => navigator.onLine);

online.get();

online.refresh(); // synchronously reread navigator.onLine
online.dispose(); // stop observing and freeze the last value
```

The callback should read durable current state from the target or related platform object.
This API is not an event queue: Signal consumers may coalesce event occurrences, and equal values do not invalidate dependents.
Use `addEventListener()` directly when every occurrence or event payload must be processed.

Pass `equals` to define the state invalidation boundary.

```ts
const selection = new EventTargetSignal(document, "selectionchange", () => document.getSelection()?.toString() ?? "", {
	equals: (left, right) => left === right,
});
```

## Media queries

`MatchMediaSignal` specializes the event-target adapter for `matchMedia()`.
It retains the exact input as `query` and exposes its `MediaQueryList` as the narrowed `target`.

```ts
import { MatchMediaSignal } from "@serve-tools/signal-event-target";

const dark = new MatchMediaSignal("(prefers-color-scheme: dark)");

dark.query; // "(prefers-color-scheme: dark)"
dark.target; // MediaQueryList
dark.get(); // boolean
```

## Lifecycle and cancellation

Every observation owns exactly one listener.
Calling `dispose()` or `Symbol.dispose` removes only that observation, is idempotent, and freezes its last value.
`refresh()` becomes a no-op after disposal.

An optional external `AbortSignal` can cancel one observation or intentionally group several without transferring controller ownership.

```ts
const controller = new AbortController();
const reducedMotion = new MatchMediaSignal("(prefers-reduced-motion: reduce)", {
	signal: controller.signal,
});
const highContrast = new MatchMediaSignal("(prefers-contrast: more)", {
	signal: controller.signal,
});

controller.abort(); // disposes both observations
```

An already-aborted signal still permits the required initial read, but no listener is installed.
Disposal and cancellation do not abort a caller-owned controller or affect independently created observations.

## Public API

- `EventTargetSignal<Value>` eagerly observes current state refreshed by one event type.
- `EventTargetSignalOptions<Value>` configures equality and external cancellation.
- `MatchMediaSignal<Query>` observes whether one media query currently matches.
- `active` reports whether an observation can still refresh.
- `refresh()` rereads active state synchronously.
- `dispose()` and `Symbol.dispose` stop observation and freeze the last value.

## Compatibility

The package is an ES module for modern runtimes with `EventTarget` and a compatible `@serve-tools/signal` installation.
`MatchMediaSignal` additionally requires the browser `matchMedia()` and `MediaQueryList` APIs.
Explicit resource management requires `Symbol.dispose` support or a compatible polyfill; `dispose()` is always available.

## Agent Skill

This package includes `skills/serve-tools-signal-event-target/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

The default test command runs EventTarget tests in Node.js and current Playwright releases of Chromium, Firefox, and WebKit.

```shell
npm test --workspace @serve-tools/signal-event-target
```

Run the opt-in Chromium benchmarks with:

```shell
npm run benchmark --workspace @serve-tools/signal-event-target
```

## License

[MIT-0](./LICENSE.md)
