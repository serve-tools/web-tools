import { TaskSignal as value } from "../exports/TaskSignal.js";
import type {
	TaskPriorityChangeEvent as PonyfillTaskPriorityChangeEvent,
	TaskPriority,
	TaskSignalAnyInit,
} from "../types.js";

globalThis.TaskSignal ?? (globalThis.TaskSignal = value as typeof globalThis.TaskSignal);

declare global {
	/** An AbortSignal that carries a task priority. */
	interface TaskSignal extends AbortSignal {
		/** The event handler invoked when this signal's priority changes. */
		onprioritychange: ((this: TaskSignal, event: PonyfillTaskPriorityChangeEvent) => any) | null;

		/** The current priority associated with this signal. */
		readonly priority: TaskPriority;
	}

	/** Provides TaskSignal static operations. */
	var TaskSignal: typeof globalThis extends { onmessage: any; TaskSignal: infer T }
		? T
		: {
				/** The properties shared by task signal instances. */
				readonly prototype: TaskSignal;

				/** Combines abort signals with a fixed or inherited task priority. */
				any(signals: readonly AbortSignal[], init?: TaskSignalAnyInit): TaskSignal;
			};
}
