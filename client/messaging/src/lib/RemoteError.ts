/** An error reconstructed from a handler failure reported by the remote endpoint. */
export class RemoteError extends Error {
	/** Creates an error while preserving the remote name, message, and optional stack. */
	constructor(
		/** The remote error's name. */
		public readonly name: string,
		message: string,
		stack?: string,
	) {
		super(message);

		if (stack) {
			this.stack = stack;
		}
	}
}
