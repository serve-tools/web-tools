import { TaskPriorityChangeEvent as value } from "../exports/TaskPriorityChangeEvent.js";
import type { TaskPriority, TaskPriorityChangeEventInit } from "../types.js";

globalThis.TaskPriorityChangeEvent ?? (globalThis.TaskPriorityChangeEvent = value);

declare global {
	/** An event dispatched when a TaskSignal changes priority. */
	interface TaskPriorityChangeEvent extends Event {
		/** The priority held by the signal before this change. */
		readonly previousPriority: TaskPriority;
	}

	/** Constructs TaskPriorityChangeEvent objects. */
	var TaskPriorityChangeEvent: typeof globalThis extends { onmessage: any; TaskPriorityChangeEvent: infer T }
		? T
		: {
				/** The properties shared by task priority change events. */
				readonly prototype: TaskPriorityChangeEvent;

				/** Creates an event that retains the priority before the change. */
				new (type: string, init: TaskPriorityChangeEventInit): TaskPriorityChangeEvent;
			};
}
