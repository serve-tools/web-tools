import { builtinPolyfills, definePolyfill, vitePolyfills } from "../src/vite-polyfills.js";

const iteratorHelpers = definePolyfill({
	id: "iterator-helpers",
	code: `import "iterator-helpers-polyfill";`,
	detect: (found) => ({
		MemberExpression(node) {
			if (!node.computed && node.property.type === "Identifier" && node.property.name === "take") found();
		},
	}),
});

/** A compile-tested custom-polyfill configuration recipe. */
export const polyfillsPlugin = vitePolyfills({
	polyfills: [...builtinPolyfills, iteratorHelpers],
});
