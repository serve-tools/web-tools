import { AsyncDisposableStack, SuppressedError } from "@serve-tools/ponyfill-resource-management";

export async function withCleanup<T>(
	work: () => T | PromiseLike<T>,
	cleanup: () => void | PromiseLike<void>,
): Promise<T> {
	if (typeof work !== "function" || typeof cleanup !== "function") {
		throw new TypeError("callbacks must be functions");
	}
	const stack = new AsyncDisposableStack();
	stack.defer(cleanup);
	let value: T;
	let workFailed = false;
	let workError: unknown;
	try {
		value = await work();
	} catch (error) {
		workFailed = true;
		workError = error;
	}
	try {
		await stack.disposeAsync();
	} catch (cleanupError) {
		if (workFailed) {
			throw new SuppressedError(cleanupError, workError);
		}
		throw cleanupError;
	}
	if (workFailed) {
		throw workError;
	}
	return value!;
}
