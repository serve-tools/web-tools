import { Scheduler as $Scheduler, scheduler as $scheduler } from "@serve-tools/ponyfill-prioritized-task-scheduling";

globalThis.scheduler ?? Object.assign(globalThis, { scheduler: $scheduler, Scheduler: $Scheduler });

type $SchedulerConstructor = typeof $Scheduler;
type $SchedulerInterface = $SchedulerConstructor["prototype"];

declare global {
	/** Schedules prioritized tasks and continuations. */
	interface Scheduler extends $SchedulerInterface {}

	/** Schedules prioritized tasks and continuations. */
	interface SchedulerConstructor extends $SchedulerConstructor {}

	/** Provides the non-constructible Scheduler interface object. */
	var Scheduler: typeof globalThis extends { onmessage: any; Scheduler: infer T } ? T : $SchedulerConstructor;

	/** The native or installed prioritized task scheduler. */
	var scheduler: typeof globalThis extends { onmessage: any; scheduler: infer T } ? T : Scheduler;
}
