import { SuppressedError } from "./SuppressedError.js";

export const enum State {
	Pending,
	Disposed,
}

export const chk = (s: State) => {
	if (s === State.Disposed) throw new ReferenceError("DisposableStack is already disposed");
};

export const getMethod = <Result>(value: object, key: symbol): (() => Result) | undefined => {
	const method = Reflect.get(value, key);

	if (method == null) return undefined;
	if (typeof method !== "function") throw new TypeError("Dispose method must be a function");

	return () => Reflect.apply(method, value, []) as Result;
};

export const throwErrors = (errors: unknown[]) => {
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw errors.reduce((suppressed, error) => new SuppressedError(error, suppressed));
};
