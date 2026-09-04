import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-observable/apply/Subscriber";`;

/** Polyfills the `Subscriber` global. */
export default definePolyfill({
	id: "subscriber",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "Subscriber") {
				return;
			}

			found();
		},
	}),
});
