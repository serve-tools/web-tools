import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = [
	`import"@serve-tools/polyfill-resource-management/apply/Symbol/dispose";`,
	`import"@serve-tools/polyfill-resource-management/apply/Symbol/asyncDispose";`,
	`import"@serve-tools/polyfill-resource-management/apply/AsyncDisposableStack";`,
].join("");

/**
 * Polyfills the `AsyncDisposableStack` global used by the explicit resource management proposal.
 */
export default definePolyfill({
	id: "async-disposable-stack",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "AsyncDisposableStack") {
				return;
			}

			found();
		},
	}),
});
