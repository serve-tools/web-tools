import { performance } from "node:perf_hooks";
import { clearTimeout, setImmediate, setTimeout } from "node:timers";

import { createIdleCallbackScheduler } from "./.scheduler.js";

const backoff = 10;
const minimumSampleDuration = 5;
const maximumUtilization = 0.8;

let previousUtilization = performance.eventLoopUtilization();

const unref = (handle) => {
	handle.unref();

	return handle;
};
const shouldStart = () => {
	const currentUtilization = performance.eventLoopUtilization();
	const utilization = performance.eventLoopUtilization(currentUtilization, previousUtilization);

	previousUtilization = currentUtilization;

	return (
		utilization.active + utilization.idle < minimumSampleDuration || utilization.utilization < maximumUtilization
	);
};

export const { cancelIdleCallback, requestIdleCallback } = createIdleCallbackScheduler({
	now: () => performance.now(),
	defer: (callback) => unref(setImmediate(callback)),
	postpone: (callback) => unref(setTimeout(callback, backoff)),
	setTimer: (callback, timeout) => unref(setTimeout(callback, timeout)),
	clearTimer: clearTimeout,
	shouldStart,
});
