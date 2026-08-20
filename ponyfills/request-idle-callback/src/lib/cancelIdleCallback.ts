import { callbacks, resetScheduleIfEmpty } from "./.internals.js";

/** Cancels a callback previously scheduled by this module. */
export function cancelIdleCallback(handle: number): void {
	const scheduled = callbacks.get(handle);

	if (scheduled?.timeoutHandle !== undefined) {
		clearTimeout(scheduled.timeoutHandle);
	}

	if (callbacks.delete(handle)) {
		resetScheduleIfEmpty();
	}
}

declare var clearTimeout: typeof globalThis extends { onmessage: any; clearTimeout: infer T }
	? T
	: { (value: number): void };
