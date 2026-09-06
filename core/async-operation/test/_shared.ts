import { expect } from "vitest";

import { AsyncOperation } from "../src/operation.js";

export const testDemoOperation = async (): Promise<void> => {
	const operation = new AsyncOperation<string, string>(async (write) => {
		await write("connecting");
		await write("connected");

		return "closed";
	});

	const values: string[] = [];

	expect(operation).toBeInstanceOf(AsyncOperation);
	expect(operation.signal.aborted).toBe(false);

	for await (const value of operation) {
		values.push(value);
	}

	expect(values).toEqual(["connecting", "connected"]);

	values.push(await operation.result);

	expect(values).toEqual(["connecting", "connected", "closed"]);
	expect(operation.signal.aborted).toBe(false);

	await expect(operation.finished).resolves.toBeUndefined();

	expect(operation.signal.aborted).toBe(false);

	await operation[Symbol.asyncDispose]();
};

export const testSuccessfulOperation = async (): Promise<void> => {
	let executorSignal!: AbortSignal;
	let writeAfterCompletion!: (value: string) => Promise<void>;

	const operation = new AsyncOperation<string, number>(async (write, { signal }) => {
		executorSignal = signal;

		writeAfterCompletion = write;

		await write("connecting");
		await write("ready");

		return 2;
	});

	const values: string[] = [];

	expect(operation).toBeInstanceOf(AsyncOperation);

	for await (const value of operation) {
		values.push(value);
	}

	expect(values).toEqual(["connecting", "ready"]);
	expect(await operation.result).toBe(2);

	await expect(operation.finished).resolves.toBeUndefined();

	expect(executorSignal.aborted).toBe(false);

	await operation[Symbol.asyncDispose]();

	expect(executorSignal.aborted).toBe(false);

	await expect(writeAfterCompletion("late")).rejects.toMatchObject({ name: "InvalidStateError" });
};

export const testProducerFailure = async (): Promise<void> => {
	const failure = new Error("producer failed");

	let executorSignal!: AbortSignal;

	const operation = new AsyncOperation<string, void>(async (write, { signal }) => {
		executorSignal = signal;

		await write("started");

		throw failure;
	});

	const iterator = operation[Symbol.asyncIterator]();

	expect(await iterator.next()).toEqual({ done: false, value: "started" });

	await expect(iterator.next()).rejects.toBe(failure);
	await expect(operation.result).rejects.toBe(failure);
	await expect(operation.finished).resolves.toBeUndefined();

	expect(executorSignal.aborted).toBe(false);
};

export const testCompletedIterationSurvivesDisposal = async (): Promise<void> => {
	const operation = new AsyncOperation<string, number>(async (write) => {
		await write("complete");

		return 1;
	});

	const values: string[] = [];

	for await (const value of operation) {
		values.push(value);
	}

	await operation[Symbol.asyncDispose]();

	expect(values).toEqual(["complete"]);
	expect(operation.signal.aborted).toBe(false);

	await expect(operation.result).resolves.toBe(1);
	await expect(operation.finished).resolves.toBeUndefined();
};

export const testIterationCancellation = async (): Promise<void> => {
	let executorSignal!: AbortSignal;

	const operation = new AsyncOperation<string, void>(async (write, { signal }) => {
		executorSignal = signal;

		await write("started");

		signal.throwIfAborted();

		await new Promise<never>((_, reject) => {
			signal.addEventListener("abort", () => reject(signal.reason), { once: true });
		});
	});

	for await (const value of operation) {
		expect(value).toBe("started");

		break;
	}

	expect(executorSignal.aborted).toBe(true);

	await expect(operation.result).rejects.toBe(executorSignal.reason);
	await operation[Symbol.asyncDispose]();
};

export const testAlreadyAbortedUpstreamSignal = async (): Promise<void> => {
	const abortController = new AbortController();
	const reason = new Error("already stopped");

	let started = false;

	abortController.abort(reason);

	const operation = new AsyncOperation<never, void>(
		() => {
			started = true;
		},
		{ signal: abortController.signal },
	);

	expect(started).toBe(false);

	await expect(operation.result).rejects.toBe(reason);
	await operation[Symbol.asyncDispose]();
};

export const testUpstreamAbort = async (): Promise<void> => {
	const abortController = new AbortController();
	const reason = new Error("upstream stopped");

	let executorSignal!: AbortSignal;

	const operation = new AsyncOperation<never, never>(
		(_, { signal }) => {
			executorSignal = signal;

			return new Promise((_, reject) => {
				signal.addEventListener("abort", () => reject(signal.reason), { once: true });
			});
		},
		{ signal: abortController.signal },
	);

	const pendingValue = operation[Symbol.asyncIterator]().next();

	abortController.abort(reason);

	expect(executorSignal.reason).toBe(reason);

	await expect(pendingValue).rejects.toBe(reason);
	await expect(operation.result).rejects.toBe(reason);
	await operation[Symbol.asyncDispose]();
};

export const testBackpressure = async (): Promise<void> => {
	let attemptedSecond!: () => void;

	const secondAttempted = new Promise<void>((resolve) => (attemptedSecond = resolve));

	let deliverSecond!: () => void;

	const secondDelivery = new Promise<void>((resolve) => (deliverSecond = resolve));

	let secondDelivered = false;

	const operation = new AsyncOperation<number, string>(
		async (write) => {
			await write(1);
			attemptedSecond();
			await write(2);
			secondDelivered = true;
			deliverSecond();

			return "done";
		},
		{ strategy: new CountQueuingStrategy({ highWaterMark: 1 }) },
	);

	await secondAttempted;

	expect(secondDelivered).toBe(false);

	const iterator = operation[Symbol.asyncIterator]();

	expect(await iterator.next()).toEqual({ done: false, value: 1 });

	await secondDelivery;

	expect(secondDelivered).toBe(true);
	expect(await iterator.next()).toEqual({ done: false, value: 2 });
	expect(await iterator.next()).toEqual({ done: true, value: undefined });
	expect(await operation.result).toBe("done");
};

export const testBufferedCompletionDoesNotRequireConsumption = async (): Promise<void> => {
	const operation = new AsyncOperation<number, string>(
		async (write) => {
			await write(1);
			await write(2);

			return "done";
		},
		{ strategy: new CountQueuingStrategy({ highWaterMark: 2 }) },
	);

	await expect(operation.result).resolves.toBe("done");
	await expect(operation.finished).resolves.toBeUndefined();

	expect(operation.signal.aborted).toBe(false);

	const values: number[] = [];

	for await (const value of operation) {
		values.push(value);
	}

	expect(values).toEqual([1, 2]);

	await operation[Symbol.asyncDispose]();

	expect(operation.signal.aborted).toBe(false);
};

export const testExecutorCannotReturnWithPendingWrites = async (): Promise<void> => {
	let pendingWrite!: Promise<void>;
	let writeSettled = false;

	const operation = new AsyncOperation<string, string>((write) => {
		pendingWrite = write("unconsumed");

		void pendingWrite.then(
			() => (writeSettled = true),
			() => (writeSettled = true),
		);

		return "done";
	});

	await expect(operation.finished).resolves.toBeUndefined();
	expect(writeSettled).toBe(true);

	const resultReason = await operation.result.catch((reason: unknown) => reason);

	expect(resultReason).toMatchObject({
		message: "The executor returned with pending writes.",
		name: "InvalidStateError",
	});

	await expect(pendingWrite).rejects.toBe(resultReason);
	await expect(operation[Symbol.asyncIterator]().next()).rejects.toBe(resultReason);

	expect(operation.signal.aborted).toBe(false);
};

export const testExplicitAbort = async (): Promise<void> => {
	const reason = new Error("explicitly stopped");

	let executorSignal!: AbortSignal;

	const operation = new AsyncOperation<never, never>((_, { signal }) => {
		executorSignal = signal;

		return new Promise((_, reject) => {
			signal.addEventListener("abort", () => reject(signal.reason), { once: true });
		});
	});

	const pendingValue = operation[Symbol.asyncIterator]().next();

	operation.abort(reason);

	expect(operation.signal).toBe(executorSignal);
	expect(operation.signal.reason).toBe(reason);

	await expect(pendingValue).rejects.toBe(reason);
	await expect(operation.result).rejects.toBe(reason);

	await operation[Symbol.asyncDispose]();
};

export const testDisposalWaitsForProducer = async (): Promise<void> => {
	let releaseCleanup!: () => void;

	const cleanupGate = new Promise<void>((resolve) => (releaseCleanup = resolve));

	let executorSignal!: AbortSignal;
	let producerSettled = false;

	const operation = new AsyncOperation<never, void>(async (_, { signal }) => {
		executorSignal = signal;

		try {
			await new Promise<never>((_, reject) => {
				signal.addEventListener("abort", () => reject(signal.reason), { once: true });
			});
		} finally {
			await cleanupGate;

			producerSettled = true;
		}
	});

	let disposalSettled = false;

	const finished = operation.finished;
	const disposalPromise = operation[Symbol.asyncDispose]();
	const disposal = disposalPromise.then(() => (disposalSettled = true));

	expect(disposalPromise).toBe(finished);

	await Promise.resolve();

	expect(executorSignal.aborted).toBe(true);
	expect(disposalSettled).toBe(false);

	releaseCleanup();

	await disposal;

	expect(producerSettled).toBe(true);

	await expect(operation.result).rejects.toMatchObject({ name: "AbortError" });
};

export const testDisposalReleasesAnUnconsumedWrite = async (): Promise<void> => {
	const attempted = Promise.withResolvers<void>();

	const operation = new AsyncOperation<string, void>(async (write) => {
		const writing = write("unconsumed");

		attempted.resolve();

		await writing;
	});

	await attempted.promise;
	await operation[Symbol.asyncDispose]();

	await expect(operation.result).rejects.toMatchObject({ name: "AbortError" });
	await expect(operation.finished).resolves.toBeUndefined();
};
