import { AsyncDisposableStack, asyncDispose, SuppressedError } from "@serve-tools/ponyfill-resource-management";

export async function withCleanup<T>(
	work: () => T | PromiseLike<T>,
	cleanup: () => void | PromiseLike<void>,
): Promise<T> {
	if (typeof work !== "function" || typeof cleanup !== "function") {
		throw new TypeError("Expected functions");
	}
	const stack = new AsyncDisposableStack();
	stack.defer(cleanup);
	let value: T | undefined;
	let failed = false;
	let workError: unknown;
	try {
		value = await work();
	} catch (error) {
		failed = true;
		workError = error;
	}
	try {
		await stack[asyncDispose]();
	} catch (cleanupError) {
		if (failed) {
			throw new SuppressedError(cleanupError, workError);
		}
		throw cleanupError;
	}
	if (failed) {
		throw workError;
	}
	return value as T;
}
