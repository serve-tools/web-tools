import { cancelIdleCallback, requestIdleCallback } from "@serve-tools/ponyfill-request-idle-callback";

import { addTaskPriorityChangeAlgorithm, isTaskSignal, ownsTaskSignal, toTaskPriority } from "./task-controls.js";
import type {
	SchedulerConstructor,
	SchedulerPostTaskCallback,
	SchedulerPostTaskOptions,
	Scheduler as SchedulerType,
	TaskPriority,
	TaskSignal,
} from "./types.js";

const backgroundTimeout = 10_000;
const maximumDelay = 2 ** 64 - 1;
const priorityValues: Record<TaskPriority, number> = {
	background: 0,
	"user-visible": 1,
	"user-blocking": 2,
};
const schedulerKey = {};

const SchedulerImplementation = class Scheduler implements SchedulerType {
	#allQueues = new Set<TaskQueue>();
	#backgroundHandle: number | undefined;
	#channel: MessageChannel | undefined;
	#channelScheduled = false;
	#currentState: SchedulingState | null = null;
	#dynamicQueues = new Map<TaskSignal, DynamicQueues>();
	#isWindowHost = typeof document !== "undefined" && typeof requestAnimationFrame === "function";
	#nextEnqueueOrder = 0;
	#staticQueues = new Map<string, TaskQueue>();

	constructor(key: object) {
		if (key !== schedulerKey) {
			throw new TypeError("Illegal constructor");
		}
	}

	postTask<T>(callback: SchedulerPostTaskCallback<T>, options: SchedulerPostTaskOptions = {}): Promise<T> {
		if (typeof callback !== "function") {
			throw new TypeError("Scheduler.postTask requires a callback");
		}

		const normalizedOptions = options ?? {};
		const signal = normalizedOptions.signal ?? null;

		if (signal !== null && !isAbortSignal(signal)) {
			throw new TypeError("SchedulerPostTaskOptions.signal must be an AbortSignal");
		}

		const prioritySource =
			normalizedOptions.priority !== undefined
				? { priority: toTaskPriority(normalizedOptions.priority) }
				: signal !== null && isTaskSignal(signal)
					? { signal }
					: { priority: "user-visible" as const };
		const state = { abortSource: signal, prioritySource };

		return this.#scheduleTask(callback, state, false, toDelay(normalizedOptions.delay), true);
	}

	yield(): Promise<void> {
		const inheritedState = this.#currentState;
		const state: SchedulingState = inheritedState ?? {
			abortSource: null,
			prioritySource: { priority: "user-visible" },
		};

		return this.#scheduleTask(() => undefined, state, true, 0, false);
	}

	#scheduleTask<T>(
		callback: SchedulerPostTaskCallback<T>,
		state: SchedulingState,
		continuation: boolean,
		delay: number,
		establishState: boolean,
	): Promise<T> {
		const signal = state.abortSource;

		if (signal?.aborted) {
			return Promise.reject(signal.reason);
		}

		return new Promise<T>((resolve, reject) => {
			const task: ScheduledTask = {
				continuation,
				delayHandle: undefined,
				done: false,
				enqueueOrder: 0,
				queue: undefined,
				run: () => {
					if (task.done) {
						return;
					}

					let result: PromiseLike<T> | T;

					if (establishState) {
						this.#currentState = state;
					}

					try {
						result = callback();
					} catch (error) {
						task.done = true;
						reject(error);
						cleanupAbort();

						return;
					} finally {
						if (establishState) {
							this.#currentState = null;
						}
					}

					if (!task.done) {
						task.done = true;
						resolve(result);
						cleanupAbort();
					}
				},
			};

			const cleanupAbort = () => signal?.removeEventListener("abort", abort);
			const abort = () => {
				if (task.done) {
					return;
				}

				task.done = true;

				if (task.delayHandle !== undefined) {
					clearTimeout(task.delayHandle);
					task.delayHandle = undefined;
				}

				this.#removeTask(task);
				reject(signal?.reason);
				cleanupAbort();
				this.#schedule();
			};
			const enqueue = () => {
				task.delayHandle = undefined;

				if (task.done || signal?.aborted) {
					return;
				}

				const queue = this.#selectQueue(state.prioritySource, continuation);

				task.enqueueOrder = ++this.#nextEnqueueOrder;
				task.queue = queue;
				queue.tasks.add(task);

				this.#schedule();
			};

			signal?.addEventListener("abort", abort, { once: true });

			if (delay > 0) {
				task.delayHandle = setTimeout(enqueue, delay);
			} else {
				enqueue();
			}
		});
	}

	#selectQueue(source: PrioritySource, continuation: boolean): TaskQueue {
		if (!("signal" in source)) {
			const key = `${source.priority}:${continuation}`;
			const existing = this.#staticQueues.get(key);

			if (existing) {
				return existing;
			}

			const queue = this.#createQueue(source.priority, continuation, () => this.#staticQueues.delete(key));

			this.#staticQueues.set(key, queue);

			return queue;
		}

		const signal = source.signal;
		let queues = this.#dynamicQueues.get(signal);

		if (!queues) {
			const update = () => {
				const priority = toTaskPriority(Reflect.get(signal, "priority"));

				if (queues?.task) {
					queues.task.priority = priority;
				}

				if (queues?.continuation) {
					queues.continuation.priority = priority;
				}

				this.#schedule();
			};
			const cleanup = ownsTaskSignal(signal)
				? addTaskPriorityChangeAlgorithm(signal, update)
				: addPriorityChangeListener(signal, update);

			queues = { cleanup };
			this.#dynamicQueues.set(signal, queues);
		}

		const key = continuation ? "continuation" : "task";
		const existing = queues[key];

		if (existing) {
			return existing;
		}

		const queue = this.#createQueue(toTaskPriority(Reflect.get(signal, "priority")), continuation, () => {
			if (!queues) {
				return;
			}

			delete queues[key];

			if (!queues.task && !queues.continuation) {
				queues.cleanup();
				this.#dynamicQueues.delete(signal);
			}
		});

		queues[key] = queue;

		return queue;
	}

	#createQueue(priority: TaskPriority, continuation: boolean, remove: () => void): TaskQueue {
		const queue = { continuation, priority, remove, tasks: new Set<ScheduledTask>() };

		this.#allQueues.add(queue);

		return queue;
	}

	#removeTask(task: ScheduledTask): void {
		const queue = task.queue;

		if (!queue) {
			return;
		}

		queue.tasks.delete(task);
		task.queue = undefined;

		if (!queue.tasks.size) {
			this.#allQueues.delete(queue);
			queue.remove();
		}
	}

	#selectNext(background: boolean | undefined, first: boolean): ScheduledTask | undefined {
		let selected: ScheduledTask | undefined;
		let selectedPriority = -1;

		for (const queue of this.#allQueues) {
			if (background !== undefined && (queue.priority === "background") !== background) {
				continue;
			}

			const task = queue.tasks.values().next().value as ScheduledTask;

			if (first) {
				return task;
			}

			const effectivePriority = priorityValues[queue.priority] * 2 + Number(queue.continuation);

			if (
				effectivePriority > selectedPriority ||
				(effectivePriority === selectedPriority && task.enqueueOrder < (selected?.enqueueOrder ?? Infinity))
			) {
				selected = task;
				selectedPriority = effectivePriority;
			}
		}

		return selected;
	}

	#runOne(background: boolean | undefined): void {
		const task = this.#selectNext(background, false);

		if (!task) {
			return;
		}

		this.#removeTask(task);
		task.run();
	}

	#schedule(): void {
		const foregroundTask = this.#selectNext(false, true);
		const backgroundTask = this.#selectNext(true, true);

		if (this.#isWindowHost) {
			if (foregroundTask && !this.#channelScheduled) {
				this.#channelScheduled = true;
				this.#getChannel().port2.postMessage(null);
			}

			if (!foregroundTask && backgroundTask && this.#backgroundHandle === undefined) {
				this.#backgroundHandle = requestIdleCallback(this.#runBackground, { timeout: backgroundTimeout });
			} else if ((foregroundTask || !backgroundTask) && this.#backgroundHandle !== undefined) {
				cancelIdleCallback(this.#backgroundHandle);
				this.#backgroundHandle = undefined;
			}

			return;
		}

		if ((foregroundTask || backgroundTask) && !this.#channelScheduled) {
			this.#channelScheduled = true;
			this.#getChannel().port2.postMessage(null);
		}
	}

	#getChannel(): MessageChannel {
		if (this.#channel) {
			return this.#channel;
		}

		const channel = new MessageChannel();

		channel.port1.onmessage = this.#runChannel;
		unref(channel.port1);
		unref(channel.port2);

		this.#channel = channel;

		return channel;
	}

	#runChannel = () => {
		this.#channelScheduled = false;
		this.#runOne(this.#isWindowHost ? false : undefined);
		this.#schedule();
	};

	#runBackground = () => {
		this.#backgroundHandle = undefined;

		if (!this.#selectNext(false, true)) {
			this.#runOne(true);
		}

		this.#schedule();
	};
};

function isAbortSignal(value: unknown): value is AbortSignal {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof Reflect.get(value, "addEventListener") === "function" &&
		typeof Reflect.get(value, "removeEventListener") === "function" &&
		typeof Reflect.get(value, "aborted") === "boolean"
	);
}

function toDelay(value: unknown): number {
	if (value === undefined) {
		return 0;
	}

	if (typeof value === "bigint") {
		throw new TypeError("SchedulerPostTaskOptions.delay cannot be a bigint");
	}

	const number = Number(value);

	if (!Number.isFinite(number) || number < 0 || number > maximumDelay) {
		throw new TypeError("SchedulerPostTaskOptions.delay is outside the unsigned long long range");
	}

	return Math.trunc(number);
}

function addPriorityChangeListener(signal: TaskSignal, listener: () => void): () => void {
	signal.addEventListener("prioritychange", listener);

	return () => signal.removeEventListener("prioritychange", listener);
}

function unref(port: MessagePort): void {
	const unrefValue = Reflect.get(port, "unref");

	if (typeof unrefValue === "function") {
		Reflect.apply(unrefValue, port, []);
	}
}

interface DynamicQueues {
	cleanup(): void;
	continuation?: TaskQueue;
	task?: TaskQueue;
}

interface ScheduledTask {
	continuation: boolean;
	delayHandle: ReturnType<typeof setTimeout> | undefined;
	done: boolean;
	enqueueOrder: number;
	queue: TaskQueue | undefined;
	run(): void;
}

interface SchedulingState {
	abortSource: AbortSignal | null;
	prioritySource: PrioritySource;
}

type PrioritySource = { priority: TaskPriority } | { signal: TaskSignal };

interface TaskQueue {
	continuation: boolean;
	priority: TaskPriority;
	remove(): void;
	tasks: Set<ScheduledTask>;
}

/** A module-scoped prioritized task scheduler. */
export const scheduler: SchedulerType = new SchedulerImplementation(schedulerKey);

/** The non-constructible Scheduler interface object. */
export const Scheduler = SchedulerImplementation as unknown as SchedulerConstructor;

export type Scheduler = SchedulerType;
