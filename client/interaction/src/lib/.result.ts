/** The settled outcome of a browser-mediated interaction. */
export type InteractionResult<Value> =
	| {
			/** The interaction completed successfully. */
			readonly status: "completed";

			/** The value produced by the interaction. */
			readonly value: Value;
	  }
	| {
			/** The interaction ended without completing. */
			readonly status: "aborted";
	  }
	| {
			/** The interaction failed. */
			readonly status: "failed";

			/** The original failure reason. */
			readonly error: unknown;
	  };

/** Returns a completed interaction result. */
export const completed = <Value>(value: Value): InteractionResult<Value> => ({ status: "completed", value });

/** Returns a failed interaction result without altering the failure reason. */
export const failed = (error: unknown): InteractionResult<never> => ({ status: "failed", error });

/** A shared result for interactions that ended without completing. */
export const aborted = { status: "aborted" } as const;

/** Returns whether a rejection uses the platform's abort convention. */
export const isAbortError = (reason: unknown): boolean =>
	typeof reason === "object" && reason !== null && "name" in reason && reason.name === "AbortError";

/** Settles a platform promise as an interaction result. */
export const settle = <Value>(
	promise: Promise<Value>,
	isAborted: (reason: unknown) => boolean = () => false,
): Promise<InteractionResult<Value>> =>
	promise.then(completed, (error) => (isAborted(error) ? aborted : failed(error)));

/** Returns a failure that distinguishes an insecure context from a missing API. */
export const unavailable = (name: string): InteractionResult<never> =>
	failed(
		globalThis.isSecureContext
			? new DOMException(`${name} is not supported in this browser.`, "NotSupportedError")
			: new DOMException(`${name} requires a secure context.`, "SecurityError"),
	);
