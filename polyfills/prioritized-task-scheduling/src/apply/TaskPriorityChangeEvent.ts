import { TaskPriorityChangeEvent as value } from "../exports/TaskPriorityChangeEvent.js";
import type { TaskPriority, TaskPriorityChangeEventInit } from "../types.js";

globalThis.TaskPriorityChangeEvent ?? (globalThis.TaskPriorityChangeEvent = value);

declare global {
	/** An event dispatched when a TaskSignal changes priority. */
	interface TaskPriorityChangeEvent extends Event {
		readonly previousPriority: TaskPriority;
	}

	/** Constructs TaskPriorityChangeEvent objects. */
	var TaskPriorityChangeEvent: typeof globalThis extends { onmessage: any; TaskPriorityChangeEvent: infer T }
		? T
		: {
				readonly prototype: TaskPriorityChangeEvent;
				new (type: string, init: TaskPriorityChangeEventInit): TaskPriorityChangeEvent;
			};
}
