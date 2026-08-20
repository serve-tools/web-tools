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
		onprioritychange: ((this: TaskSignal, event: PonyfillTaskPriorityChangeEvent) => any) | null;
		readonly priority: TaskPriority;
	}

	/** Provides TaskSignal static operations. */
	var TaskSignal: typeof globalThis extends { onmessage: any; TaskSignal: infer T }
		? T
		: {
				readonly prototype: TaskSignal;
				any(signals: readonly AbortSignal[], init?: TaskSignalAnyInit): TaskSignal;
			};
}
