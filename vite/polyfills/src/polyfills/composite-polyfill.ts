import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-composites/apply/Composite";`;

/** Polyfills the `Composite` global. */
export default definePolyfill({
	id: "composite",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "Composite") {
				return;
			}

			found();
		},
	}),
});
