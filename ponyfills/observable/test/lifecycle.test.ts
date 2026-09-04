import { afterEach, expect, it, vi } from "vitest";
import { Observable, Subscriber, when } from "../src/ponyfill-observable.js";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

it("keeps concurrent derived counters, indices, and teardown independent", () => {
	const executions: Subscriber<number>[] = [];
	const cleanup = [vi.fn(), vi.fn()];
	const source = new Observable<number>((subscriber) => {
		subscriber.addTeardown(cleanup[executions.length]);
		executions.push(subscriber);
	});
	const recipe = source
		.filter((_, index) => index % 2 === 0)
		.map((value, index) => [value, index])
		.take(3);
	const a: number[][] = [];
	const b: number[][] = [];

	expect(executions).toHaveLength(0);
	recipe.subscribe((value) => a.push(value));
	executions[0].next(10);
	executions[0].next(11);
	recipe.subscribe((value) => b.push(value));
	for (let index = 0; index < 5; ++index) {
		executions[0].next(index + 12);
		executions[1].next(index + 20);
	}

	expect(a).toEqual([
		[10, 0],
		[12, 1],
		[14, 2],
	]);
	expect(b).toEqual([
		[20, 0],
		[22, 1],
		[24, 2],
	]);
	expect(cleanup[0]).toHaveBeenCalledOnce();
	expect(cleanup[1]).toHaveBeenCalledOnce();
	expect(executions[0].signal).not.toBe(executions[1].signal);
});

it.each(["complete", "error", "abort"] as const)(
	"closes exactly once on %s despite reentrant and throwing cleanup",
	(end) => {
		const failure = new Error("failure");
		const reported = vi.fn();
		vi.stubGlobal("reportError", reported);
		const controller = new AbortController();
		const cleanup = vi.fn();
		const next = vi.fn();
		const complete = vi.fn();
		const error = vi.fn();
		let execution!: Subscriber<number>;
		new Observable<number>((subscriber) => {
			execution = subscriber;
			subscriber.addTeardown(cleanup);
			subscriber.addTeardown(() => {
				expect(subscriber.active).toBe(false);
				expect(subscriber.signal.aborted).toBe(true);
				subscriber.complete();
				controller.abort(failure);
				throw failure;
			});
		}).subscribe({ next, complete, error }, { signal: controller.signal });

		if (end === "abort") {
			controller.abort(failure);
		} else if (end === "error") {
			execution.error(failure);
		} else {
			execution.complete();
		}
		execution.next(1);
		execution.complete();
		const lateCleanup = vi.fn();
		execution.addTeardown(lateCleanup);

		expect(cleanup).toHaveBeenCalledOnce();
		expect(lateCleanup).toHaveBeenCalledOnce();
		expect(reported).toHaveBeenCalledExactlyOnceWith(failure);
		expect(next).not.toHaveBeenCalled();
		expect(complete).toHaveBeenCalledTimes(end === "complete" ? 1 : 0);
		expect(error).toHaveBeenCalledTimes(end === "error" ? 1 : 0);
		if (end !== "complete") {
			expect(execution.signal.reason).toBe(failure);
		}
	},
);

it("reports late errors and missing error observers without throwing from subscribe", () => {
	const reported = vi.fn();
	vi.stubGlobal("reportError", reported);
	const failure = new Error("late");
	expect(() =>
		new Observable((subscriber) => {
			subscriber.complete();
			throw failure;
		}).subscribe(),
	).not.toThrow();
	new Observable((subscriber) => subscriber.error(failure)).subscribe();
	expect(reported.mock.calls).toEqual([[failure], [failure]]);
});

it("closes a synchronous iterator before take's completion callback", () => {
	const events: unknown[] = [];
	const values = {
		*[Symbol.iterator]() {
			try {
				yield 1;
				yield 2;
				yield 3;
			} finally {
				events.push("closed");
			}
		},
	};
	const recipe = Observable.from(values).take(2);
	for (let index = 0; index < 2; ++index) {
		recipe.subscribe({ next: (value) => events.push(value), complete: () => events.push("complete") });
	}
	expect(events).toEqual([1, 2, "closed", "complete", 1, 2, "closed", "complete"]);
});

it("initiates async iterator cleanup on abort even while next is pending", async () => {
	const controller = new AbortController();
	const pending = Promise.withResolvers<IteratorResult<number>>();
	const close = vi.fn(async () => ({ done: true, value: undefined }));
	const next = vi.fn(() => pending.promise);
	const values = { [Symbol.asyncIterator]: () => ({ next, return: close }) };
	const received = vi.fn();
	Observable.from(values).subscribe(received, { signal: controller.signal });
	controller.abort("stop");
	expect(close).toHaveBeenCalledExactlyOnceWith("stop");
	pending.resolve({ value: 1, done: false });
	await pending.promise;
	expect(received).not.toHaveBeenCalled();
	expect(next).toHaveBeenCalledOnce();
});

it("closes an async iterator when its pending pull fails", async () => {
	const failure = new Error("pull failed");
	const close = vi.fn(async () => ({ done: true, value: undefined }));
	const values = {
		[Symbol.asyncIterator]: () => ({
			next: () => Promise.reject(failure),
			return: close,
		}),
	};
	await expect(Observable.from(values).toArray()).rejects.toBe(failure);
	expect(close).toHaveBeenCalledExactlyOnceWith(failure);
});

it("reads each source protocol once during conversion and captures next per execution", async () => {
	let protocolReads = 0;
	let nextReads = 0;
	const values = {
		get [Symbol.iterator]() {
			++protocolReads;
			return () => {
				let index = 0;
				return {
					get next() {
						++nextReads;
						return () => ({ value: ++index, done: index > 2 });
					},
				};
			};
		},
	};
	const source = Observable.from(values);
	expect(protocolReads).toBe(1);
	await expect(source.toArray()).resolves.toEqual([1, 2]);
	await expect(source.toArray()).resolves.toEqual([1, 2]);
	expect(protocolReads).toBe(3);
	expect(nextReads).toBe(2);
});

it("rejects terminal cancellation independently and skips pre-aborted terminal producers", async () => {
	const controller = new AbortController();
	const executions: Subscriber<number>[] = [];
	const source = new Observable<number>((subscriber) => {
		executions.push(subscriber);
	});
	const a = source.toArray({ signal: controller.signal });
	const b = source.toArray();
	controller.abort("cancel A");
	executions[1].next(2);
	executions[1].complete();
	await expect(a).rejects.toBe("cancel A");
	await expect(b).resolves.toEqual([2]);
	await expect(source.first({ signal: controller.signal })).rejects.toBe("cancel A");
	expect(executions).toHaveLength(2);
});

const consumers: ((source: Observable<number>) => Promise<unknown>)[] = [
	(source) => source.toArray(),
	(source) => source.first(),
	(source) => source.last(),
	(source) => source.find((value) => value === 1),
	(source) => source.some((value) => value === 1),
	(source) => source.every((value) => value > 0),
	(source) => source.forEach(() => {}),
	(source) => source.reduce((sum, value) => sum + value, 0),
];

it.each(consumers)("starts a fresh execution for each terminal invocation: %s", async (consume) => {
	const signals: AbortSignal[] = [];
	const source = new Observable<number>((subscriber) => {
		signals.push(subscriber.signal);
		subscriber.next(1);
		subscriber.complete();
	});
	await Promise.all([consume(source), consume(source)]);
	expect(signals).toHaveLength(2);
	expect(signals[0]).not.toBe(signals[1]);
});

it("implements empty terminals and distinguishes an absent seed from undefined", async () => {
	const source = Observable.from<number>([]);
	await expect(source.first()).rejects.toBeInstanceOf(RangeError);
	await expect(source.last()).rejects.toBeInstanceOf(RangeError);
	await expect(source.reduce((sum, value) => sum + value)).rejects.toBeInstanceOf(RangeError);
	await expect(source.reduce<number | undefined>((sum) => sum, undefined)).resolves.toBeUndefined();
	await expect(source.find(() => true)).resolves.toBeUndefined();
	await expect(source.some(() => true)).resolves.toBe(false);
	await expect(source.every(() => false)).resolves.toBe(true);
});

it("cancels a terminal execution on a thrown visitor or predicate without affecting reuse", async () => {
	const failure = new Error("callback");
	const source = Observable.from([1, 2, 3]);
	await expect(
		source.forEach(() => {
			throw failure;
		}),
	).rejects.toBe(failure);
	await expect(
		source.find(() => {
			throw failure;
		}),
	).rejects.toBe(failure);
	await expect(source.toArray()).resolves.toEqual([1, 2, 3]);
});

it("uses independent event listeners and removes only the closed execution's listener", () => {
	const target = new EventTarget();
	const remove = vi.spyOn(target, "removeEventListener");
	const recipe = when(target, "tick").take(2);
	const a = vi.fn();
	const b = vi.fn();
	recipe.subscribe(a);
	target.dispatchEvent(new Event("tick"));
	recipe.subscribe(b);
	target.dispatchEvent(new Event("tick"));
	expect(remove).toHaveBeenCalledTimes(1);
	target.dispatchEvent(new Event("tick"));
	expect(a).toHaveBeenCalledTimes(2);
	expect(b).toHaveBeenCalledTimes(2);
	expect(remove).toHaveBeenCalledTimes(2);
});

it("does not install globals or prefer an existing native Observable", async () => {
	const native = class NativeObservable {};
	vi.stubGlobal("Observable", native);
	const descriptor = Object.getOwnPropertyDescriptor(EventTarget.prototype, "when");
	vi.resetModules();
	const ponyfill = await import("../src/ponyfill-observable.js");
	expect(Reflect.get(globalThis, "Observable")).toBe(native);
	expect(ponyfill.Observable).not.toBe(native);
	expect(Object.getOwnPropertyDescriptor(EventTarget.prototype, "when")).toEqual(descriptor);
	expect(() => Reflect.construct(Subscriber, [])).toThrow(TypeError);
});
