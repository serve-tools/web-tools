import { AsyncDisposableStack, SuppressedError } from "@serve-tools/ponyfill-resource-management";

/** Runs work with asynchronous cleanups that always run in reverse acquisition order. */
export async function withAsyncResources<Value>(
	register: (defer: (cleanup: () => void | PromiseLike<void>) => void) => PromiseLike<Value> | Value,
): Promise<Value> {
	const resources = new AsyncDisposableStack();

	let value!: Value;
	let workError: unknown;

	try {
		value = await register((cleanup) => resources.defer(cleanup));
	} catch (error) {
		workError = error;
	}

	try {
		await resources.disposeAsync();
	} catch (cleanupError) {
		if (workError !== undefined) {
			throw new SuppressedError(cleanupError, workError, "Cleanup failed after work failed");
		}

		throw cleanupError;
	}

	if (workError !== undefined) {
		throw workError;
	}

	return value;
}
