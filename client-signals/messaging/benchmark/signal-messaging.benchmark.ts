import type { Client, SubscribeOptions, Subscription } from "@serve-tools/client-messaging";
import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { observe } from "../src/signal-messaging.js";

type BenchmarkProtocol = {
	subscriptions: {
		values(): number;
	};
};

class BenchmarkClient {
	readonly listeners = new Set<(value: number) => void>();

	readonly source = {
		subscribe: (_name: string, listener: (value: number) => void, _options?: SubscribeOptions): Subscription => {
			let active = true;

			this.listeners.add(listener);

			const unsubscribe = () => {
				if (!active) {
					return;
				}

				active = false;
				this.listeners.delete(listener);
			};

			return {
				get active() {
					return active;
				},
				unsubscribe,
				[Symbol.dispose]: unsubscribe,
			};
		},
	} as unknown as Client<BenchmarkProtocol>;

	emit(value: number): void {
		for (const listener of this.listeners) {
			listener(value);
		}
	}
}

test("observation construction and dense delivery", async () => {
	const client = new BenchmarkClient();

	await benchmark(
		"signal-messaging/create-dispose-100-observations",
		() => {
			const observations = Array.from({ length: 100 }, () => observe(client.source, "values"));

			for (const observation of observations) {
				observation.dispose();
			}
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	const observations = Array.from({ length: 1_000 }, () => observe(client.source, "values"));

	let value = 0;

	await benchmark("signal-messaging/deliver-value-to-1k-observations", () => client.emit(++value), {
		iterations: 1_000,
		samples: 10,
		warmup: 3,
	});

	expect(observations[0]!.get()).toEqual({ status: "ready", value });

	for (const observation of observations) {
		observation.dispose();
	}
});
