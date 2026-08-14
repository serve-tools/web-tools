/// <reference lib="webworker" />

import type { ProtocolType } from "../../src/scope/worker.js";
import { listen, transfer } from "../../src/scope/worker.js";

let total = 0;
let cancellationCount = 0;

const subscribers = new Set<(value: number) => void>();

const connections = listen<{
	requests: {
		echo(value: string): string;
		increment(amount: number): number;
		subscriberCount(): number;
		cancellationCount(): number;
		transfer(buffer: ArrayBuffer): ArrayBuffer;
		fail(): never;
		hold(): never;
	};
	subscriptions: {
		totals(): number;
	};
}>({
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
			new Promise<never>((_resolve, reject) => {
				signal.addEventListener(
					"abort",
					() => {
						++cancellationCount;

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
});

export type SharedCounterProtocol = ProtocolType<typeof connections>;
