/// <reference lib="webworker" />

import type { ProtocolType } from "@serve-tools/client-messaging/scope/worker";
import { listen, transfer } from "@serve-tools/client-messaging/scope/worker";

let total = 0;

const subscribers = new Set<(value: number) => void>();

const connections = listen<{
	requests: {
		greet(name: string): string;
		fail(): never;
		increment(amount: number): number;
		wait(duration: number): string;
		reverse(buffer: ArrayBuffer): ArrayBuffer;
	};
	subscriptions: {
		totals(): number;
	};
}>({
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
});

export type DemoProtocol = ProtocolType<typeof connections>;
