export interface BenchmarkOptions {
	iterations: number;
	samples?: number;
	warmup?: number;
}

export interface BenchmarkResult {
	iterations: number;
	meanMilliseconds: number;
	medianMilliseconds: number;
	name: string;
	operationsPerSecond: number;
	p95Milliseconds: number;
	samples: number;
}

const percentile = (sorted: readonly number[], proportion: number): number =>
	sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * proportion) - 1)]!;

/**
 * Runs a warmed-up browser benchmark and writes one machine-readable result line.
 */
export const benchmark = async (
	name: string,
	operation: () => void | Promise<void>,
	options: BenchmarkOptions,
): Promise<BenchmarkResult> => {
	const { iterations, samples = 15, warmup = 5 } = options;

	for (let sample = 0; sample < warmup; ++sample) {
		for (let iteration = 0; iteration < iterations; ++iteration) {
			const result = operation();

			if (result instanceof Promise) await result;
		}
	}

	const durations: number[] = [];

	for (let sample = 0; sample < samples; ++sample) {
		const start = performance.now();

		for (let iteration = 0; iteration < iterations; ++iteration) {
			const result = operation();

			if (result instanceof Promise) await result;
		}

		durations.push(performance.now() - start);
	}

	const sorted = durations.toSorted((left, right) => left - right);
	const meanMilliseconds = durations.reduce((total, duration) => total + duration, 0) / samples;
	const result: BenchmarkResult = {
		name,
		iterations,
		samples,
		meanMilliseconds,
		medianMilliseconds: percentile(sorted, 0.5),
		p95Milliseconds: percentile(sorted, 0.95),
		operationsPerSecond: (iterations * 1_000) / meanMilliseconds,
	};

	console.log(`[benchmark] ${JSON.stringify(result)}`);

	return result;
};
