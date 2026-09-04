import { AsyncOperation } from "@serve-tools/async-operation";

export function createProgressFold(
	values: Iterable<number>,
	initial: number,
	fold: (total: number, value: number, index: number, signal: AbortSignal) => number | PromiseLike<number>,
	options?: { highWaterMark?: number; signal?: AbortSignal },
) {
	const input = checked(values);
	if (!Number.isFinite(initial) || typeof fold !== "function") {
		throw new TypeError("Invalid fold input");
	}
	if (options !== undefined && (typeof options !== "object" || options === null)) {
		throw new TypeError("Invalid options");
	}
	const highWaterMark = options?.highWaterMark === undefined ? 0 : options.highWaterMark;
	if (
		highWaterMark !== undefined &&
		(!Number.isFinite(highWaterMark) || highWaterMark < 0 || !Number.isInteger(highWaterMark))
	) {
		throw new TypeError("Invalid highWaterMark");
	}
	if (options?.signal !== undefined && !(options.signal instanceof AbortSignal)) {
		throw new TypeError("Invalid signal");
	}
	return new AsyncOperation<{ index: number; total: number }, number>(
		async (write, { signal }) => {
			let total = initial;
			for (let index = 0; index < input.length; ++index) {
				signal.throwIfAborted();
				total = await fold(total, input[index]!, index, signal);
				if (!Number.isFinite(total)) {
					throw new TypeError("Fold must return a finite number");
				}
				await write({ index, total });
			}
			return total;
		},
		{ signal: options?.signal, strategy: { highWaterMark } },
	);
}

function checked(values: Iterable<number>): number[] {
	if (
		values === null ||
		values === undefined ||
		typeof (values as Iterable<number>)[Symbol.iterator] !== "function"
	) {
		throw new TypeError("Expected iterable");
	}
	if (Array.isArray(values) && Object.keys(values).length !== values.length) {
		throw new TypeError("Expected dense values");
	}
	const output = Array.from(values);
	if (output.some((value) => !Number.isFinite(value))) {
		throw new TypeError("Expected finite values");
	}
	return output;
}
