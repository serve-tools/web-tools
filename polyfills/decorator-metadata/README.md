# @serve-tools/polyfill-decorator-metadata

The `@serve-tools/polyfill-decorator-metadata` package installs the `Symbol.metadata` key required by the [Decorator Metadata proposal](https://github.com/tc39/proposal-decorator-metadata) while preserving an existing native symbol.

```ts
import "@serve-tools/polyfill-decorator-metadata";

Symbol.metadata; // Symbol(Symbol.metadata)
```

## Install

```shell
npm install @serve-tools/polyfill-decorator-metadata
```

## Usage

### Install every global

Import the package for its side effects to install every supported global, as shown above.

This package intentionally declares `sideEffects: true`.
Do not remove its imports as unused.

### Install individual globals

Import a `./apply/*` subpath to install only the globals an application needs:

```js
import "@serve-tools/polyfill-decorator-metadata/apply/Symbol/metadata";
```

Available global installers are:

- `apply/Symbol/metadata`

Each installer is self-guarding and leaves an existing native implementation unchanged.

### Import without global mutation

The matching top-level subpaths export the native implementation when it is available and otherwise export the fallback without installing a global:

```ts
import { metadata } from "@serve-tools/polyfill-decorator-metadata/Symbol/metadata";

class Example {
	static [metadata] = { component: true };
}
```

These subpaths are useful when an application wants native identity where available but cannot mutate the global environment.

The global, selective, and mutation-free import patterns above are covered by the package's TypeScript fixtures and runtime tests.

## Public API

- The package root installs every missing Decorator Metadata global.
- `./apply/Symbol/metadata` installs `Symbol.metadata` when it is missing.
- The matching top-level subpaths export native values when available and module-scoped fallbacks otherwise without changing globals.

This package supplies the proposal's symbol key only.
A decorator-capable runtime or transform must still create `context.metadata`, attach the metadata object to decorated classes, and implement metadata inheritance.
Load the global installer before modules containing transformed decorators when their emitted runtime looks up `Symbol.metadata`.

## Relationship to the ponyfill

This package shares its fallback symbol with [`@serve-tools/ponyfill-decorator-metadata`](../../ponyfills/decorator-metadata/), then integrates it with the native `Symbol` constructor.
Use the ponyfill instead when module-scoped symbols are preferred.

## Compatibility

The package is an ES module for JavaScript runtimes with `Symbol`.
It can run in browsers, workers, and Node.js, preserves any native implementations it finds, and fills only missing globals.

## Agent Skill

This package includes `skills/serve-tools-polyfill-decorator-metadata/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/polyfill-decorator-metadata
npm test --workspace @serve-tools/polyfill-decorator-metadata
npm run build --workspace @serve-tools/polyfill-decorator-metadata
npm run check:package --workspace @serve-tools/polyfill-decorator-metadata
```

## License

[MIT-0](./LICENSE.md)
