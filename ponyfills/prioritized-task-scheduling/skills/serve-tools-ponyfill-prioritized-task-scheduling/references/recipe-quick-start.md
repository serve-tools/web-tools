# Recipe: quick start

This public-import example is generated from the compile-checked `test/ponyfill-prioritized-task-scheduling.recipes.ts` fixture in the package source.

```ts
import { scheduler, TaskController } from "@serve-tools/ponyfill-prioritized-task-scheduling";

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
```
