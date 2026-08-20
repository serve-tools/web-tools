import { definePolyfill } from "../plugin/define-polyfill.js";

const RUNTIME_CODE = [
	`import"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskSignal";`,
	`import"@serve-tools/polyfill-prioritized-task-scheduling/apply/TaskPriorityChangeEvent";`,
].join("");

/**
 * Polyfills the `TaskSignal` global.
 */
export default definePolyfill({
	id: "task-signal",
	code: RUNTIME_CODE,
	detect: (found) => ({
		Identifier(node) {
			if (node.name !== "TaskSignal" && node.name !== "TaskPriorityChangeEvent") {
				return;
			}

			found();
		},
	}),
});
