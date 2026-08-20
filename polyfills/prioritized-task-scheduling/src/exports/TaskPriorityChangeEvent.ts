import type { TaskPriorityChangeEventConstructor } from "@serve-tools/ponyfill-prioritized-task-scheduling";
import { TaskPriorityChangeEvent as fallback } from "@serve-tools/ponyfill-prioritized-task-scheduling";

const nativeValue = Reflect.get(globalThis, "TaskPriorityChangeEvent");

/** The native TaskPriorityChangeEvent constructor when available, otherwise the fallback constructor. */
export const TaskPriorityChangeEvent: TaskPriorityChangeEventConstructor =
	typeof nativeValue === "function" ? (nativeValue as unknown as TaskPriorityChangeEventConstructor) : fallback;
