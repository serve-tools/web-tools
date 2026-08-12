# @serve-tools/polyfill-request-idle-callback

The `@serve-tools/polyfill-request-idle-callback` package implements APIs from the [W3C `requestIdleCallback` Working Draft](https://www.w3.org/TR/requestidlecallback/) by installing missing globals while preserving existing native implementations.

```js
import "@serve-tools/polyfill-request-idle-callback";

const handle = requestIdleCallback(() => console.log("idle"));

cancelIdleCallback(handle);
```

## Install

```shell
npm install @serve-tools/polyfill-request-idle-callback
```

## Recipes

### Install both globals

Import the package for its side effects to install both functions.

This package intentionally declares `sideEffects: true`.
Do not remove its imports as unused.

### Install individual globals

Import a `./apply/*` subpath to install only the function an application needs:

```js
import "@serve-tools/polyfill-request-idle-callback/apply/requestIdleCallback";
import "@serve-tools/polyfill-request-idle-callback/apply/cancelIdleCallback";
```

Each installer is self-guarding and leaves an existing native implementation unchanged.

### Import without global mutation

The matching top-level subpaths export a bound native implementation when it is available and otherwise export the fallback without installing a global:

```ts
import { requestIdleCallback } from "@serve-tools/polyfill-request-idle-callback/requestIdleCallback";
import { cancelIdleCallback } from "@serve-tools/polyfill-request-idle-callback/cancelIdleCallback";
```

The global, selective, and mutation-free import patterns above are covered by the package's TypeScript fixture and runtime tests.

## Relationship to the ponyfill

This package uses [`@serve-tools/ponyfill-request-idle-callback`](../../ponyfills/request-idle-callback/) as its fallback implementation and integrates it with native globals.
Use the ponyfill directly when global mutation is not wanted and native identity is not required.

## Compatibility

The package is an ES module for browser windows with `document`, `performance`, `MessageChannel`, and `requestAnimationFrame`.
It preserves existing native functions and fills only missing globals.
The fallback cannot observe the browser's internal rendering or input queues, so its deadline is an approximation rather than a native idle period.

## Agent Skill

This package includes `skills/serve-tools-polyfill-request-idle-callback/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/polyfill-request-idle-callback
npm test --workspace @serve-tools/polyfill-request-idle-callback
npm run build --workspace @serve-tools/polyfill-request-idle-callback
```

## License

[MIT-0](./LICENSE.md)
