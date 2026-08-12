/** The time available to an idle callback. */
export interface IdleDeadline {
	/** Whether the callback ran because its timeout elapsed. */
	readonly didTimeout: boolean;

	/** Returns the estimated milliseconds remaining in the current idle period. */
	timeRemaining(): number;
}
