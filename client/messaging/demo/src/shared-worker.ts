/// <reference lib="webworker" />

import {
	activate,
	transfer,
	type WorkerHandlers,
	type WorkerOperation,
} from "@serve-tools/client-messaging/scope/shared-worker";

export type DemoProtocol = {
	requests: {
		greet: WorkerOperation<string, string>;
		fail: WorkerOperation<void, never>;
		increment: WorkerOperation<number, number>;
		wait: WorkerOperation<number, string>;
		reverse: WorkerOperation<ArrayBuffer, ArrayBuffer>;
	};
	subscriptions: {
		totals: WorkerOperation<void, number>;
	};
};

let total = 0;

const subscribers = new Set<(value: number) => void>();

const handlers = {
	requests: {
		greet: (name) => {
			if (typeof name !== "string" || !name.trim()) throw new TypeError("A name is required");

			return `Hello, ${name.trim()}!`;
		},
		fail: () => {
			throw new TypeError("The worker rejected this request on purpose");
		},
		increment: (amount) => {
			if (!Number.isFinite(amount)) throw new TypeError("The increment must be a finite number");

			total += amount;

			for (const emit of subscribers) emit(total);

			return total;
		},
		wait: (duration, { signal }) => {
			if (!Number.isFinite(duration) || duration < 0) throw new RangeError("The duration must be non-negative");

			return new Promise((resolve, reject) => {
				const timer = setTimeout(() => resolve(`Finished after ${duration.toLocaleString()} ms.`), duration);
				const abort = (): void => {
					clearTimeout(timer);
					reject(signal.reason);
				};

				signal.addEventListener("abort", abort, { once: true });
			});
		},
		reverse: (buffer) => {
			if (!(buffer instanceof ArrayBuffer)) throw new TypeError("Expected an ArrayBuffer");

			new Uint8Array(buffer).reverse();

			return transfer(buffer, [buffer]);
		},
	},
	subscriptions: {
		totals: (_input, { emit }) => {
			subscribers.add(emit);
			emit(total);

			return () => subscribers.delete(emit);
		},
	},
} satisfies WorkerHandlers<DemoProtocol>;

activate<DemoProtocol>(handlers);
