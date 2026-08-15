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
	if (errors.length === 1) {
		throw errors[0];
	}

	if (errors.length > 1) {
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
