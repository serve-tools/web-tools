# @serve-tools/polyfill-resource-management

Installs globals for
[ECMAScript Explicit Resource Management](https://tc39.es/proposal-explicit-resource-management/).
The package supplies missing disposal symbols, stack constructors, and
`SuppressedError` while preserving native implementations.

## Install

```sh
npm install @serve-tools/polyfill-resource-management
```

## Recipes

### Install every global

Import the package for its side effects to install every supported global:

```js
import "@serve-tools/polyfill-resource-management";

const stack = new DisposableStack();
```

This package intentionally declares `sideEffects: true`. Do not remove its
imports as unused.

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

Each installer is self-guarding and leaves an existing native implementation
unchanged.

### Import without global mutation

The matching top-level subpaths export the native implementation when it is
available and otherwise export the fallback without installing a global:

```ts
import { DisposableStack } from "@serve-tools/polyfill-resource-management/DisposableStack";
import { dispose } from "@serve-tools/polyfill-resource-management/Symbol/dispose";
```

These subpaths are useful when an application wants native identity where
available but cannot mutate the global environment.

The global, selective, and mutation-free import patterns above are covered by
the package's TypeScript fixtures and runtime tests.

## Relationship to the ponyfill

This package shares its fallback contract with
[`@serve-tools/ponyfill-resource-management`](../../ponyfill/resource-management/),
then integrates with native disposal symbols and globals. Use the ponyfill
instead when module-scoped symbols are preferred.

The package installs runtime APIs; it does not transform `using` or
`await using` syntax.

## Compatibility

The package is an ES module for JavaScript runtimes with `globalThis`, `Symbol`,
and promises. It can run in browsers, workers, and Node.js, preserves any native
implementations it finds, and fills only missing globals. A compiler or runtime
must separately understand `using` and `await using` syntax.

## Development

```sh
npm run typecheck --workspace @serve-tools/polyfill-resource-management
npm test --workspace @serve-tools/polyfill-resource-management
npm run build --workspace @serve-tools/polyfill-resource-management
```

## License

[MIT-0](./LICENSE.md)
