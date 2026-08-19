import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-decorator-metadata/apply/Symbol/metadata";`;

/** Polyfills the `Symbol.metadata` symbol used by the decorator metadata proposal. */
export default definePolyfill({
	id: "symbol-metadata",
	code: RUNTIME_CODE,
	detect: (found) => ({
		MemberExpression(node) {
			if (node.computed) {
				return;
			}

			if (node.object.type !== "Identifier" || node.object.name !== "Symbol") {
				return;
			}

			if (node.property.type !== "Identifier" || node.property.name !== "metadata") {
				return;
			}

			found();
		},
	}),
});
