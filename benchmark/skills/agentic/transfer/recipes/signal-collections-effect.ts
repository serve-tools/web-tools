import { Signal } from "@serve-tools/signal";
import { SignalArray } from "@serve-tools/signal-collections";
import type { Dispose } from "@serve-tools/signal-effect";
import { effect } from "@serve-tools/signal-effect";

/** Copies a dense finite-number array, defaulting only an omitted value to an empty list. */
export const normalizeDenseFiniteNumbers = (value: unknown = undefined): number[] => {
	if (value === undefined) {
		return [];
	}

	if (!Array.isArray(value)) {
		throw new TypeError("Expected an array");
	}

	const output = new Array<number>(value.length);

	for (let index = 0; index < value.length; ++index) {
		if (!Object.hasOwn(value, index)) {
			throw new TypeError("Sparse arrays are not supported");
		}

		const item = value[index];

		if (typeof item !== "number" || !Number.isFinite(item)) {
			throw new TypeError("Every item must be a finite number");
		}

		output[index] = item;
	}

	return output;
};

/** Creates a signal-aware native Array after validating the complete input boundary. */
export const createFiniteSeries = (value: unknown = undefined): SignalArray<number> =>
	new SignalArray(normalizeDenseFiniteNumbers(value));

/** Validates before mutation so a rejected replacement leaves the observed collection unchanged. */
export const replaceFiniteSeries = (series: SignalArray<number>, value: unknown): void => {
	const replacement = normalizeDenseFiniteNumbers(value);

	series.splice(0, series.length, ...replacement);
};

/** Creates a computed total that also detects invalid direct writes or deleted array indexes. */
export const createSeriesTotal = (series: SignalArray<number>): InstanceType<typeof Signal.Computed<number>> =>
	new Signal.Computed(() => {
		let total = 0;

		for (let index = 0; index < series.length; ++index) {
			if (!(index in series)) {
				throw new TypeError("Sparse arrays are not supported");
			}

			const item = series[index];

			if (!Number.isFinite(item)) {
				throw new TypeError("Every item must be a finite number");
			}

			total += item;
		}

		return total;
	});

/** Publishes the initial total synchronously and later invalidations in microtask batches. */
export const observeSeriesTotal = (series: SignalArray<number>, publish: (total: number) => void): Dispose => {
	const total = createSeriesTotal(series);

	return effect(() => publish(total.get()));
};

// Add your task adapter below.
