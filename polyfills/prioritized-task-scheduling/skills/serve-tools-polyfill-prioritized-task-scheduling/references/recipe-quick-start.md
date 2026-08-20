# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-prioritized-task-scheduling.recipes.ts` fixture in the package source.

```ts
import "@serve-tools/polyfill-prioritized-task-scheduling";

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
```
