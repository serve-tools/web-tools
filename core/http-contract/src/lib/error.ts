/** Safe metadata attached to a local HTTP contract failure. */
export interface ProtocolErrorOptions {
	readonly method?: string | undefined;
	readonly path?: string | undefined;
	readonly status?: number | undefined;
	readonly operationId?: string | undefined;
	readonly response?: Response | undefined;
	readonly cause?: unknown;
}

/** A local HTTP contract or protocol failure that is not an HTTP response. */
export class ProtocolError extends Error {
	readonly method: string | undefined;
	readonly path: string | undefined;
	readonly status: number | undefined;
	readonly operationId: string | undefined;
	readonly response: Response | undefined;

	constructor(message: string, options: ProtocolErrorOptions = {}) {
		super(message, options.cause === undefined ? undefined : { cause: options.cause });

		this.name = "ProtocolError";
		this.method = options.method;
		this.path = options.path;
		this.status = options.status;
		this.operationId = options.operationId;
		this.response = options.response;
	}
}
