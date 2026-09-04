import { test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { Observable, when } from "../dist/ponyfill-observable.js";

const samples = 15;
const warmup = 5;

const options = (iterations: number) => ({ iterations, samples, warmup });

const verify: (condition: unknown, message: string) => void = (condition, message) => {
	if (!condition) {
		throw new Error(message);
	}
};

const total = (length: number) => (length * (length + 1)) / 2;

const sourceWithEmissions = (emissions: number) =>
	new Observable<number>((subscriber) => {
		for (let value = 1; value <= emissions && subscriber.active; ++value) {
			subscriber.next(value);
		}

		subscriber.complete();
	});

class BenchmarkEventTarget extends EventTarget {
	activeListeners = 0;

	addEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: AddEventListenerOptions | boolean,
	): void {
		++this.activeListeners;
		super.addEventListener(type, callback, options);
	}

	removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: EventListenerOptions | boolean,
	): void {
		--this.activeListeners;
		super.removeEventListener(type, callback, options);
	}
}

test.each([1, 32, 1_024])("subscribe-%i-emissions", async (emissions) => {
	const source = sourceWithEmissions(emissions);

	await benchmark(
		`ponyfill-observable/subscribe-${emissions}-emissions`,
		() => {
			let count = 0;
			let sum = 0;
			let completed = false;

			source.subscribe({
				next: (value) => {
					++count;
					sum += value;
				},
				complete: () => {
					completed = true;
				},
			});

			verify(count === emissions, `Expected ${emissions} received values`);
			verify(sum === total(emissions), "Expected ordered numeric emissions");
			verify(completed, "Expected subscription completion");
		},
		options(emissions === 1 ? 10_000 : emissions === 32 ? 6_000 : 1_250),
	);
});

test("map-filter-drop-take", async () => {
	let chainEmissions = 0;
	let chainTeardowns = 0;
	const chain = new Observable<number>((subscriber) => {
		subscriber.addTeardown(() => ++chainTeardowns);

		for (let value = 1; value <= 256 && subscriber.active; ++value) {
			++chainEmissions;
			subscriber.next(value);
		}

		subscriber.complete();
	})
		.map((value) => value * 2)
		.filter((value) => value % 6 === 0)
		.drop(8)
		.take(16);

	await benchmark(
		"ponyfill-observable/map-filter-drop-take",
		() => {
			chainEmissions = 0;
			chainTeardowns = 0;
			let count = 0;
			let sum = 0;
			let completed = false;

			chain.subscribe({
				next: (value) => {
					++count;
					sum += value;
				},
				complete: () => {
					completed = true;
				},
			});

			verify(count === 16, "Expected 16 chained values");
			verify(sum === 1_584, "Expected chained values after map, filter, drop, and take");
			verify(completed, "Expected chained completion");
			verify(chainEmissions === 72, "Expected take to stop the source after 72 emissions");
			verify(chainTeardowns === 1, "Expected take to run source teardown");
		},
		options(2_000),
	);
});

test("to-array-256", async () => {
	const terminalSource = Observable.from(Array.from({ length: 256 }, (_value, index) => index + 1));

	await benchmark(
		"ponyfill-observable/to-array-256",
		async () => {
			const values = await terminalSource.toArray();

			verify(values.length === 256, "Expected collected values");
			verify(values[0] === 1 && values[255] === 256, "Expected collected ordering");
		},
		options(1_000),
	);
});

test("reduce-256", async () => {
	const terminalSource = Observable.from(Array.from({ length: 256 }, (_value, index) => index + 1));

	await benchmark(
		"ponyfill-observable/reduce-256",
		async () => {
			const sum = await terminalSource.reduce((accumulator, value) => accumulator + value, 0);

			verify(sum === total(256), "Expected reduced total");
		},
		options(1_000),
	);
});

test("first-cancels-source", async () => {
	let firstEmissions = 0;
	let firstTeardowns = 0;
	const firstSource = new Observable<number>((subscriber) => {
		subscriber.addTeardown(() => ++firstTeardowns);

		for (let value = 1; value <= 1_024 && subscriber.active; ++value) {
			++firstEmissions;
			subscriber.next(value);
		}

		subscriber.complete();
	});

	await benchmark(
		"ponyfill-observable/first-cancels-source",
		async () => {
			firstEmissions = 0;
			firstTeardowns = 0;
			const value = await firstSource.first();

			verify(value === 1, "Expected first value");
			verify(firstEmissions === 1, "Expected first to stop after one source emission");
			verify(firstTeardowns === 1, "Expected first cancellation teardown");
		},
		options(5_000),
	);
});

test("async-iterable-completion", async () => {
	const asyncValues = {
		async *[Symbol.asyncIterator](): AsyncGenerator<number> {
			for (let value = 1; value <= 32; ++value) {
				yield value;
			}
		},
	};
	const asyncSource = Observable.from(asyncValues);

	await benchmark(
		"ponyfill-observable/async-iterable-completion",
		async () => {
			const values = await asyncSource.toArray();

			verify(values.length === 32, "Expected async iterable values");
			verify(values[0] === 1 && values[31] === 32, "Expected async iterable ordering");
		},
		options(2_500),
	);
});

test("promise-completion", async () => {
	const promiseSource = Observable.from(Promise.resolve(97));

	await benchmark(
		"ponyfill-observable/promise-completion",
		async () => {
			const values = await promiseSource.toArray();

			verify(values.length === 1 && values[0] === 97, "Expected Promise completion value");
		},
		options(3_000),
	);
});

test("when-take-listener-lifecycle", async () => {
	const eventTarget = new BenchmarkEventTarget();
	const eventSource = when(eventTarget, "tick");

	await benchmark(
		"ponyfill-observable/when-take-listener-lifecycle",
		() => {
			let events = 0;

			eventSource.take(2).subscribe(() => ++events);
			eventTarget.dispatchEvent(new Event("tick"));
			eventTarget.dispatchEvent(new Event("tick"));

			verify(events === 2, "Expected delivered events");
			verify(eventTarget.activeListeners === 0, "Expected completed event listener teardown");
		},
		options(5_000),
	);
});

test("when-external-cancellation", async () => {
	const eventTarget = new BenchmarkEventTarget();
	const eventSource = when(eventTarget, "tick");

	await benchmark(
		"ponyfill-observable/when-external-cancellation",
		() => {
			const controller = new AbortController();
			let events = 0;

			eventSource.subscribe(() => ++events, { signal: controller.signal });
			eventTarget.dispatchEvent(new Event("tick"));
			controller.abort("benchmark cancellation");
			eventTarget.dispatchEvent(new Event("tick"));

			verify(events === 1, "Expected external cancellation to stop event delivery");
			verify(eventTarget.activeListeners === 0, "Expected cancelled event listener teardown");
		},
		options(6_000),
	);
});

test("error-teardown", async () => {
	const expectedError = new Error("benchmark error");
	let received = 0;
	let teardownCount = 0;
	let receivedError: unknown;
	const errorSource = new Observable<number>((subscriber) => {
		subscriber.addTeardown(() => ++teardownCount);
		subscriber.next(1);
		subscriber.error(expectedError);
	});

	await benchmark(
		"ponyfill-observable/error-teardown",
		() => {
			received = 0;
			teardownCount = 0;
			receivedError = undefined;

			errorSource.subscribe({
				next: () => ++received,
				error: (error) => {
					receivedError = error;
				},
			});

			verify(received === 1, "Expected pre-error value");
			verify(teardownCount === 1, "Expected error teardown");
			verify(receivedError === expectedError, "Expected observed producer error");
		},
		options(25_000),
	);
});
