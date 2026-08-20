/** The time available to an idle callback. */
export interface IdleDeadline {
	/** Whether the callback ran because its timeout elapsed. */
	readonly didTimeout: boolean;

	/** Returns the estimated milliseconds remaining in the current idle period. */
	timeRemaining(): number;
}

/** A callback invoked during an idle period or after its timeout elapses. */
export interface IdleRequestCallback {
	(deadline: IdleDeadline): void;
}

/** Options for scheduling an idle callback. */
export interface IdleRequestOptions {
	/** Maximum delay in milliseconds before the callback must run. */
	timeout?: number;
}
