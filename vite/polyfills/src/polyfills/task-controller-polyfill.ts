import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = `import"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskController";`;

/**
 * Polyfills the `TaskController` global.
 */
export default definePolyfill({
	id: "task-controller",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "TaskController") {
				return;
			}

			found();
		},
	}),
});
