import type { TaskSignalConstructor } from "@serve-tools/ponyfill-prioritized-task-scheduling";
import { TaskSignal as fallback } from "@serve-tools/ponyfill-prioritized-task-scheduling";

const nativeValue = Reflect.get(globalThis, "TaskSignal");

/** The native TaskSignal interface object when available, otherwise the fallback interface object. */
export const TaskSignal: TaskSignalConstructor =
	typeof nativeValue === "function" ? (nativeValue as unknown as TaskSignalConstructor) : fallback;
