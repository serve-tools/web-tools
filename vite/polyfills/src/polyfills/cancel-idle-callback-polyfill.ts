import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-request-idle-callback/apply/cancelIdleCallback";`;

/**
 * Polyfills the `cancelIdleCallback` global.
 */
export default definePolyfill({
	id: "cancel-idle-callback",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "cancelIdleCallback") {
				return;
			}

			found();
		},
	}),
});
