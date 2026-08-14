/** An error reconstructed from a handler failure reported by the remote server. */
export class RemoteError extends Error {
	constructor(name: string, message: string, stack?: string) {
		super(message);

		this.name = name;

		if (stack !== undefined) {
			this.stack = stack;
		}
	}
}
