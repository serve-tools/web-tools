import type { IdleDeadline } from "../src/ponyfill-request-idle-callback.js";
import { cancelIdleCallback, requestIdleCallback } from "../src/ponyfill-request-idle-callback.js";

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
