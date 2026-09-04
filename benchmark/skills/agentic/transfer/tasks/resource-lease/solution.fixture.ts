import type { AsyncDisposable, Disposable } from "@serve-tools/ponyfill-resource-management";
import { AsyncDisposableStack, SuppressedError } from "@serve-tools/ponyfill-resource-management";

interface Registrar {
	use<T extends AsyncDisposable | Disposable | null | undefined>(value: T): T;
	adopt<T>(value: T, dispose: (value: T) => void | PromiseLike<void>): T;
	defer(dispose: () => void | PromiseLike<void>): void;
}

export async function openResourceLease<Value>(
	acquire: (registrar: Registrar) => Value | PromiseLike<Value>,
): Promise<{ readonly value: Value; readonly close: () => Promise<void>; readonly closed: Promise<void> }> {
	if (typeof acquire !== "function") {
		throw new TypeError("Expected acquire callback");
	}

	const stack = new AsyncDisposableStack();
	const registrar: Registrar = {
		use: (value) => stack.use(value),
		adopt: (value, dispose) => stack.adopt(value, dispose),
		defer: (dispose) => stack.defer(dispose),
	};

	let value: Value;

	try {
		value = await acquire(registrar);
	} catch (failure) {
		try {
			await stack.disposeAsync();
		} catch (cleanup) {
			throw appendSuppressed(cleanup, failure);
		}

		throw failure;
	}

	const gate = Promise.withResolvers<void>();
	let started = false;
	const closed = gate.promise.then(() => stack.disposeAsync());
	const close = (): Promise<void> => {
		if (!started) {
			started = true;
			gate.resolve();
		}

		return closed;
	};

	return { value, close, closed };
}

function appendSuppressed(error: unknown, earlier: unknown): SuppressedError {
	return error instanceof SuppressedError
		? new SuppressedError(error.error, appendSuppressed(error.suppressed, earlier))
		: new SuppressedError(error, earlier);
}
