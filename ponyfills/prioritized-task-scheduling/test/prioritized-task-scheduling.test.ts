import { describe, expect, it, vi } from "vitest";

import {
	Scheduler,
	scheduler,
	TaskController,
	TaskPriorityChangeEvent,
	TaskSignal,
} from "../src/ponyfill-prioritized-task-scheduling.js";

it("exposes a non-constructible Scheduler interface object", () => {
	expect(scheduler).toBeInstanceOf(Scheduler);
	expect(() => Reflect.construct(Scheduler as unknown as typeof Function, [])).toThrow(TypeError);
});

describe("task controls", () => {
	it("creates TaskSignals that remain AbortSignals", () => {
		const controller = new TaskController({ priority: "background" });

		expect(controller).toBeInstanceOf(AbortController);
		expect(controller.signal).toBeInstanceOf(AbortSignal);
		expect(controller.signal).toBeInstanceOf(TaskSignal);
		expect(controller.signal.priority).toBe("background");
	});

	it("reports priority changes with the previous priority", () => {
		const controller = new TaskController();
		const listener = vi.fn();

		controller.signal.onprioritychange = listener;
		controller.setPriority("user-blocking");

		expect(listener).toHaveBeenCalledOnce();
		expect(listener.mock.calls[0]![0]).toBeInstanceOf(TaskPriorityChangeEvent);
		expect(listener.mock.calls[0]![0]).toMatchObject({ previousPriority: "user-visible" });
		expect(listener.mock.calls[0]![0].target).toBe(controller.signal);
		expect(controller.signal.priority).toBe("user-blocking");
	});

	it("rejects reentrant priority changes", () => {
		const controller = new TaskController();
		let error: unknown;

		controller.signal.onprioritychange = () => {
			try {
				controller.setPriority("background");
			} catch (caught) {
				error = caught;
			}
		};

		controller.setPriority("user-blocking");

		expect(error).toBeInstanceOf(DOMException);
		expect(error).toMatchObject({ name: "NotAllowedError" });
	});

	it("composes abort and dynamic priority with TaskSignal.any", () => {
		const abortController = new AbortController();
		const priorityController = new TaskController({ priority: "background" });
		const signal = TaskSignal.any([abortController.signal], { priority: priorityController.signal });
		const reason = new Error("cancelled");

		expect(signal.priority).toBe("background");

		priorityController.setPriority("user-blocking");
		expect(signal.priority).toBe("user-blocking");

		abortController.abort(reason);
		expect(signal.aborted).toBe(true);
		expect(signal.reason).toBe(reason);
	});
});

describe("scheduler.postTask", () => {
	it("resolves callback values and rejects callback errors", async () => {
		const error = new Error("failed");

		await expect(scheduler.postTask(() => 42)).resolves.toBe(42);
		await expect(scheduler.postTask(() => Promise.resolve(43))).resolves.toBe(43);
		await expect(
			scheduler.postTask(() => {
				throw error;
			}),
		).rejects.toBe(error);
	});

	it("runs the oldest task at the highest priority", async () => {
		const order: string[] = [];

		await Promise.all([
			scheduler.postTask(() => order.push("background"), { priority: "background" }),
			scheduler.postTask(() => order.push("visible-1")),
			scheduler.postTask(() => order.push("blocking"), { priority: "user-blocking" }),
			scheduler.postTask(() => order.push("visible-2")),
		]);

		expect(order).toEqual(["blocking", "visible-1", "visible-2", "background"]);
	});

	it("preserves a microtask checkpoint between posted tasks", async () => {
		const order: string[] = [];

		await Promise.all([
			scheduler.postTask(() => {
				order.push("task-1");
				queueMicrotask(() => order.push("microtask"));
			}),
			scheduler.postTask(() => order.push("task-2")),
		]);

		expect(order).toEqual(["task-1", "microtask", "task-2"]);
	});

	it("reprioritizes all queued work associated with a TaskSignal", async () => {
		const controller = new TaskController({ priority: "background" });
		const order: string[] = [];
		const dynamicTask = scheduler.postTask(() => order.push("dynamic"), { signal: controller.signal });
		const visibleTask = scheduler.postTask(() => order.push("visible"));

		controller.setPriority("user-blocking");

		await Promise.all([dynamicTask, visibleTask]);
		expect(order).toEqual(["dynamic", "visible"]);
	});

	it("uses an explicit priority as an immutable signal override", async () => {
		const controller = new TaskController({ priority: "user-blocking" });
		const order: string[] = [];
		const overridden = scheduler.postTask(() => order.push("overridden"), {
			priority: "background",
			signal: controller.signal,
		});
		const visible = scheduler.postTask(() => order.push("visible"));

		controller.setPriority("user-blocking");

		await Promise.all([overridden, visible]);
		expect(order).toEqual(["visible", "overridden"]);
	});

	it("rejects delayed work with the AbortSignal reason", async () => {
		const controller = new AbortController();
		const reason = new Error("cancelled");
		const callback = vi.fn();
		const task = scheduler.postTask(callback, { delay: 100, signal: controller.signal });

		controller.abort(reason);

		await expect(task).rejects.toBe(reason);
		expect(callback).not.toHaveBeenCalled();
	});

	it("queues delayed tasks only after the delay elapses", async () => {
		const order: string[] = [];
		const delayed = scheduler.postTask(() => order.push("delayed"), { delay: 10 });
		const immediate = scheduler.postTask(() => order.push("immediate"));

		await Promise.all([delayed, immediate]);
		expect(order).toEqual(["immediate", "delayed"]);
	});

	it("validates callbacks, priorities, signals, and delays synchronously", () => {
		expect(() => scheduler.postTask(null as never)).toThrow(TypeError);
		expect(() => scheduler.postTask(() => {}, { priority: "urgent" as never })).toThrow(TypeError);
		expect(() => scheduler.postTask(() => {}, { signal: {} as AbortSignal })).toThrow(TypeError);
		expect(() => scheduler.postTask(() => {}, { delay: -1 })).toThrow(TypeError);
		expect(() => scheduler.postTask(() => {}, { delay: Infinity })).toThrow(TypeError);
	});
});

describe("scheduler.yield", () => {
	it("runs a continuation before newly posted work at the same priority", async () => {
		const order: string[] = [];
		let continuation!: Promise<void>;
		let posted!: Promise<number>;

		await scheduler.postTask(() => {
			posted = scheduler.postTask(() => order.push("task"));
			continuation = scheduler.yield().then(() => {
				order.push("continuation");
			});
		});

		await Promise.all([continuation, posted]);
		expect(order).toEqual(["continuation", "task"]);
	});

	it("inherits background priority when called directly by a posted callback", async () => {
		const order: string[] = [];
		let continuation!: Promise<void>;
		let visible!: Promise<number>;

		await scheduler.postTask(
			() => {
				continuation = scheduler.yield().then(() => {
					order.push("continuation");
				});
				visible = scheduler.postTask(() => order.push("visible"));
			},
			{ priority: "background" },
		);

		await Promise.all([continuation, visible]);
		expect(order).toEqual(["visible", "continuation"]);
	});

	it("inherits abort state when called directly by a posted callback", async () => {
		const controller = new TaskController();
		const reason = new Error("cancelled");
		let continuation!: Promise<void>;

		await scheduler.postTask(
			() => {
				continuation = scheduler.yield();
			},
			{ signal: controller.signal },
		);

		controller.abort(reason);

		await expect(continuation).rejects.toBe(reason);
	});
});
