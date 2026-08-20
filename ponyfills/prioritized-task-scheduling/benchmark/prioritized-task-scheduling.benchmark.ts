import { expect, test } from "vitest";

import { benchmark } from "../../../client/benchmark.js";
import { scheduler, TaskController, TaskSignal } from "../src/ponyfill-prioritized-task-scheduling.js";

const noop = () => undefined;

test("task control hot paths", async () => {
	let controller = new TaskController();

	await benchmark(
		"prioritized-task-scheduling/controller-construction",
		() => {
			controller = new TaskController();
		},
		{ iterations: 100_000 },
	);

	let priority = false;

	await benchmark(
		"prioritized-task-scheduling/priority-change",
		() => {
			controller.setPriority(priority ? "user-blocking" : "background");
			priority = !priority;
		},
		{ iterations: 100_000 },
	);

	let signal = controller.signal;

	await benchmark(
		"prioritized-task-scheduling/signal-composition",
		() => {
			const abortController = new AbortController();

			signal = TaskSignal.any([abortController.signal], { priority: "user-visible" });
			abortController.abort();
		},
		{ iterations: 10_000 },
	);

	expect(signal.aborted).toBe(true);
});

test("task enqueue and abort", async () => {
	const sentinel = scheduler.postTask(noop);

	await benchmark(
		"prioritized-task-scheduling/enqueue-abort-100",
		() => {
			const controller = new TaskController();

			for (let index = 0; index < 100; ++index) {
				void scheduler.postTask(noop, { signal: controller.signal }).catch(noop);
			}

			controller.abort();
		},
		{ iterations: 100 },
	);

	await sentinel;
});

test("task drain", async () => {
	let callbackCount = 0;

	await benchmark(
		"prioritized-task-scheduling/drain-100",
		async () => {
			const promises = Array.from({ length: 100 }, () => scheduler.postTask(() => ++callbackCount));

			await Promise.all(promises);
		},
		{ iterations: 5, samples: 10, warmup: 2 },
	);

	expect(callbackCount).toBe(6_000);
});
