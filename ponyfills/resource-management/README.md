# @serve-tools/ponyfill-resource-management

The `@serve-tools/ponyfill-resource-management` package implements [ECMAScript Explicit Resource Management](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-disposable-stack-objects), which reached [TC39 Stage 4](https://github.com/tc39/proposals/blob/main/finished-proposals.md) in May 2026, without modifying the global environment.

```ts
import { DisposableStack } from "@serve-tools/ponyfill-resource-management";

const stack = new DisposableStack();

stack.defer(() => console.log("disposed"));
stack.dispose();
```

## Install

```shell
npm install @serve-tools/ponyfill-resource-management
```

## Recipes

### Dispose a resource stack

```ts
import {
	DisposableStack,
	dispose,
} from "@serve-tools/ponyfill-resource-management";

const stack = new DisposableStack();

stack.use({
	[dispose]() {
		console.log("disposed");
	},
});

stack.dispose();
```

Adopt values that do not implement the disposal protocol by supplying a cleanup callback:

```ts
const stack = new DisposableStack();
const controller = stack.adopt(new AbortController(), (value) => value.abort());

// Use controller...
stack.dispose();
```

`AsyncDisposableStack` accepts resources keyed by `asyncDispose` and falls back to `dispose` for synchronous resources.
Both stack classes dispose resources in reverse registration order and combine multiple failures with `SuppressedError`.

These synchronous and asynchronous stack patterns are covered by the package's TypeScript fixtures and runtime tests.

## Exports

- `dispose` and `asyncDispose`: stable symbols scoped to this module.
- `Disposable` and `AsyncDisposable`: TypeScript resource interfaces.
- `DisposableStack` and `AsyncDisposableStack`: resource stack implementations.
- `SuppressedError`: an error that preserves multiple disposal failures.

The root entrypoint exports the complete API.
Individual declarations can also be imported from `./lib/*` subpaths, such as `@serve-tools/ponyfill-resource-management/lib/DisposableStack`.

## Ponyfill boundary

The exported symbols are intentionally created with `Symbol()` and are not stored in the global symbol registry.
They are distinct from native `Symbol.dispose` and `Symbol.asyncDispose`, so resources used with this package must use the exported symbols.

The package does not install globals or transform `using` and `await using` syntax.
Use native Explicit Resource Management when native symbol identity or syntax integration is required.

## Compatibility

The package is an ES module for JavaScript runtimes with `Symbol` and promises, including browsers, workers, and Node.js.
It does not depend on native explicit resource management, but its module-scoped symbols intentionally do not interoperate with native `using` declarations or objects keyed by native disposal symbols.

## Agent Skill

This package includes `skills/serve-tools-ponyfill-resource-management/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/ponyfill-resource-management
npm test --workspace @serve-tools/ponyfill-resource-management
npm run build --workspace @serve-tools/ponyfill-resource-management
```

## License

[MIT-0](./LICENSE.md)
