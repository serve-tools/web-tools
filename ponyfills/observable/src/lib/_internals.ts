/** Validates callback inputs without formatting an error on the successful path. */
export function assertFunction(value: unknown, expected?: string, constructor?: Function): asserts value is Function {
	if (typeof value !== "function") {
		throwError(new TypeError(`Expected ${expected ?? value} to be a function`), constructor);
	}
}

/** Validates observer dictionaries and iterator results. */
export function assertObject(value: unknown, expected?: string, constructor?: Function): asserts value is object {
	if (typeof value !== "object" || value === null) {
		throwError(new TypeError(`Expected ${expected ?? value} to be an object`), constructor);
	}
}

/** Throws an empty-consumption error at the public method boundary. */
export const throwEmpty = (constructor: Function): never =>
	throwError(new RangeError("Observable completed without a value"), constructor);

/** Trims internal stack frames on runtimes that support it. */
export function throwError(error: Error, constructor?: Function): never {
	Error.captureStackTrace?.(error, constructor);

	throw error;
}

/** Web IDL unsigned long long conversion, including truncation and wrapping. */
export const toCount = (value: number): number => {
	value = +value;

	if (!Number.isFinite(value) || value === 0) {
		return 0;
	}

	return Number(BigInt.asUintN(64, BigInt(Math.trunc(value))));
};

export const defineStringTag = <T extends Function>(constructor: T, value: string = constructor.name) =>
	Object.defineProperty(constructor.prototype, Symbol.toStringTag, {
		configurable: true,
		value,
	});

declare global {
	interface ErrorConstructor {
		captureStackTrace(targetObject: object, constructorOpt?: Function): void;
	}
}
