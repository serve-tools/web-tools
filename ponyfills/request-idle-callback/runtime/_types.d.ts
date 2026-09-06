/** The time available to an idle callback. */
export interface IdleDeadline {
	/** Whether the callback ran because its timeout elapsed. */
	readonly didTimeout: boolean;

	/** Returns the estimated milliseconds remaining in the current idle period. */
	timeRemaining(): number;
}

/** A callback invoked during an idle period or after its timeout elapses. */
export type IdleRequestCallback = (deadline: IdleDeadline) => void;

/** Options for scheduling an idle callback. */
export interface IdleRequestOptions {
	/** Maximum delay in milliseconds before the callback must run. */
	timeout?: number;
}

/** Schedules work for a runtime idle period and returns its cancellation handle. */
export declare function requestIdleCallback(callback: IdleRequestCallback, options?: IdleRequestOptions): number;

/** Cancels a callback previously scheduled by this runtime module. */
export declare function cancelIdleCallback(handle: number): void;
