import { createIdleCallbackScheduler } from "./.scheduler.js";

const unref = (handle) => {
	Deno.unrefTimer(handle);

	return handle;
};

export const { cancelIdleCallback, requestIdleCallback } = createIdleCallbackScheduler({
	now: () => performance.now(),
	defer: (callback) => unref(setImmediate(callback)),
	setTimer: (callback, timeout) => unref(setTimeout(callback, timeout)),
	clearTimer: clearTimeout,
});
