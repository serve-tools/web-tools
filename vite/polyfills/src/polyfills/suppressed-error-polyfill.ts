import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-resource-management/apply/SuppressedError";`;

/**
 * Polyfills the `SuppressedError` global used by the explicit resource management proposal.
 */
export default definePolyfill({
	id: "suppressed-error",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "SuppressedError") {
				return;
			}

			found();
		},
	}),
});
