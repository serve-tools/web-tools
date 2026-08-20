import { TaskController as _TaskController } from "../exports/TaskController.js";
import type { TaskControllerInit, TaskPriority } from "../types.js";

globalThis.TaskController ?? (globalThis.TaskController = _TaskController);

declare global {
	/** An AbortController whose signal also controls task priority. */
	interface TaskController extends AbortController {
		readonly signal: TaskSignal;

		setPriority(priority: TaskPriority): void;
	}

	/** Constructs TaskController objects. */
	var TaskController: typeof globalThis extends { onmessage: any; TaskController: infer T }
		? T
		: { readonly prototype: TaskController; new (init?: TaskControllerInit): TaskController };
}
