import { AsyncOperation } from "@serve-tools/async-operation";

interface BatchOptions {
	readonly highWaterMark?: number;
	readonly signal?: AbortSignal;
}

export function createBatchOperation<T, Value>(
	items: Iterable<T>,
	transform: (item: T, index: number, signal: AbortSignal) => Value | PromiseLike<Value>,
	options: BatchOptions = {},
) {
	if (typeof transform !== "function") {
		throw new TypeError("Expected transform");
	}

	const highWaterMark = options.highWaterMark === undefined ? 0 : options.highWaterMark;

	if (!Number.isFinite(highWaterMark) || !Number.isInteger(highWaterMark) || highWaterMark < 0) {
		throw new TypeError("Expected a non-negative integer highWaterMark");
	}

	return new AsyncOperation<
		| { readonly index: number; readonly status: "fulfilled"; readonly value: Value }
		| {
				readonly index: number;
				readonly status: "rejected";
				readonly reason: unknown;
		  },
		{ readonly fulfilled: number; readonly rejected: number }
	>(
		async (write, { signal }) => {
			let fulfilled = 0;
			let rejected = 0;
			let index = 0;

			for (const item of items) {
				try {
					const value = await transform(item, index, signal);

					if (signal.aborted) {
						throw signal.reason;
					}

					await write({ index, status: "fulfilled", value });
					++fulfilled;
				} catch (reason) {
					if (signal.aborted) {
						throw signal.reason;
					}

					await write({ index, status: "rejected", reason });
					++rejected;
				}

				++index;
			}

			return { fulfilled, rejected };
		},
		{ signal: options.signal, strategy: new CountQueuingStrategy({ highWaterMark }) },
	);
}
