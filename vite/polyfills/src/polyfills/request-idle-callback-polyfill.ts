import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-request-idle-callback/apply/requestIdleCallback";`;

/**
 * Polyfills the `requestIdleCallback` global.
 */
export default definePolyfill({
	id: "request-idle-callback",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "requestIdleCallback") {
				return;
			}

			found();
		},
	}),
});
