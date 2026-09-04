/** Observer callbacks are reported, never thrown back into the producer. */
export function report(error: unknown): void {
	if (typeof globalThis.reportError === "function") {
		globalThis.reportError(error);
	} else {
		console.error(error);
	}
}

/** Invokes a notification or teardown without interrupting the execution. */
export function notify(callback: (() => void) | undefined): void {
	try {
		callback?.();
	} catch (error) {
		report(error);
	}
}

/** Rejects invalid callbacks at API entry, before a producer can start. */
export function requireCallback(value: unknown): asserts value is (...args: never[]) => unknown {
	if (typeof value !== "function") {
		throw new TypeError("Expected a callback");
	}
}

/** Uses a dependent signal so another listener cannot suppress cancellation. */
export function onAbort(signal: AbortSignal | undefined, callback: (reason: unknown) => void): () => void {
	if (!signal) {
		return () => {};
	}
	const dependent = AbortSignal.any([signal]);
	const abort = () => callback(dependent.reason);
	if (dependent.aborted) {
		abort();
		return () => {};
	}
	dependent.addEventListener("abort", abort, { once: true });
	return () => dependent.removeEventListener("abort", abort);
}
