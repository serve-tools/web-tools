# Recipe: quick start

This public-import example is generated from the compile-checked `test/vite-polyfills.recipes.ts` fixture in the package source.

```ts
import { builtinPolyfills, definePolyfill, vitePolyfills } from "@serve-tools/vite-polyfills";

const iteratorHelpers = definePolyfill({
	id: "iterator-helpers",
	code: `import "iterator-helpers-polyfill";`,
	detect: (found) => ({
		MemberExpression(node) {
			if (!node.computed && node.property.type === "Identifier" && node.property.name === "take") {
				found();
			}
		},
	}),
});

/** A compile-tested custom-polyfill configuration recipe. */
export const polyfillsPlugin = vitePolyfills({
	polyfills: [...builtinPolyfills, iteratorHelpers],
});
```
