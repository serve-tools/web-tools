import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const names = ["scheduler", "Scheduler", "TaskController", "TaskSignal", "TaskPriorityChangeEvent"] as const;
const descriptors = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));

const restore = () => {
	for (const name of names) {
		Reflect.deleteProperty(globalThis, name);

		const descriptor = descriptors.get(name);

		if (descriptor) {
			Object.defineProperty(globalThis, name, descriptor);
		}
	}
};

describe("Prioritized Task Scheduling polyfill", () => {
	beforeEach(() => {
		vi.resetModules();

		for (const name of names) {
			Reflect.deleteProperty(globalThis, name);
		}
	});

	afterEach(restore);

	it("installs every missing global", async () => {
		await import("../src/polyfill-prioritized-task-scheduling.js");

		expect(globalThis.scheduler.postTask).toBeTypeOf("function");
		expect(globalThis.scheduler.yield).toBeTypeOf("function");
		expect(globalThis.Scheduler).toBeTypeOf("function");
		expect(() => Reflect.construct(globalThis.Scheduler as unknown as typeof Function, [])).toThrow(TypeError);
		expect(globalThis.TaskController).toBeTypeOf("function");
		expect(globalThis.TaskSignal).toBeTypeOf("function");
		expect(globalThis.TaskPriorityChangeEvent).toBeTypeOf("function");
		expect(Object.getOwnPropertyDescriptor(globalThis, "scheduler")).toMatchObject({
			configurable: true,
			enumerable: true,
			writable: true,
		});
	});

	it("preserves an existing scheduler as one atomic native implementation", async () => {
		const postTask = vi.fn();
		const partial = { postTask };
		const NativeScheduler = class {};

		Object.defineProperty(globalThis, "scheduler", { value: partial, configurable: true, writable: true });
		Object.defineProperty(globalThis, "Scheduler", { value: NativeScheduler, configurable: true, writable: true });

		await import("../src/apply/scheduler.js");

		expect(globalThis.scheduler).toBe(partial);
		expect(globalThis.scheduler.postTask).toBe(postTask);
		expect(globalThis.scheduler.yield).toBeUndefined();
		expect(globalThis.Scheduler).toBe(NativeScheduler);
	});

	it("preserves existing interface objects", async () => {
		const NativeTaskController = class {};
		const NativeTaskSignal = class {};
		const NativeTaskPriorityChangeEvent = class {};

		Object.defineProperty(globalThis, "TaskController", { value: NativeTaskController, configurable: true });
		Object.defineProperty(globalThis, "TaskSignal", { value: NativeTaskSignal, configurable: true });
		Object.defineProperty(globalThis, "TaskPriorityChangeEvent", {
			value: NativeTaskPriorityChangeEvent,
			configurable: true,
		});

		await import("../src/apply/TaskController.js");
		await import("../src/apply/TaskSignal.js");
		await import("../src/apply/TaskPriorityChangeEvent.js");

		expect(globalThis.TaskController).toBe(NativeTaskController);
		expect(globalThis.TaskSignal).toBe(NativeTaskSignal);
		expect(globalThis.TaskPriorityChangeEvent).toBe(NativeTaskPriorityChangeEvent);
	});

	it("supports native-aware imports without global mutation", async () => {
		const schedulerModule = await import("../src/exports/scheduler.js");
		const controllerModule = await import("../src/exports/TaskController.js");

		expect(schedulerModule.scheduler.postTask).toBeTypeOf("function");
		expect(schedulerModule.scheduler.yield).toBeTypeOf("function");
		expect(schedulerModule.Scheduler).toBeTypeOf("function");
		expect(controllerModule.TaskController).toBeTypeOf("function");
		expect(Reflect.has(globalThis, "scheduler")).toBe(false);
		expect(Reflect.has(globalThis, "TaskController")).toBe(false);
	});
});
