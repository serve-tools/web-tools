import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-prioritized-task-scheduling/apply/scheduler";`;

/**
 * Polyfills the `scheduler` global.
 */
export default definePolyfill({
	id: "scheduler",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "scheduler") {
				return;
			}

			found();
		},
	}),
});
