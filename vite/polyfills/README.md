# @serve-tools/vite-polyfills

A [Vite] plugin that detects unsupported JavaScript features in source files
and injects their polyfills only where they are needed.

The plugin parses each transformed module with Vite's OXC parser utilities and
walks the AST. When a polyfill matches, it prepends an import of a virtual
runtime module, so the polyfill ships once per build and Rollup can tree-shake
it out of chunks that do not use it.

## Install

```sh
npm install --save-dev @serve-tools/vite-polyfills
```

`vite` 8.2 is a peer dependency. Install it in the same project as this
plugin.

## Recipes

### Use the built-in polyfills

```ts
import { defineConfig } from "vite";
import { vitePolyfills } from "@serve-tools/vite-polyfills";

export default defineConfig({
	plugins: [vitePolyfills()],
});
```

## Built-in polyfills

| Id                       | Feature                                                                  |
| ------------------------ | ------------------------------------------------------------------------ |
| `symbol-dispose`         | `Symbol.dispose` well-known symbol                                       |
| `symbol-async-dispose`   | `Symbol.asyncDispose` well-known symbol                                  |
| `disposable-stack`       | Global `DisposableStack`                                                 |
| `async-disposable-stack` | Global `AsyncDisposableStack`                                            |
| `suppressed-error`       | Global `SuppressedError`                                                 |
| `url-pattern`            | Global `URLPattern`                                                      |
| `map-upsert`             | `Map.prototype.{getOrInsert, getOrInsertComputed}` and `WeakMap` equivs. |
| `request-idle-callback`  | Global `requestIdleCallback`                                             |
| `cancel-idle-callback`   | Global `cancelIdleCallback`                                              |

Detection matches member expressions like `Symbol.dispose` or
`cache.getOrInsert(...)`, plus global constructor references like
`new DisposableStack()` or `new URLPattern(...)`, and calls to
`requestIdleCallback(...)` or `cancelIdleCallback(...)`. References inside
string literals or comments are ignored because detection runs on the AST.

## TypeScript

Each built-in polyfill that augments a built-in interface ships an ambient
`.d.ts` file. Reference the barrel from any `.d.ts` in your project to opt into
all of them at once:

```ts
/// <reference types="@serve-tools/vite-polyfills/types" />
```

Or pick just the ones you use:

```ts
/// <reference types="@serve-tools/vite-polyfills/types/map-upsert" />
```

`Symbol.dispose`, `SuppressedError`, `DisposableStack`, and
`AsyncDisposableStack` are already covered by TypeScript's built-in disposable
libs. `requestIdleCallback` and `cancelIdleCallback` are covered by TypeScript's
DOM lib. Those polyfills do not need a separate reference.

### Extend the defaults with a custom polyfill

Pass a `polyfills` array to add your own, override built-ins, or disable the
defaults entirely. Use `definePolyfill` to get type checking for the polyfill
shape:

```ts
import { builtinPolyfills, definePolyfill, vitePolyfills } from "@serve-tools/vite-polyfills";

const myPolyfill = definePolyfill({
	id: "my-feature",
	code: `MyAPI.feature ||= () => { /* ... */ };`,
	detect: (found) => ({
		MemberExpression(node) {
			if (node.computed) return;
			if (node.object.type !== "Identifier" || node.object.name !== "MyAPI") return;
			if (node.property.type !== "Identifier" || node.property.name !== "feature") return;
			found();
		},
	}),
});

vitePolyfills({ polyfills: [...builtinPolyfills, myPolyfill] });
```

The `detect` callback receives a `found` signal and returns a Vite OXC visitor
object. Call `found()` from any visitor method that proves the polyfill is
needed.

Pass an empty array to disable all built-ins, or select only the definitions an
application wants:

```ts
vitePolyfills({
	polyfills: builtinPolyfills.filter(({ id }) => id === "url-pattern"),
});
```

The default, custom, and selective configurations above are covered by the
package's TypeScript fixtures and build tests.

## How it works

For each module Vite asks the plugin to transform, it:

1. Skips the file if it lives in `node_modules`, is a virtual module, or does
   not have a JS/TS extension (`.js`, `.cjs`, `.mjs`, `.jsx`, `.ts`, `.cts`,
   `.mts`, `.tsx`, optionally followed by a query string).
2. Parses the source through the OXC-backed transform pipeline.
3. Runs each registered polyfill's detection visitor against the parsed
   program.
4. Prepends `import "virtual:@serve-tools/vite-polyfill/<id>";` for every
   polyfill that matched.

Each virtual module is served from memory by the plugin's `load` hook and
contains a self-guarding runtime snippet that no-ops when the feature already
exists in the target environment.

## Compatibility

The plugin requires Vite 8.2 and runs in Vite's Node.js process. Its
built-in runtime modules target browser-like output environments, while custom
polyfills may target any environment supported by the consuming Vite build.
Detection is syntactic: an identifier or member expression with a built-in
feature's name is considered a match even when application code shadows that
name. Each injected runtime must therefore be safe to execute more broadly than
the feature's actual runtime use.

## Development

```sh
npm run typecheck --workspace @serve-tools/vite-polyfills
npm test --workspace @serve-tools/vite-polyfills
npm run build --workspace @serve-tools/vite-polyfills
```

## License

[MIT-0](./LICENSE.md)

[Vite]: https://vite.dev
