# @serve-tools/rolldown-decorators

The `@serve-tools/rolldown-decorators` package transforms modern TC39 decorator syntax in Rolldown and Vite projects.

```ts
import { defineConfig } from "rolldown";
import { rolldownDecorators } from "@serve-tools/rolldown-decorators";

export default defineConfig({
	plugins: [rolldownDecorators()],
});
```

## Install

```shell
npm install --save-dev @serve-tools/rolldown-decorators
```

The package transforms Oxc's parsed AST directly and uses `@jsxtools/rolldown-transform` for a transform hook that works in both Rolldown and Vite.
It does not invoke Babel or the TypeScript compiler.

## Vite

Use the same plugin without a Vite-specific adapter:

```ts
import { defineConfig } from "vite";
import { rolldownDecorators } from "@serve-tools/rolldown-decorators";

export default defineConfig({
	plugins: [rolldownDecorators()],
});
```

The transform hook runs before the host's built-in syntax transform.
It parses JavaScript, JSX, TypeScript, and TSX, lowers decorators, and leaves unrelated TypeScript and JSX syntax for Rolldown or Vite to process normally.

## Decorator contract

The plugin implements the current standards-track decorator contract.
It does not enable or accept TypeScript's legacy `experimentalDecorators` semantics.

Modern decorators receive `(value, context)` and support:

- class declarations, fields, methods, getters, setters, and auto-accessors;
- public, private, static, instance, and computed members;
- decorator composition and proposal-defined evaluation/application order;
- `context.access`, `context.addInitializer()`, and `context.metadata`;
- class and member replacement values and field/accessor initializer transforms.

Decorated class expressions are not transformed yet; write a decorated class declaration instead.

The plugin exposes its package-owned helper implementation to the bundler through an internal virtual module, so applications do not install or configure a separate runtime.
The runtime imports the focused `@serve-tools/polyfill-decorator-metadata` installer, which preserves a native `Symbol.metadata` or installs the proposal symbol when it is missing.

## Deterministic behavior

The transform reads decorator, class, and member nodes from Oxc's AST and applies range edits through Rolldown's native MagicString implementation.
Project Babel and TypeScript transformer configuration cannot alter its decorator semantics.

Only modules containing actual decorator AST nodes are changed.
An `@` inside a string, comment, CSS file, or other non-script module does not trigger output rewriting.
The transform returns a source map for host-level map chaining.

## TypeScript

The plugin transpiles syntax but does not type-check it.
Run TypeScript separately with `tsc --noEmit` or the project's existing type-check command.
Do not set `experimentalDecorators`; standard decorators are TypeScript's default decorator model.

## Public API

- `rolldownDecorators()` creates the cross-compatible transform plugin.
- `RolldownDecoratorsPlugin` describes its stable plugin shape.

## Agent Skill

This package includes `skills/serve-tools-rolldown-decorators/SKILL.md` with version-aligned consumer guidance.
Activation is explicit; installing the package does not automatically trust or enable it.

## Development

```shell
npm run typecheck --workspace @serve-tools/rolldown-decorators
npm test --workspace @serve-tools/rolldown-decorators
npm run build --workspace @serve-tools/rolldown-decorators
```

## License

[MIT-0](./LICENSE.md)
