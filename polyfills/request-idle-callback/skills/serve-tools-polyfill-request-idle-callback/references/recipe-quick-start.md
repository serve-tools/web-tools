# Recipe: quick start

This public-import example is generated from the compile-checked `test/polyfill-request-idle-callback.recipes.ts` fixture in the package source.

```ts
import "@serve-tools/polyfill-request-idle-callback";

/** A compile-tested recipe for scheduling and cancelling idle work through the installed globals. */
export function scheduleIdleWork(): void {
	const handle = requestIdleCallback(
		(deadline: IdleDeadline) => {
			while (!deadline.didTimeout && deadline.timeRemaining() > 0) {
				break;
			}
		},
		{ timeout: 1_000 },
	);

	cancelIdleCallback(handle);
}
```
