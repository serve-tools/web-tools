import {
	callbacks,
	getChannel,
	getNextHandle,
	resetScheduleIfEmpty,
	type ScheduledCallback,
	schedule,
	setCallbackTimeout,
} from "./.internals.js";
import type { IdleRequestCallback } from "./IdleRequestCallback.js";
import type { IdleRequestOptions } from "./IdleRequestOptions.js";

/** Schedules work for an idle period and returns its cancellation handle. */
export function requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number {
	getChannel();

	const handle = getNextHandle();
	const scheduled: ScheduledCallback = { callback };

	if (options?.timeout !== undefined && options.timeout > 0) {
		scheduled.timeoutHandle = setCallbackTimeout(() => {
			if (!callbacks.delete(handle)) {
				return;
			}

			resetScheduleIfEmpty();

			callback({ didTimeout: true, timeRemaining: () => 0 });
		}, options.timeout);
	}

	callbacks.set(handle, scheduled);

	schedule();

	return handle;
}
