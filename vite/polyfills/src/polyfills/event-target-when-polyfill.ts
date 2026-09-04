import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-observable/apply/EventTarget/when";`;

/** Polyfills `EventTarget.prototype.when`. */
export default definePolyfill({
	id: "event-target-when",
	code: RUNTIME_CODE,
	detect: (found) => ({
		MemberExpression(node) {
			if (node.computed) {
				return;
			}

			if (node.property.type !== "Identifier" || node.property.name !== "when") {
				return;
			}

			found();
		},
	}),
});
