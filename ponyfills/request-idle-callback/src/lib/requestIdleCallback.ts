import type { ScheduledCallback } from "./.internals.js";
import { callbacks, getChannel, getNextHandle, resetScheduleIfEmpty, schedule } from "./.internals.js";
import type { IdleRequestCallback, IdleRequestOptions } from "./types.js";

/** Schedules work for an idle period and returns its cancellation handle. */
export function requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number {
	getChannel();

	const handle = getNextHandle();
	const scheduled: ScheduledCallback = { callback };

	if (options?.timeout !== undefined && options.timeout > 0) {
		scheduled.timeoutHandle = setTimeout(() => {
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

declare var setTimeout: typeof globalThis extends { onmessage: any; setTimeout: infer T }
	? T
	: { (handler: (...args: unknown[]) => void, timeout?: number): number };
