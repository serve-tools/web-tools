import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"urlpattern-polyfill";`;

/**
 * Polyfills the `URLPattern` global.
 */
export default definePolyfill({
	id: "url-pattern",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "URLPattern") {
				return;
			}

			found();
		},
	}),
});
