import "../src/polyfill-prioritized-task-scheduling.js";

/** A compile-tested recipe for prioritized work through installed globals. */
export async function schedulePrioritizedWork(): Promise<string> {
	const controller = new TaskController({ priority: "user-blocking" });

	return scheduler.postTask(
		async () => {
			await scheduler.yield();

			return "complete";
		},
		{ signal: controller.signal },
	);
}
