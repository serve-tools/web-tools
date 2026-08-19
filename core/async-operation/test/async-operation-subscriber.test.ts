import { describe, expect, test, vi } from "vitest";
import { AsyncOperation, AsyncOperationSubscriber } from "../src/operation.js";

describe("AsyncOperationSubscriber", () => {
	test("multicasts ordered values through shared filter and map projections", async () => {
		const subscriber = new AsyncOperationSubscriber<number, string>();
		const all: [number, number][] = [];
		const even: [string, number][] = [];

		subscriber.subscribe((value, index) => {
			all.push([value, index]);
		});

		subscriber
			.filter((value) => value % 2 === 0)
			.map(async (value, index) => `${index}:${value * 2}`)
			.subscribe((value, index) => {
				even.push([value, index]);
			});

		const operation = new AsyncOperation<number, string>(async ({ write }) => {
			await write(1);
			await write(2);
			await write(3);
			await write(4);

			return "complete";
		});

		await expect(subscriber.consume(operation)).resolves.toBe("complete");
		expect(all).toEqual([
			[1, 0],
			[2, 1],
			[3, 2],
			[4, 3],
		]);
		expect(even).toEqual([
			["0:4", 0],
			["1:8", 1],
		]);
		expect(subscriber.active).toBe(false);
	});

	test("waits for all matching subscribers before requesting the next value", async () => {
		const subscriber = new AsyncOperationSubscriber<number>();
		const firstHandled = Promise.withResolvers<void>();
		const releaseFirst = Promise.withResolvers<void>();
		const writes: number[] = [];

		subscriber.subscribe(async (value) => {
			if (value !== 1) {
				return;
			}

			firstHandled.resolve();
			await releaseFirst.promise;
		});

		const operation = new AsyncOperation<number>(async ({ write }) => {
			writes.push(1);
			await write(1);
			writes.push(2);
			await write(2);
		});

		const consuming = subscriber.consume(operation);

		await firstHandled.promise;
		expect(writes).toEqual([1]);

		releaseFirst.resolve();
		await consuming;

		expect(writes).toEqual([1, 2]);
	});

	test("skips inactive projection branches", async () => {
		const subscriber = new AsyncOperationSubscriber<number>();
		const map = vi.fn((value: number) => value * 2);

		subscriber.map(map);

		const operation = new AsyncOperation<number>(async ({ write }) => {
			await write(1);
		});

		await subscriber.consume(operation);

		expect(map).not.toHaveBeenCalled();
	});

	test("disposing a view subscription stops later delivery", async () => {
		const subscriber = new AsyncOperationSubscriber<number>();
		const values: number[] = [];
		let subscription: Disposable;

		subscription = subscriber.subscribe((value) => {
			values.push(value);
			subscription[Symbol.dispose]();
		});

		const operation = new AsyncOperation<number>(async ({ write }) => {
			await write(1);
			await write(2);
		});

		await subscriber.consume(operation);

		expect(values).toEqual([1]);
	});

	test("treats duplicate callback registrations as independent subscriptions", async () => {
		const subscriber = new AsyncOperationSubscriber<number>();
		const values: number[] = [];
		const callback = (value: number): void => {
			values.push(value);
		};
		const first = subscriber.subscribe(callback);

		subscriber.subscribe(callback);
		first[Symbol.dispose]();

		const operation = new AsyncOperation<number>(async ({ write }) => {
			await write(1);
		});

		await subscriber.consume(operation);

		expect(values).toEqual([1]);
	});

	test("uses the first projection failure to cancel the operation", async () => {
		const subscriber = new AsyncOperationSubscriber<number>();
		const firstError = new Error("first");
		const secondError = new Error("second");

		subscriber.subscribe(() => {
			throw firstError;
		});
		subscriber.subscribe(() => {
			throw secondError;
		});

		const operation = new AsyncOperation<number>(async ({ write }) => {
			await write(1);
		});
		const consuming = subscriber.consume(operation);

		await expect(consuming).rejects.toBe(firstError);
		await expect(operation.result).rejects.toBe(firstError);
		expect(operation.signal.reason).toBe(firstError);
	});

	test("rejects graph changes after consumption starts", async () => {
		const subscriber = new AsyncOperationSubscriber<number>();
		const operation = new AsyncOperation<number>(() => undefined);
		const consuming = subscriber.consume(operation);

		expect(() => subscriber.subscribe(() => {})).toThrowError(DOMException);
		expect(() => subscriber.filter(Boolean)).toThrowError(DOMException);
		expect(() => subscriber.map(String)).toThrowError(DOMException);

		await consuming;
		expect(() => subscriber.consume(operation)).toThrowError(DOMException);
	});

	test("disposal cancels the owned operation and waits for cleanup", async () => {
		const subscriber = new AsyncOperationSubscriber<never>();
		const cleaned = Promise.withResolvers<void>();
		const operation = new AsyncOperation<never>(async ({ signal }) => {
			await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
			cleaned.resolve();
		});
		const consuming = subscriber.consume(operation);

		await subscriber[Symbol.asyncDispose]();

		await expect(consuming).rejects.toBe(operation.signal.reason);
		await expect(cleaned.promise).resolves.toBeUndefined();
		expect(subscriber.active).toBe(false);
	});
});
