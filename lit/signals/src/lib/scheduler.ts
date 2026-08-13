interface Task {
	run(): void;
}

let pendingTasks: Task[] = [];
let flushingTasks: Task[] = [];
let isScheduled = false;

const flush = (): void => {
	isScheduled = false;

	const tasks = pendingTasks;

	pendingTasks = flushingTasks;
	flushingTasks = tasks;

	let errors: unknown[] | undefined;

	for (let index = 0; index < flushingTasks.length; ++index) {
		try {
			flushingTasks[index]!.run();
		} catch (error) {
			(errors ??= []).push(error);
		}
	}

	flushingTasks.length = 0;

	if (errors?.length === 1) {
		throw errors[0];
	}

	if (errors !== undefined) {
		throw new AggregateError(errors);
	}
};

/** Adds a task to the package-wide microtask flush. */
export const enqueueMicrotask = (task: Task): void => {
	pendingTasks.push(task);

	if (!isScheduled) {
		isScheduled = true;

		queueMicrotask(flush);
	}
};

// #region Types

declare function queueMicrotask(callback: () => void): void;

// #endregion Types
