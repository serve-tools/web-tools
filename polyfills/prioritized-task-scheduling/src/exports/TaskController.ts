import type { TaskControllerConstructor } from "@serve-tools/ponyfill-prioritized-task-scheduling";
import { TaskController as fallback } from "@serve-tools/ponyfill-prioritized-task-scheduling";

const nativeValue = Reflect.get(globalThis, "TaskController");

/** The native TaskController constructor when available, otherwise the fallback constructor. */
export const TaskController: TaskControllerConstructor =
	typeof nativeValue === "function" ? (nativeValue as unknown as TaskControllerConstructor) : fallback;
