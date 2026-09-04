# @serve-tools/polyfill-observable

The `@serve-tools/polyfill-observable` package installs missing `Observable` and `Subscriber` interface objects and `EventTarget.prototype.when()` while preserving existing native values.
Its fallback comes from [`@serve-tools/ponyfill-observable`](../../ponyfills/observable/).

```ts
import "@serve-tools/polyfill-observable";

const result = document.when("click").take(1).toArray();

result.then(([event]) => console.log(event.target));
```

## Status

The bundled `0.0.x` fallback is an intentional cold Observable subset, not a complete implementation of the evolving Web Observable proposal.
Every fallback consumption starts a fresh execution, with the cancellation, cleanup, supported-source, and operator limits documented by the ponyfill package.
A selected native implementation can have different behavior from that fallback as the platform proposal changes.
Do not present this package as guaranteeing proposal fidelity across native and fallback environments.

## Install

```shell
npm install @serve-tools/polyfill-observable
```

## Usage

Import the package before code that expects all three platform hooks:

```ts
import "@serve-tools/polyfill-observable";

const controller = new AbortController();
const clicks = document.when("click");

clicks.subscribe(console.log, { signal: controller.signal });
controller.abort();
```

Each missing property is installed independently as writable, configurable, and non-enumerable.
The Observable, Subscriber, and EventTarget method selections are independent, so a partial native implementation can be combined with fallbacks whose semantics or brands differ.
Existing non-null values and their descriptors are never replaced or validated, including non-callable application sentinels.
Importing the root more than once is idempotent.
If `EventTarget` is unavailable, the package still installs the two global interface objects and skips the prototype method without throwing.

When `EventTarget.prototype.when` is missing, its adapter constructs results with the native-aware `Observable` selection.
This keeps `target.when(type) instanceof globalThis.Observable` true when a native `Observable` exists but the EventTarget method does not.
An existing native method is preserved and exported by exact identity.

## Selective and mutation-free imports

Use a granular side-effect entry when only one missing hook should be installed:

```ts
import "@serve-tools/polyfill-observable/apply/Observable";
import "@serve-tools/polyfill-observable/apply/Subscriber";
import "@serve-tools/polyfill-observable/apply/EventTarget/when";
```

Use the corresponding native-aware export without changing the global environment:

```ts
import { Observable } from "@serve-tools/polyfill-observable/Observable";
import { Subscriber } from "@serve-tools/polyfill-observable/Subscriber";
import { when } from "@serve-tools/polyfill-observable/EventTarget/when";

const events = when.call(new EventTarget(), "ready");
```

The exported selections are captured when their modules are first evaluated.
Use [`@serve-tools/ponyfill-observable`](../../ponyfills/observable/) directly when the documented cold fallback is required regardless of native availability, or when its exported input, observer, and listener-option types are needed.

## Agent Skill

This package includes `skills/serve-tools-polyfill-observable/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/polyfill-observable
npm test --workspace @serve-tools/polyfill-observable
npm run build --workspace @serve-tools/polyfill-observable
npm run check:package --workspace @serve-tools/polyfill-observable
```

## License

[MIT-0](./LICENSE.md)
