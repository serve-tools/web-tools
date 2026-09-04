import type { TaskPriority } from "@serve-tools/ponyfill-prioritized-task-scheduling";
import { scheduler } from "@serve-tools/ponyfill-prioritized-task-scheduling";

/** Posts cancellable work at an explicit priority and forwards the task result. */
export function postTask<Value>(
	callback: () => Value | PromiseLike<Value>,
	options: { priority?: TaskPriority; signal?: AbortSignal } = {},
): Promise<Value> {
	return scheduler.postTask(callback, options);
}
