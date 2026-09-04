import { AsyncOperation } from "@serve-tools/async-operation";

interface PageOptions {
	readonly highWaterMark?: number;
	readonly signal?: AbortSignal;
}

export function createPageOperation(
	pages: Iterable<number>,
	load: (page: number, index: number, signal: AbortSignal) => number | PromiseLike<number>,
	options: PageOptions = {},
) {
	if (typeof load !== "function") {
		throw new TypeError("Expected load callback");
	}
	if (options === null || typeof options !== "object") {
		throw new TypeError("Expected options object");
	}
	if (pages == null || typeof pages[Symbol.iterator] !== "function") {
		throw new TypeError("Expected iterable pages");
	}

	const highWaterMark = options.highWaterMark === undefined ? 0 : options.highWaterMark;

	if (!Number.isFinite(highWaterMark) || !Number.isInteger(highWaterMark) || highWaterMark < 0) {
		throw new TypeError("Expected a non-negative integer highWaterMark");
	}
	if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
		throw new TypeError("Expected AbortSignal");
	}

	return new AsyncOperation<
		{ readonly page: number; readonly index: number; readonly records: number },
		{ readonly pages: number; readonly records: number }
	>(
		async (write, { signal }) => {
			let records = 0;
			let index = 0;

			for (const page of pages) {
				if (!Number.isSafeInteger(page) || page <= 0) {
					throw new TypeError("Expected positive safe integer page");
				}

				const count = await load(page, index, signal);

				if (signal.aborted) {
					throw signal.reason;
				}
				if (!Number.isSafeInteger(count) || count < 0) {
					throw new TypeError("Expected non-negative safe integer record count");
				}

				await write({ page, index, records: count });
				records += count;
				++index;
			}

			return { pages: index, records };
		},
		{ signal: options.signal, strategy: new CountQueuingStrategy({ highWaterMark }) },
	);
}
