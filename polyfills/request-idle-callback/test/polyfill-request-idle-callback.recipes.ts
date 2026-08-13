import "../src/polyfill-request-idle-callback.js";

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
