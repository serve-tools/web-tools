/** A semantic task priority, from highest to lowest urgency. */
export type TaskPriority = "user-blocking" | "user-visible" | "background";

/** Options for scheduling a prioritized task. */
export interface SchedulerPostTaskOptions {
	/** The minimum delay before the task is queued, in milliseconds. */
	delay?: number;

	/** An immutable priority override. */
	priority?: TaskPriority;

	/** A signal that aborts the task and, for a TaskSignal, can supply its priority. */
	signal?: AbortSignal;
}

/** A callback scheduled through Scheduler.postTask. */
export interface SchedulerPostTaskCallback<T> {
	(): PromiseLike<T> | T;
}

/** Schedules prioritized tasks and continuations. */
export interface Scheduler {
	/** Schedules a callback and returns a promise for its result. */
	postTask<T>(callback: SchedulerPostTaskCallback<T>, options?: SchedulerPostTaskOptions): Promise<T>;

	/** Yields to the event loop and schedules the calling task's continuation. */
	yield(): Promise<void>;
}

/** Provides the non-constructible Scheduler interface object. */
export interface SchedulerConstructor {
	readonly prototype: Scheduler;
}

/** Options for creating a TaskController. */
export interface TaskControllerInit {
	/** The initial priority. */
	priority?: TaskPriority;
}

/** An AbortController whose signal also carries a mutable task priority. */
export interface TaskController extends AbortController {
	readonly signal: TaskSignal;

	/** Changes the priority shared by tasks using this controller's signal. */
	setPriority(priority: TaskPriority): void;
}

/** Constructs TaskController objects. */
export interface TaskControllerConstructor {
	readonly prototype: TaskController;
	new (init?: TaskControllerInit): TaskController;
}

/** Options for composing a TaskSignal. */
export interface TaskSignalAnyInit {
	/** A fixed priority or another TaskSignal whose changes should be followed. */
	priority?: TaskPriority | TaskSignal;
}

/** An AbortSignal that carries a task priority. */
export interface TaskSignal extends AbortSignal {
	/** Handles priority changes. */
	onprioritychange: ((this: TaskSignal, event: TaskPriorityChangeEvent) => unknown) | null;

	/** The signal's current priority. */
	readonly priority: TaskPriority;
}

/** Provides TaskSignal static operations. TaskSignal is not constructible. */
export interface TaskSignalConstructor {
	readonly prototype: TaskSignal;

	/** Creates a TaskSignal aborted by any input signal and with a fixed or inherited priority. */
	any(signals: readonly AbortSignal[], init?: TaskSignalAnyInit): TaskSignal;
}

/** Initialization for TaskPriorityChangeEvent. */
export interface TaskPriorityChangeEventInit extends EventInit {
	/** The priority before the change. */
	previousPriority: TaskPriority;
}

/** An event dispatched when a TaskSignal changes priority. */
export interface TaskPriorityChangeEvent extends Event {
	/** The priority before the change. */
	readonly previousPriority: TaskPriority;
}

/** Constructs TaskPriorityChangeEvent objects. */
export interface TaskPriorityChangeEventConstructor {
	readonly prototype: TaskPriorityChangeEvent;
	new (type: string, init: TaskPriorityChangeEventInit): TaskPriorityChangeEvent;
}
