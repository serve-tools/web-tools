import { scheduler, TaskController } from "../src/ponyfill-prioritized-task-scheduling.js";

/** A compile-tested recipe for prioritized, abortable work. */
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
