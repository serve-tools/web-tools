# @serve-tools/polyfill-request-idle-callback

Installs the `requestIdleCallback` and `cancelIdleCallback` globals while preserving native implementations when both
functions are already available.

## Install

```sh
npm install @serve-tools/polyfill-request-idle-callback
```

## Recipes

### Install both globals

Import the package for its side effects to install both functions:

```js
import "@serve-tools/polyfill-request-idle-callback";

const handle = requestIdleCallback((deadline) => {
	while (deadline.timeRemaining() > 0) {
		break;
	}
});

cancelIdleCallback(handle);
```

This package intentionally declares `sideEffects: true`. Do not remove its imports as unused.

### Install individual globals

Import a `./apply/*` subpath to install only the function an application needs:

```js
import "@serve-tools/polyfill-request-idle-callback/apply/requestIdleCallback";
import "@serve-tools/polyfill-request-idle-callback/apply/cancelIdleCallback";
```

Each installer is self-guarding and leaves an existing native implementation unchanged.

### Import without global mutation

The matching top-level subpaths export a bound native implementation when it is available and otherwise export the
fallback without installing a global:

```ts
import { requestIdleCallback } from "@serve-tools/polyfill-request-idle-callback/requestIdleCallback";
import { cancelIdleCallback } from "@serve-tools/polyfill-request-idle-callback/cancelIdleCallback";
```

The global, selective, and mutation-free import patterns above are covered by the package's TypeScript fixture and
runtime tests.

## Relationship to the ponyfill

This package uses [`@serve-tools/ponyfill-request-idle-callback`](../../ponyfill/request-idle-callback/) as its fallback
implementation and integrates it with native globals. Use the ponyfill directly when global mutation is not wanted and
native identity is not required.

## Compatibility

The package is an ES module for browser windows with `document`, `performance`, `MessageChannel`, and
`requestAnimationFrame`. It preserves existing native functions and fills only missing globals. The fallback cannot
observe the browser's internal rendering or input queues, so its deadline is an approximation rather than a native idle
period.

## Development

```sh
npm run typecheck --workspace @serve-tools/polyfill-request-idle-callback
npm test --workspace @serve-tools/polyfill-request-idle-callback
npm run build --workspace @serve-tools/polyfill-request-idle-callback
```

## License

[MIT-0](./LICENSE.md)
