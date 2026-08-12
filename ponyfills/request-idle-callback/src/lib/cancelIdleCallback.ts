import { callbacks, clearCallbackTimeout, resetScheduleIfEmpty } from "./.internals.js";

/** Cancels a callback previously scheduled by this module. */
export function cancelIdleCallback(handle: number): void {
	const scheduled = callbacks.get(handle);

	if (scheduled?.timeoutHandle !== undefined) clearCallbackTimeout(scheduled.timeoutHandle);

	if (callbacks.delete(handle)) resetScheduleIfEmpty();
}
