# @serve-tools/polyfill-resource-management

The `@serve-tools/polyfill-resource-management` package implements [ECMAScript Explicit Resource Management](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-disposable-stack-objects), which reached [TC39 Stage 4](https://github.com/tc39/proposals/blob/main/finished-proposals.md) in May 2026, by installing missing globals while preserving existing native implementations.

```js
import "@serve-tools/polyfill-resource-management";

const stack = new DisposableStack();
stack.defer(() => console.log("disposed"));
stack.dispose();
```

## Install

```shell
npm install @serve-tools/polyfill-resource-management
```

## Recipes

### Install every global

Import the package for its side effects to install every supported global, as shown above.

This package intentionally declares `sideEffects: true`.
Do not remove its imports as unused.

### Install individual globals

Import a `./apply/*` subpath to install only the globals an application needs:

```js
import "@serve-tools/polyfill-resource-management/apply/Symbol/dispose";
import "@serve-tools/polyfill-resource-management/apply/DisposableStack";
```

Available global installers are:

- `apply/Symbol/dispose`
- `apply/Symbol/asyncDispose`
- `apply/DisposableStack`
- `apply/AsyncDisposableStack`
- `apply/SuppressedError`

Each installer is self-guarding and leaves an existing native implementation unchanged.

### Import without global mutation

The matching top-level subpaths export the native implementation when it is available and otherwise export the fallback without installing a global:

```ts
import { DisposableStack } from "@serve-tools/polyfill-resource-management/DisposableStack";
import { dispose } from "@serve-tools/polyfill-resource-management/Symbol/dispose";
```

These subpaths are useful when an application wants native identity where available but cannot mutate the global environment.

The global, selective, and mutation-free import patterns above are covered by the package's TypeScript fixtures and runtime tests.

## Relationship to the ponyfill

This package shares its fallback contract with [`@serve-tools/ponyfill-resource-management`](../../ponyfills/resource-management/), then integrates with native disposal symbols and globals.
Use the ponyfill instead when module-scoped symbols are preferred.

The package installs runtime APIs; it does not transform `using` or `await using` syntax.

## Compatibility

The package is an ES module for JavaScript runtimes with `globalThis`, `Symbol`, and promises.
It can run in browsers, workers, and Node.js, preserves any native implementations it finds, and fills only missing globals.
A compiler or runtime must separately understand `using` and `await using` syntax.

## Agent Skill

This package includes `skills/serve-tools-polyfill-resource-management/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/polyfill-resource-management
npm test --workspace @serve-tools/polyfill-resource-management
npm run build --workspace @serve-tools/polyfill-resource-management
```

## License

[MIT-0](./LICENSE.md)
