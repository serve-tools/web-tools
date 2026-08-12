type Callback = () => void;

let pendingCallbacks: Callback[] = [];
let flushingCallbacks: Callback[] = [];
let isScheduled = false;

const flush = (): void => {
	isScheduled = false;

	const callbacks = pendingCallbacks;

	pendingCallbacks = flushingCallbacks;
	flushingCallbacks = callbacks;

	let errors: unknown[] | undefined;

	for (let index = 0; index < flushingCallbacks.length; ++index) {
		try {
			flushingCallbacks[index]!();
		} catch (error) {
			(errors ??= []).push(error);
		}
	}

	flushingCallbacks.length = 0;

	if (errors?.length === 1) {
		throw errors[0];
	}

	if (errors !== undefined) {
		throw new AggregateError(errors);
	}
};

/** Adds a callback to the package-wide microtask flush. */
export const enqueueMicrotask = (callback: Callback): void => {
	pendingCallbacks.push(callback);

	if (!isScheduled) {
		isScheduled = true;

		queueMicrotask(flush);
	}
};

// #region Types

declare function queueMicrotask(callback: () => void): void;

// #endregion Types
