import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { EventTargetSignal } from "../src/signal-event-target.js";

test("observation construction and dense delivery", async () => {
	const target = new EventTarget();
	let value = 0;

	await benchmark(
		"signal-event-target/create-dispose-100-observations",
		() => {
			const observations = Array.from(
				{ length: 100 },
				() => new EventTargetSignal(target, "change", () => value),
			);

			for (const observation of observations) {
				observation.dispose();
			}
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	const observations = Array.from({ length: 1_000 }, () => new EventTargetSignal(target, "change", () => value));

	await benchmark(
		"signal-event-target/deliver-value-to-1k-observations",
		() => {
			++value;
			target.dispatchEvent(new Event("change"));
		},
		{ iterations: 1_000, samples: 10, warmup: 3 },
	);

	expect(observations[0]!.get()).toBe(value);

	for (const observation of observations) {
		observation.dispose();
	}
});
