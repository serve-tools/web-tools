import type {
	TaskControllerConstructor,
	TaskControllerInit,
	TaskController as TaskControllerType,
	TaskPriority,
	TaskPriorityChangeEventConstructor,
	TaskPriorityChangeEventInit,
	TaskPriorityChangeEvent as TaskPriorityChangeEventType,
	TaskSignalAnyInit,
	TaskSignalConstructor,
	TaskSignal as TaskSignalType,
} from "./types.js";

const taskSignalStates = new WeakMap<object, TaskSignalState>();
const priorityChangeHandlers = new WeakMap<object, TaskSignalType["onprioritychange"]>();

const isTaskPriority = (value: unknown): value is TaskPriority =>
	value === "background" || value === "user-visible" || value === "user-blocking";

/** Returns a validated TaskPriority. */
export function toTaskPriority(value: unknown): TaskPriority {
	if (isTaskPriority(value)) {
		return value;
	}

	throw new TypeError(`${String(value)} is not a valid TaskPriority`);
}

/** Whether a signal carries task priority state. */
export function isTaskSignal(signal: AbortSignal): signal is TaskSignalType {
	if (taskSignalStates.has(signal)) {
		return true;
	}

	try {
		return isTaskPriority(Reflect.get(signal, "priority"));
	} catch {
		return false;
	}
}

/** Returns whether this package owns the signal's priority state. */
export const ownsTaskSignal = (signal: TaskSignalType): boolean => taskSignalStates.has(signal);

/** Returns whether an owned TaskSignal has immutable priority. */
export const hasFixedTaskPriority = (signal: TaskSignalType): boolean => taskSignalStates.get(signal)?.fixed ?? false;

/** Adds an internal priority-change algorithm to an owned TaskSignal. */
export function addTaskPriorityChangeAlgorithm(signal: TaskSignalType, algorithm: () => void): () => void {
	const state = taskSignalStates.get(signal);

	if (!state) {
		throw new TypeError("TaskSignal is not owned by this package");
	}

	state.algorithms.add(algorithm);

	return () => state.algorithms.delete(algorithm);
}

class TaskPriorityChangeEventImpl extends Event implements TaskPriorityChangeEventType {
	/** The priority held by the signal before this change. */
	readonly previousPriority: TaskPriority;

	/** Creates an event that reports the signal's previous priority. */
	constructor(type: string, init: TaskPriorityChangeEventInit) {
		if (init === undefined || init === null || !("previousPriority" in init)) {
			throw new TypeError("TaskPriorityChangeEvent requires previousPriority");
		}

		super(String(type), init);

		this.previousPriority = toTaskPriority(init.previousPriority);
	}
}

class TaskSignalImpl extends EventTarget {
	private constructor() {
		super();

		throw new TypeError("Illegal constructor");
	}

	/** Combines abort signals with a fixed or inherited task priority. */
	static any(signals: readonly AbortSignal[], init: TaskSignalAnyInit = {}): TaskSignalType {
		const inputSignals = Array.from(signals);
		const controller = new AbortController();
		const prioritySource = init.priority ?? "user-visible";
		const priority =
			typeof prioritySource === "string"
				? toTaskPriority(prioritySource)
				: toTaskPriority(Reflect.get(prioritySource, "priority"));
		const fixed =
			typeof prioritySource === "string" ||
			(ownsTaskSignal(prioritySource) && hasFixedTaskPriority(prioritySource));
		const signal = initializeTaskSignal(controller.signal, priority, fixed);
		const abortListeners = new Map<AbortSignal, () => void>();

		const cleanupAbortListeners = () => {
			for (const [input, listener] of abortListeners) {
				input.removeEventListener("abort", listener);
			}

			abortListeners.clear();
		};

		for (const input of inputSignals) {
			if (input.aborted) {
				controller.abort(input.reason);
				break;
			}

			const listener = () => {
				cleanupAbortListeners();
				controller.abort(input.reason);
			};

			abortListeners.set(input, listener);
			input.addEventListener("abort", listener, { once: true });
		}

		if (controller.signal.aborted) {
			cleanupAbortListeners();
		}

		if (typeof prioritySource !== "string" && !fixed) {
			const update = () => changeTaskPriority(signal, toTaskPriority(Reflect.get(prioritySource, "priority")));

			ownsTaskSignal(prioritySource)
				? addTaskPriorityChangeAlgorithm(prioritySource, update)
				: prioritySource.addEventListener("prioritychange", update);
		}

		return signal;
	}

	/** The event handler invoked when this signal's priority changes. */
	get onprioritychange(): TaskSignalType["onprioritychange"] {
		return priorityChangeHandlers.get(this) ?? null;
	}

	set onprioritychange(value: TaskSignalType["onprioritychange"]) {
		const signal = this as unknown as TaskSignalType;
		const previous = priorityChangeHandlers.get(this);

		if (previous) {
			signal.removeEventListener("prioritychange", previous as EventListener);
		}

		const handler = typeof value === "function" ? value : null;

		priorityChangeHandlers.set(this, handler);

		if (handler) {
			signal.addEventListener("prioritychange", handler as EventListener);
		}
	}

	/** The current priority associated with this signal. */
	get priority(): TaskPriority {
		const state = taskSignalStates.get(this);

		if (!state) {
			throw new TypeError("Illegal invocation");
		}

		return state.priority;
	}
}

Object.setPrototypeOf(TaskSignalImpl.prototype, AbortSignal.prototype);

function initializeTaskSignal(signal: AbortSignal, priority: TaskPriority, fixed: boolean): TaskSignalType {
	Object.setPrototypeOf(signal, TaskSignalImpl.prototype);
	taskSignalStates.set(signal, { algorithms: new Set(), changing: false, fixed, priority });

	return signal as TaskSignalType;
}

function changeTaskPriority(signal: TaskSignalType, priority: TaskPriority): void {
	const state = taskSignalStates.get(signal);

	if (!state) {
		throw new TypeError("TaskSignal is not owned by this package");
	}

	if (state.changing) {
		throw new DOMException("Task priority is already changing", "NotAllowedError");
	}

	if (state.priority === priority) {
		return;
	}

	const previousPriority = state.priority;

	state.changing = true;
	state.priority = priority;

	try {
		for (const algorithm of state.algorithms) {
			algorithm();
		}

		signal.dispatchEvent(new TaskPriorityChangeEventImpl("prioritychange", { previousPriority }));
	} finally {
		state.changing = false;
	}
}

class TaskControllerImpl extends AbortController implements TaskControllerType {
	/** The abort signal whose priority is controlled by this instance. */
	declare readonly signal: TaskSignalType;

	/** Creates a controller with the requested initial task priority. */
	constructor(init: TaskControllerInit = {}) {
		super();

		initializeTaskSignal(this.signal, toTaskPriority(init.priority ?? "user-visible"), false);
	}

	/** Updates the priority shared by tasks using this controller's signal. */
	setPriority(priority: TaskPriority): void {
		changeTaskPriority(this.signal, toTaskPriority(priority));
	}
}

interface TaskSignalState {
	algorithms: Set<() => void>;
	changing: boolean;
	fixed: boolean;
	priority: TaskPriority;
}

/** An AbortController whose signal also controls task priority. */
export const TaskController = TaskControllerImpl as TaskControllerConstructor;

/** An abort controller whose signal carries a mutable task priority. */
export type TaskController = TaskControllerType;

/** The TaskSignal interface object and its static composition operation. */
export const TaskSignal = TaskSignalImpl as unknown as TaskSignalConstructor;

/** An abort signal that carries a task priority. */
export type TaskSignal = TaskSignalType;

/** An event describing a TaskSignal priority change. */
export const TaskPriorityChangeEvent = TaskPriorityChangeEventImpl as TaskPriorityChangeEventConstructor;

/** An event that retains the priority before a task signal changed. */
export type TaskPriorityChangeEvent = TaskPriorityChangeEventType;
