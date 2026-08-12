/**
 * An error that was suppressed during disposal of resources.
 * Used to chain multiple errors that occur during resource cleanup.
 */
export class SuppressedError extends Error {
	/**
	 * The error that was thrown during disposal.
	 */
	declare error: unknown;

	/**
	 * The error that was suppressed.
	 */
	declare suppressed: unknown;

	/** Creates an error that retains both the latest disposal failure and the failure it suppressed. */
	constructor(error: unknown, suppressed: unknown, message?: string) {
		super(message);

		this.name = "SuppressedError";
		this.error = error;
		this.suppressed = suppressed;
	}
}
