# Recipe: quick start

This public-import example is generated from the compile-checked `test/ponyfill-request-idle-callback.recipes.ts` fixture in the package source.

```ts
import type { IdleDeadline } from "@serve-tools/ponyfill-request-idle-callback";
import { cancelIdleCallback, requestIdleCallback } from "@serve-tools/ponyfill-request-idle-callback";

/** A compile-tested recipe for scheduling and cancelling idle work. */
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
