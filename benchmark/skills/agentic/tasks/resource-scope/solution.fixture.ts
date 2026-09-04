import type { AsyncDisposable, Disposable } from "@serve-tools/ponyfill-resource-management";
import { AsyncDisposableStack, SuppressedError } from "@serve-tools/ponyfill-resource-management";

interface Registrar {
	use<T extends AsyncDisposable | Disposable | null | undefined>(value: T): T;
	adopt<T>(value: T, dispose: (value: T) => void | PromiseLike<void>): T;
	defer(dispose: () => void | PromiseLike<void>): void;
}

const none = Symbol("no failure");

export async function runResourceScope<Value, Result>(
	acquire: (registrar: Registrar) => Value | PromiseLike<Value>,
	work: (value: Value) => Result | PromiseLike<Result>,
): Promise<Result> {
	if (typeof acquire !== "function" || typeof work !== "function") {
		throw new TypeError("Expected callbacks");
	}

	const stack = new AsyncDisposableStack();
	const registrar: Registrar = {
		use: (value) => stack.use(value),
		adopt: (value, dispose) => stack.adopt(value, dispose),
		defer: (dispose) => stack.defer(dispose),
	};

	let result!: Result;
	let failure: unknown = none;

	try {
		const value = await acquire(registrar);
		result = await work(value);
	} catch (error) {
		failure = error;
	}

	try {
		await stack.disposeAsync();
	} catch (error) {
		throw failure === none ? error : appendSuppressed(error, failure);
	}

	if (failure !== none) {
		throw failure;
	}

	return result;
}

function appendSuppressed(error: unknown, earlier: unknown): SuppressedError {
	return error instanceof SuppressedError
		? new SuppressedError(error.error, appendSuppressed(error.suppressed, earlier))
		: new SuppressedError(error, earlier);
}
