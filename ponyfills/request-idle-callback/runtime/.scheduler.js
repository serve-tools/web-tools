const idleDeadline = 8;

/** Creates an isolated idle-callback scheduler for one runtime. */
export function createIdleCallbackScheduler({
	now,
	defer,
	postpone = defer,
	setTimer,
	clearTimer,
	shouldStart = () => true,
}) {
	const callbacks = new Map();

	let isScheduled = false;
	let nextHandle = 0;

	const schedule = (scheduleRun = defer) => {
		if (isScheduled) {
			return;
		}

		isScheduled = true;
		scheduleRun(runCallbacks);
	};

	function runCallbacks() {
		isScheduled = false;

		if (!callbacks.size) {
			return;
		}

		if (!shouldStart()) {
			schedule(postpone);

			return;
		}

		const end = now() + idleDeadline;
		const runnableCallbacks = Array.from(callbacks);

		try {
			for (const [handle, scheduled] of runnableCallbacks) {
				if (now() >= end) {
					break;
				}

				if (!callbacks.delete(handle)) {
					continue;
				}

				if (scheduled.timeoutHandle !== undefined) {
					clearTimer(scheduled.timeoutHandle);
				}

				scheduled.callback({
					didTimeout: false,
					timeRemaining: () => Math.max(0, end - now()),
				});
			}
		} finally {
			if (callbacks.size) {
				schedule();
			}
		}
	}

	return {
		/** Cancels a callback previously scheduled by this runtime module. */
		cancelIdleCallback(handle) {
			const scheduled = callbacks.get(handle);

			if (scheduled?.timeoutHandle !== undefined) {
				clearTimer(scheduled.timeoutHandle);
			}

			callbacks.delete(handle);
		},
		/** Schedules work for a runtime idle period and returns its cancellation handle. */
		requestIdleCallback(callback, options) {
			const handle = ++nextHandle;
			const scheduled = { callback };

			if (options?.timeout !== undefined && options.timeout > 0) {
				scheduled.timeoutHandle = setTimer(() => {
					if (!callbacks.delete(handle)) {
						return;
					}

					callback({ didTimeout: true, timeRemaining: () => 0 });
				}, options.timeout);
			}

			callbacks.set(handle, scheduled);

			schedule();

			return handle;
		},
	};
}
