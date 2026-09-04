import { afterEach, expect, it, vi } from "vitest";
import type { Subscriber } from "../src/ponyfill-observable.js";
import { Observable } from "../src/ponyfill-observable.js";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("snapshots observer callbacks in dictionary order and invokes them without a receiver", () => {
	const reads: string[] = [];
	const calls: [name: string, receiver: unknown, argumentsLength: number, value?: unknown][] = [];
	const replacement = vi.fn();
	const unexpectedError = vi.fn();
	let next = function (this: unknown, ...args: [value: number]) {
		calls.push(["next", this, args.length, args[0]]);
	};
	let complete = function (this: unknown, ...args: []) {
		calls.push(["complete", this, args.length]);
	};
	const observer = {
		get complete() {
			reads.push("complete");

			return complete;
		},
		get error() {
			reads.push("error");

			return unexpectedError;
		},
		get next() {
			reads.push("next");

			return next;
		},
	};

	new Observable<number>((subscriber) => {
		next = replacement;
		complete = replacement;
		subscriber.next(1);
		subscriber.complete();
	}).subscribe(observer);

	expect(reads).toEqual(["complete", "error", "next"]);
	expect(calls).toEqual([
		["next", undefined, 1, 1],
		["complete", undefined, 0],
	]);
	expect(replacement).not.toHaveBeenCalled();
	expect(unexpectedError).not.toHaveBeenCalled();
});

it("uses the exact notification arity and continues after notification and teardown exceptions", () => {
	const nextFailure = new Error("next");
	const teardownFailure = new Error("teardown");
	const completeFailure = new Error("complete");
	const errorFailure = new Error("error observer");
	const reported = vi.fn();
	vi.stubGlobal("reportError", reported);
	const events: [name: string, receiver: unknown, argumentsLength: number, value?: unknown][] = [];

	new Observable<number>((subscriber) => {
		subscriber.addTeardown(function (this: unknown, ...args: []) {
			events.push(["teardown", this, args.length]);
		});
		subscriber.addTeardown(() => {
			throw teardownFailure;
		});
		subscriber.next(1);
		subscriber.next(2);
		subscriber.complete();
	}).subscribe({
		next: function (this: unknown, ...args: [value: number]) {
			const [value] = args;
			events.push(["next", this, args.length, value]);
			if (value === 1) {
				throw nextFailure;
			}
		},
		complete: function (this: unknown, ...args: []) {
			events.push(["complete", this, args.length]);
			throw completeFailure;
		},
	});

	const sourceFailure = new Error("source");
	new Observable((subscriber) => subscriber.error(sourceFailure)).subscribe({
		error: function (this: unknown, ...args: [error: unknown]) {
			events.push(["error", this, args.length, args[0]]);
			throw errorFailure;
		},
	});

	expect(events).toEqual([
		["next", undefined, 1, 1],
		["next", undefined, 1, 2],
		["teardown", undefined, 0],
		["complete", undefined, 0],
		["error", undefined, 1, sourceFailure],
	]);
	expect(reported.mock.calls).toEqual([[nextFailure], [teardownFailure], [completeFailure], [errorFailure]]);
});

it("reserves distinct mapper and terminal indices before reentrant emissions", async () => {
	let mapExecution!: Subscriber<number>;
	const mappedIndices: number[] = [];
	const mappedValues: number[] = [];
	const mapped = new Observable<number>((subscriber) => {
		mapExecution = subscriber;
	}).map((value, index) => {
		mappedIndices.push(index);
		if (value === 1) {
			mapExecution.next(2);
		}

		return value * 10;
	});

	mapped.subscribe((value) => mappedValues.push(value));
	mapExecution.next(1);

	let terminalExecution!: Subscriber<number>;
	const terminalCalls: [value: number, index: number][] = [];
	const terminal = new Observable<number>((subscriber) => {
		terminalExecution = subscriber;
	}).forEach((value, index) => {
		terminalCalls.push([value, index]);
		if (value === 1) {
			terminalExecution.next(2);
		}
	});
	terminalExecution.next(1);
	terminalExecution.complete();
	await terminal;

	expect(mappedIndices).toEqual([0, 1]);
	expect(mappedValues).toEqual([20, 10]);
	expect(terminalCalls).toEqual([
		[1, 0],
		[2, 1],
	]);

	mapExecution.complete();
});

it("suppresses reentrant emissions beyond take's limit and tears down before completion", () => {
	const events: string[] = [];
	let execution!: Subscriber<number>;
	const source = new Observable<number>((subscriber) => {
		execution = subscriber;
		subscriber.addTeardown(() => events.push("first teardown"));
		subscriber.addTeardown(() => events.push("second teardown"));
	});

	source.take(2).subscribe({
		next: (value) => {
			events.push(`next ${value}`);
			if (value < 3) {
				execution.next(value + 1);
			}
		},
		complete: () => events.push("complete"),
	});
	execution.next(1);

	expect(events).toEqual(["next 1", "next 2", "second teardown", "first teardown", "complete"]);
	expect(execution.active).toBe(false);
});

it("cannot have external cancellation suppressed by another abort event listener", async () => {
	const subscriptionController = new AbortController();
	subscriptionController.signal.addEventListener("abort", (event) => event.stopImmediatePropagation());
	const teardown = vi.fn();
	let execution!: Subscriber<never>;
	new Observable<never>((subscriber) => {
		execution = subscriber;
		subscriber.addTeardown(teardown);
	}).subscribe(undefined, { signal: subscriptionController.signal });

	subscriptionController.abort("subscription stopped");

	expect(execution.active).toBe(false);
	expect(execution.signal.reason).toBe("subscription stopped");
	expect(teardown).toHaveBeenCalledOnce();

	const terminalController = new AbortController();
	terminalController.signal.addEventListener("abort", (event) => event.stopImmediatePropagation());
	const terminal = new Observable<never>(() => {}).toArray({ signal: terminalController.signal });
	terminalController.abort("terminal stopped");

	await expect(terminal).rejects.toBe("terminal stopped");
});

it("selects and captures source protocols at the documented conversion boundaries", async () => {
	const reads: string[] = [];
	let index = 0;
	const iterator = {
		get next() {
			reads.push("next");

			return function (this: typeof iterator) {
				expect(this).toBe(iterator);
				++index;

				return index < 3 ? { value: index, done: false as const } : { value: undefined, done: true as const };
			};
		},
	};
	const values = {
		get [Symbol.iterator]() {
			reads.push("sync");

			return () => iterator;
		},
		get [Symbol.asyncIterator]() {
			reads.push("async");

			return async function* () {
				yield 99;
			};
		},
	};

	const source = Observable.from(values);
	expect(reads).toEqual(["sync"]);
	await expect(source.toArray()).resolves.toEqual([1, 2]);
	expect(reads).toEqual(["sync", "sync", "next"]);
	expect(() => Observable.from("abc" as never)).toThrow(TypeError);
});

it("accepts generic PromiseLike sources without requiring Promise identity", async () => {
	const promise = Promise.resolve(7);
	const thenable: PromiseLike<number> = { then: promise.then.bind(promise) };

	expect(thenable).not.toBeInstanceOf(Promise);
	await expect(Observable.from(thenable).toArray()).resolves.toEqual([7]);
});

it("converts counts once when deriving and preserves unsigned 64-bit wrapping", async () => {
	const source = Observable.from([1, 2]);
	const count = { valueOf: vi.fn(() => 1.9) };
	const takeOne = source.take(count as unknown as number);

	expect(count.valueOf).toHaveBeenCalledOnce();
	await expect(takeOne.toArray()).resolves.toEqual([1]);
	await expect(takeOne.toArray()).resolves.toEqual([1]);
	expect(count.valueOf).toHaveBeenCalledOnce();

	await expect(source.take(Number.NaN).toArray()).resolves.toEqual([]);
	await expect(source.drop(Number.POSITIVE_INFINITY).toArray()).resolves.toEqual([1, 2]);
	await expect(source.take(2 ** 64).toArray()).resolves.toEqual([]);
	await expect(source.drop(2 ** 64).toArray()).resolves.toEqual([1, 2]);
	await expect(source.take(-1).toArray()).resolves.toEqual([1, 2]);
	await expect(source.drop(-1).toArray()).resolves.toEqual([]);
	expect(() => source.take(Symbol("count") as unknown as number)).toThrow(TypeError);
});

it("preserves intended error types when V8 stack trimming is unavailable", async () => {
	const NativeError = Error;
	class ErrorWithoutCaptureStackTrace extends NativeError {}
	Object.defineProperty(ErrorWithoutCaptureStackTrace, "captureStackTrace", { value: undefined });
	vi.stubGlobal("Error", ErrorWithoutCaptureStackTrace);

	expect(() => new Observable(null as never)).toThrowError("Expected callback to be a function");
	await expect(Observable.from([]).first()).rejects.toEqual(
		expect.objectContaining({ name: "RangeError", message: "Observable completed without a value" }),
	);
});
