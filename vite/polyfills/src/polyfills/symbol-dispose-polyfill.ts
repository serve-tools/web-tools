import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose";`;

/**
 * Polyfills the `Symbol.dispose` symbol used by the explicit resource management proposal (`using` / `await using`).
 */
export default definePolyfill({
	id: "symbol-dispose",
	code: RUNTIME_CODE,
	detect: (found) => ({
		MemberExpression(node) {
			if (node.computed) {
				return;
			}

			if (node.object.type !== "Identifier" || node.object.name !== "Symbol") {
				return;
			}

			if (node.property.type !== "Identifier") {
				return;
			}

			if (node.property.name !== "dispose") {
				return;
			}

			found();
		},
	}),
});
