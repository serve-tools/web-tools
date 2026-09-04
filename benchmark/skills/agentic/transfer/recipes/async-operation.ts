import { AsyncOperation } from "@serve-tools/async-operation";

/** Defaults only `undefined` and otherwise requires a finite non-negative safe integer. */
export const normalizeBoundedCapacity = (value: unknown, fallback = 0): number => {
	const capacity = value === undefined ? fallback : value;

	if (!Number.isSafeInteger(capacity) || (capacity as number) < 0 || Object.is(capacity, -0)) {
		throw new TypeError("Capacity must be a non-negative safe integer");
	}

	return capacity as number;
};

export interface PacedOperationOptions {
	/** Omit for unbuffered delivery. Explicit `null` is invalid. */
	readonly capacity?: unknown;

	/** Cancels the complete operation and becomes its canonical terminal reason. */
	readonly signal?: AbortSignal;
}

export type PacedValues<Value> =
	| Iterable<Value>
	| AsyncIterable<Value>
	| ((signal: AbortSignal) => Iterable<Value> | AsyncIterable<Value>);

/** Adapts an iterable producer while awaiting every backpressured write. Use the factory form for cancellable sources. */
export const createPacedOperation = <Value, Result>(
	values: PacedValues<Value>,
	result: Result,
	options: PacedOperationOptions = {},
): AsyncOperation<Value, Result> => {
	const highWaterMark = normalizeBoundedCapacity(options.capacity);

	return new AsyncOperation<Value, Result>(
		async (write, { signal }) => {
			const source = typeof values === "function" ? values(signal) : values;

			for await (const value of source) {
				signal.throwIfAborted();
				await write(value);
			}

			signal.throwIfAborted();

			return result;
		},
		{
			...(options.signal === undefined ? {} : { signal: options.signal }),
			strategy: new CountQueuingStrategy({ highWaterMark }),
		},
	);
};

/** Drains values before awaiting the terminal result, avoiding zero-buffer deadlock. */
export const collectOperation = async <Value, Result>(
	operation: AsyncOperation<Value, Result>,
): Promise<{ readonly values: Value[]; readonly result: Result }> => {
	const values: Value[] = [];

	for await (const value of operation) {
		values.push(value);
	}

	return { values, result: await operation.result };
};

// Add your task adapter below.
