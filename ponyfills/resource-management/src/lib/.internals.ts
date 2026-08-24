import { SuppressedError } from "./SuppressedError.js";

export const enum StackState {
	Pending,
	Disposed,
}

export const assertPending = (state: StackState): void => {
	if (state === StackState.Disposed) {
		throw new ReferenceError("DisposableStack is already disposed");
	}
};

export function assertPendingCallback(
	state: StackState,
	value: unknown,
): asserts value is (...args: never[]) => unknown {
	assertPending(state);

	if (typeof value !== "function") {
		throw new TypeError("Dispose callback must be a function");
	}
}

export const getDisposeMethod = <Result>(value: object, key: symbol): (() => Result) | undefined => {
	const method = Reflect.get(value, key);

	if (method == null) {
		return undefined;
	}

	if (typeof method !== "function") {
		throw new TypeError("Dispose method must be a function");
	}

	return () => Reflect.apply(method, value, []) as Result;
};

const throwDisposalErrors = (errors: unknown[]): void => {
	if (errors.length) {
		throw errors.reduce((suppressed, error) => new SuppressedError(error, suppressed));
	}
};

export const disposeResources = (disposers: Array<() => void>): void => {
	const errors: unknown[] = [];

	while (disposers.length) {
		try {
			disposers.pop()!();
		} catch (error) {
			errors.push(error);
		}
	}

	throwDisposalErrors(errors);
};

export const disposeResourcesAsync = async (disposers: Array<() => void | PromiseLike<void>>): Promise<void> => {
	const errors: unknown[] = [];

	while (disposers.length) {
		try {
			await disposers.pop()!();
		} catch (error) {
			errors.push(error);
		}
	}

	throwDisposalErrors(errors);
};
