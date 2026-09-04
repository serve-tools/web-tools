import { AsyncOperation } from "@serve-tools/async-operation";

export function createProgressFold(
	values: Iterable<number>,
	initial: number,
	fold: (total: number, value: number, index: number, signal: AbortSignal) => number | Promise<number>,
	options: { highWaterMark?: number; signal?: AbortSignal; [key: PropertyKey]: unknown } = {},
) {
	if (
		!Number.isFinite(initial) ||
		typeof fold !== "function" ||
		typeof options !== "object" ||
		options === null ||
		Array.isArray(options) ||
		(options.highWaterMark !== undefined &&
			(!Number.isFinite(options.highWaterMark) ||
				options.highWaterMark < 0 ||
				!Number.isInteger(options.highWaterMark))) ||
		(options.signal !== undefined && !(options.signal instanceof AbortSignal))
	) {
		throw new TypeError("invalid input");
	}

	const items = Array.from(values);
	if (items.some((value) => !Number.isFinite(value))) {
		throw new TypeError("values");
	}
	const highWaterMark = options.highWaterMark ?? 0;

	return new AsyncOperation<{ index: number; total: number }, number>(
		async (write, { signal }) => {
			let total = initial;
			for (let index = 0; index < items.length; ++index) {
				total = await fold(total, items[index], index, signal);
				if (!Number.isFinite(total)) {
					throw new TypeError("fold result");
				}
				await write({ index, total });
			}
			return total;
		},
		{ signal: options.signal, strategy: new CountQueuingStrategy({ highWaterMark }) },
	);
}
