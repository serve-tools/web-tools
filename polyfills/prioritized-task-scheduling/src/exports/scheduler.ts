import { Scheduler as _Scheduler, scheduler as _scheduler } from "@serve-tools/ponyfill-prioritized-task-scheduling";

/** The native scheduler when available, otherwise the complete fallback scheduler. */
export const scheduler: typeof globalThis extends { onmessage: any; scheduler: infer T } ? T : typeof _scheduler =
	globalThis.scheduler ?? _scheduler;

/** The native Scheduler interface object when available, otherwise the fallback interface object. */
export const Scheduler: typeof globalThis extends { onmessage: any; Scheduler: infer T } ? T : typeof _Scheduler =
	globalThis.Scheduler ?? _Scheduler;
