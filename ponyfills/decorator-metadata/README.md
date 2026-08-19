# `@serve-tools/ponyfill-decorator-metadata`

The `@serve-tools/ponyfill-decorator-metadata` package provides a stable module-scoped symbol for the [Decorator Metadata proposal](https://github.com/tc39/proposal-decorator-metadata) without reading or modifying `Symbol.metadata`.

```ts
import { metadata } from "@serve-tools/ponyfill-decorator-metadata";

class Example {
	static [metadata] = { component: true };
}

Example[metadata].component; // true
```

## Install

```shell
npm install @serve-tools/ponyfill-decorator-metadata
```

## Public API

- `metadata`: a module-scoped `Symbol("Symbol.metadata")` value.
- `./lib/Symbol/metadata`: the focused subpath exporting the same symbol identity.

The exported symbol is intentionally distinct from a native or polyfilled `Symbol.metadata`.
Use it when both producers and consumers can explicitly import the same symbol.
Use [`@serve-tools/polyfill-decorator-metadata`](../../polyfills/decorator-metadata/) when TypeScript, a decorator transform, or third-party code looks up the global `Symbol.metadata` property.

This package supplies the proposal's symbol key only.
Creating `context.metadata`, attaching it to decorated classes, and implementing metadata inheritance remain the responsibility of the decorator runtime or transform.

## Compatibility

The package is an ES module for JavaScript runtimes with `Symbol`, including browsers, workers, and Node.js.

## Agent Skill

This package includes `skills/serve-tools-ponyfill-decorator-metadata/SKILL.md` with version-aligned usage guidance for compatible coding agents.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/ponyfill-decorator-metadata
npm test --workspace @serve-tools/ponyfill-decorator-metadata
npm run build --workspace @serve-tools/ponyfill-decorator-metadata
npm run check:package --workspace @serve-tools/ponyfill-decorator-metadata
```

## License

[MIT-0](./LICENSE.md)
