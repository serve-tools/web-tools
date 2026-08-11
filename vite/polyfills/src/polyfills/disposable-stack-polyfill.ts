import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = [
	`import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose";`,
	`import"@serve-tools/polyfill-resource-management/apply/DisposableStack";`,
].join("");

/**
 * Polyfills the `DisposableStack` global used by the explicit resource management proposal.
 */
export default definePolyfill({
	id: "disposable-stack",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "DisposableStack") {
				return;
			}

			found();
		},
	}),
});
