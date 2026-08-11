/// <reference lib="webworker" />

import { activate, transfer, type WorkerHandlers, type WorkerOperation } from "../../src/scope/shared-worker.js";

export type SharedCounterProtocol = {
	requests: {
		echo: WorkerOperation<string, string>;
		increment: WorkerOperation<number, number>;
		subscriberCount: WorkerOperation<void, number>;
		cancellationCount: WorkerOperation<void, number>;
		transfer: WorkerOperation<ArrayBuffer, ArrayBuffer>;
		fail: WorkerOperation<void, never>;
		hold: WorkerOperation<void, never>;
	};
	subscriptions: {
		totals: WorkerOperation<void, number>;
	};
};

let total = 0;
let cancellationCount = 0;

const subscribers = new Set<(value: number) => void>();

const handlers: WorkerHandlers<SharedCounterProtocol> = {
	requests: {
		echo: async (value) => value,
		increment: (amount) => {
			total += amount;

			for (const emit of subscribers) emit(total);

			return total;
		},
		subscriberCount: () => subscribers.size,
		cancellationCount: () => cancellationCount,
		transfer: (buffer) => transfer(buffer, [buffer]),
		fail: () => {
			throw new TypeError("browser failure");
		},
		hold: (_input, { signal }) =>
			new Promise((_resolve, reject) => {
				signal.addEventListener(
					"abort",
					() => {
						cancellationCount++;
						reject(signal.reason);
					},
					{ once: true },
				);
			}),
	},
	subscriptions: {
		totals: (_input, { emit }) => {
			subscribers.add(emit);
			emit(total);

			return () => subscribers.delete(emit);
		},
	},
};

activate<SharedCounterProtocol>(handlers);
