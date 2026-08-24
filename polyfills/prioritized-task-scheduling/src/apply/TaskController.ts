import { TaskController as _TaskController } from "../exports/TaskController.js";
import type { TaskControllerInit, TaskPriority } from "../types.js";

globalThis.TaskController ?? (globalThis.TaskController = _TaskController);

declare global {
	/** An AbortController whose signal also controls task priority. */
	interface TaskController extends AbortController {
		/** The abort signal whose priority is controlled by this instance. */
		readonly signal: TaskSignal;

		/** Changes the priority shared by tasks using this controller's signal. */
		setPriority(priority: TaskPriority): void;
	}

	/** Constructs TaskController objects. */
	var TaskController: typeof globalThis extends { onmessage: any; TaskController: infer T }
		? T
		: {
				/** The methods shared by task controller instances. */
				readonly prototype: TaskController;

				/** Creates a task controller with the provided initial priority. */
				new (init?: TaskControllerInit): TaskController;
			};
}
