import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { cancelIdleCallback, requestIdleCallback } from "../src/ponyfill-request-idle-callback.js";

const noop = () => undefined;

test("idle callback lifecycle hot paths", async () => {
	const handles = new Array<number>(1_000);
	const sentinel = requestIdleCallback(noop);

	await benchmark(
		"request-idle-callback/enqueue-cancel-1k",
		() => {
			for (let index = 0; index < handles.length; ++index) {
				handles[index] = requestIdleCallback(noop);
			}

			for (const handle of handles) {
				cancelIdleCallback(handle);
			}
		},
		{ iterations: 100 },
	);

	cancelIdleCallback(sentinel);
});

test("idle callback drain", async () => {
	let callbackCount = 0;

	await benchmark(
		"request-idle-callback/drain-100",
		() =>
			new Promise<void>((resolve) => {
				for (let index = 1; index < 100; ++index) {
					requestIdleCallback(() => ++callbackCount);
				}

				requestIdleCallback(() => {
					++callbackCount;
					resolve();
				});
			}),
		{ iterations: 5, samples: 10, warmup: 2 },
	);

	expect(callbackCount).toBe(6_000);
});
