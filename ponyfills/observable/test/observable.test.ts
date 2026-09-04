/// <reference lib="dom" />

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Subscriber } from "../src/ponyfill-observable.js";
import { Observable } from "../src/ponyfill-observable.js";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("Observable", () => {
	it("creates independent cold interval subscriptions", () => {
		vi.useFakeTimers();
		const received: string[] = [];
		const observable = new Observable<number>((subscriber) => {
			let value = 0;
			const interval = setInterval(() => {
				subscriber.next(++value);

				if (value === 3) {
					subscriber.complete();
				}
			}, 10);

			subscriber.addTeardown(() => clearInterval(interval));
		});

		observable.subscribe((value) => received.push(`A${value}`));
		vi.advanceTimersByTime(15);
		observable.subscribe((value) => received.push(`B${value}`));
		vi.advanceTimersByTime(30);

		expect(received).toEqual(["A1", "A2", "B1", "A3", "B2", "B3"]);
	});

	it("starts a fresh producer for later subscriptions and terminal calls", async () => {
		let runs = 0;
		const observable = new Observable<number>((subscriber) => {
			subscriber.next(++runs);
			subscriber.complete();
		});

		expect(await observable.toArray()).toEqual([1]);
		expect(await observable.toArray()).toEqual([2]);

		const values: number[] = [];
		observable.subscribe((value) => values.push(value));
		expect(values).toEqual([3]);
	});

	it("keeps take state and cancellation independent for each subscriber", async () => {
		let producerStarts = 0;
		const observable = new Observable<number>((subscriber) => {
			++producerStarts;

			for (const value of [1, 2, 3, 4, 5]) {
				subscriber.next(value);
			}

			subscriber.complete();
		});

		const firstThree = observable.take(3);
		expect(await firstThree.toArray()).toEqual([1, 2, 3]);
		expect(await firstThree.toArray()).toEqual([1, 2, 3]);
		expect(producerStarts).toBe(2);
	});

	it("aborts one interval subscription without affecting another", () => {
		vi.useFakeTimers();
		const controller = new AbortController();
		const aborted: number[] = [];
		const active: number[] = [];
		const observable = new Observable<number>((subscriber) => {
			let value = 0;
			const interval = setInterval(() => subscriber.next(++value), 10);
			subscriber.addTeardown(() => clearInterval(interval));
		});

		observable.subscribe((value) => aborted.push(value), { signal: controller.signal });
		observable.subscribe((value) => active.push(value));
		vi.advanceTimersByTime(10);
		controller.abort("stop this one");
		vi.advanceTimersByTime(20);

		expect(aborted).toEqual([1]);
		expect(active).toEqual([1, 2, 3]);
	});

	it("aborts its signal, runs teardowns once in LIFO order, then notifies completion", () => {
		const events: string[] = [];
		new Observable<never>((subscriber) => {
			subscriber.signal.addEventListener("abort", () => events.push("signal"));
			subscriber.addTeardown(() => events.push("first"));
			subscriber.addTeardown(() => events.push("second"));
			subscriber.complete();
			subscriber.complete();
		}).subscribe({
			complete: () => events.push("complete"),
		});

		expect(events).toEqual(["signal", "second", "first", "complete"]);
	});

	it("invokes a producer with an inactive subscriber for a pre-aborted subscription", () => {
		const controller = new AbortController();
		controller.abort("already stopped");
		const producer = vi.fn((subscriber: { active: boolean; signal: AbortSignal }) => {
			expect(subscriber.active).toBe(false);
			expect(subscriber.signal.aborted).toBe(true);
		});

		new Observable(producer).subscribe(undefined, { signal: controller.signal });

		expect(producer).toHaveBeenCalledOnce();
	});

	it("supports a custom shared event producer with independent operator state and abort", () => {
		const target = new EventTarget();
		const addEventListener = vi.spyOn(target, "addEventListener");
		const removeEventListener = vi.spyOn(target, "removeEventListener");
		const subscribers = new Set<Subscriber<Event>>();
		const listener = (event: Event) => {
			for (const subscriber of subscribers) {
				subscriber.next(event);
			}
		};
		const observable = new Observable<Event>((subscriber) => {
			subscribers.add(subscriber);
			if (subscribers.size === 1) {
				target.addEventListener("tick", listener);
			}
			subscriber.addTeardown(() => {
				subscribers.delete(subscriber);
				if (subscribers.size === 0) {
					target.removeEventListener("tick", listener);
				}
			});
		});
		const events = observable.drop(1).take(2);
		const controller = new AbortController();
		const a: Event[] = [];
		const b: Event[] = [];
		const first = new Event("tick");
		const second = new Event("tick");
		const third = new Event("tick");

		events.subscribe((event) => a.push(event));
		target.dispatchEvent(first);
		events.subscribe((event) => b.push(event), { signal: controller.signal });
		target.dispatchEvent(second);
		target.dispatchEvent(third);
		controller.abort("only b");
		target.dispatchEvent(new Event("tick"));

		expect(a).toEqual([second, third]);
		expect(b).toEqual([third]);
		expect(addEventListener.mock.calls.filter(([type]) => type === "tick")).toHaveLength(1);
		expect(removeEventListener.mock.calls.filter(([type]) => type === "tick")).toHaveLength(1);
	});

	it("forwards mapper failures to error and reports observer failures without interrupting the producer", () => {
		const mapperFailure = new Error("mapper failed");
		const observerFailure = new Error("observer failed");
		const reportError = vi.fn();
		vi.stubGlobal("reportError", reportError);

		const source = new Observable<number>((subscriber) => {
			subscriber.next(1);
			subscriber.next(2);
			subscriber.complete();
		});
		const mapperErrors: unknown[] = [];
		const values: number[] = [];
		const complete = vi.fn();

		source
			.map(() => {
				throw mapperFailure;
			})
			.subscribe({
				error: (error) => mapperErrors.push(error),
			});
		source.subscribe({
			next: (value) => {
				if (value === 1) {
					throw observerFailure;
				}

				values.push(value);
			},
			complete,
		});

		expect(mapperErrors).toEqual([mapperFailure]);
		expect(reportError).toHaveBeenCalledExactlyOnceWith(observerFailure);
		expect(values).toEqual([2]);
		expect(complete).toHaveBeenCalledOnce();
	});

	it("cancels synchronous producers for take(0) and take(3)", async () => {
		let producerStarts = 0;
		let delivered = 0;
		let sourceAborted = false;
		const source = new Observable<number>((subscriber) => {
			++producerStarts;
			subscriber.signal.addEventListener("abort", () => {
				sourceAborted = true;
			});

			for (const value of [1, 2, 3, 4, 5]) {
				if (!subscriber.active) {
					break;
				}

				++delivered;
				subscriber.next(value);
			}

			subscriber.complete();
		});
		const emptyComplete = vi.fn();

		source.take(0).subscribe({ complete: emptyComplete });
		expect(emptyComplete).toHaveBeenCalledOnce();
		expect(producerStarts).toBe(0);

		expect(await source.take(3).toArray()).toEqual([1, 2, 3]);
		expect(delivered).toBe(3);
		expect(sourceAborted).toBe(true);
	});

	it("does not over-deliver take during a reentrant source emission", () => {
		let emit: (value: number) => void = () => undefined;
		const values: number[] = [];
		const source = new Observable<number>((subscriber) => {
			emit = (value) => subscriber.next(value);
		});

		source.take(1).subscribe((value) => {
			values.push(value);
			emit(2);
		});
		emit(1);

		expect(values).toEqual([1]);
	});

	it("converts supported sources and applies operators and terminal callbacks with their indices", async () => {
		const original = new Observable<number>((subscriber) => {
			subscriber.next(1);
			subscriber.complete();
		});
		expect(Observable.from(original)).toBe(original);
		expect(await Observable.from([1, 2]).toArray()).toEqual([1, 2]);

		async function* asyncValues() {
			yield 3;
			yield 4;
		}

		expect(await Observable.from(asyncValues()).toArray()).toEqual([3, 4]);
		expect(await Observable.from(Promise.resolve(5)).toArray()).toEqual([5]);

		const source = Observable.from([1, 2, 3, 4]);
		const mapIndices: number[] = [];
		const filterIndices: number[] = [];
		const visitIndices: number[] = [];
		const reduceIndices: number[] = [];
		const reduceController = new AbortController();

		expect(
			await source
				.map((value, index) => {
					mapIndices.push(index);
					return value * 2;
				})
				.filter((value, index) => {
					filterIndices.push(index);
					return value > 4;
				})
				.toArray(),
		).toEqual([6, 8]);
		expect(mapIndices).toEqual([0, 1, 2, 3]);
		expect(filterIndices).toEqual([0, 1, 2, 3]);

		await source.forEach((_value, index) => {
			visitIndices.push(index);
		});
		expect(visitIndices).toEqual([0, 1, 2, 3]);
		expect(await source.every((value, index) => value === index + 1)).toBe(true);
		expect(await source.some((value, index) => value === 3 && index === 2)).toBe(true);
		expect(await source.find((value, index) => value === 3 && index === 2)).toBe(3);
		expect(await source.first()).toBe(1);
		expect(await source.last()).toBe(4);
		expect(
			await source.reduce(
				(total, value, index) => {
					reduceIndices.push(index);
					return total + value;
				},
				0,
				{ signal: reduceController.signal },
			),
		).toBe(10);
		expect(reduceIndices).toEqual([0, 1, 2, 3]);
	});
});
