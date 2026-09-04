import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-observable/apply/Observable";`;

/** Polyfills the `Observable` global. */
export default definePolyfill({
	id: "observable",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "Observable") {
				return;
			}

			found();
		},
	}),
});
