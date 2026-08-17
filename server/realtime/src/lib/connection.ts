import { reportError } from "@serve-tools/polyfill-report-error";
import type {
	ClientMessage,
	ErrorRecord,
	Protocol,
	ProtocolDefinition,
	ServerMessage,
} from "@serve-tools/realtime-protocol";
import { deserialize, isClientMessage, isErrorRecord, protocol, serialize } from "@serve-tools/realtime-protocol";
import type * as T from "./types.js";
import type {
	AnyHandler,
	Connection,
	ConnectionOptions,
	ConnectionTransport,
	Handlers,
	RequestContext,
	SubscriptionContext,
} from "./types.js";

const defaultMaximumMessageLength = 16 * 1024 * 1024;
const defaultMaximumBufferedAmount = 16 * 1024 * 1024;
const defaultMaximumOperations = 1_024;
const cancelled = Object.assign(new Error("The operation was cancelled"), { name: "AbortError" });

interface DeliveryFailure {
	readonly phase: "serialize" | "transport";
	readonly error: unknown;
}

class ServerOperation {
	#controller?: AbortController;
	#aborted = false;
	#reason: unknown;
	cleanup?: () => T.Awaitable<void>;

	get signal(): AbortSignal {
		const controller = (this.#controller ??= new AbortController());

		if (this.#aborted) {
			controller.abort(this.#reason);
		}

		return controller.signal;
	}

	abort(reason: unknown): void {
		if (this.#aborted) {
			return;
		}

		this.#aborted = true;
		this.#reason = reason;
		this.#controller?.abort(reason);
	}
}

/** Converts a failure to the default stack-redacted remote representation. */
export const defaultErrorRecord = (reason: unknown): ErrorRecord =>
	reason instanceof Error
		? { name: reason.name || "Error", message: reason.message }
		: { name: "Error", message: String(reason) };

/** Creates one typed request and subscription server over byte-oriented callbacks. */
export function createConnection<const P extends Protocol & ProtocolDefinition<P>, Context = undefined>(
	handlers: Handlers<P, Context>,
	transport: ConnectionTransport,
	context: Context,
	options: ConnectionOptions = {},
): Connection<P, Context> {
	const maximumMessageLength = positiveLimit(options.maximumMessageLength, defaultMaximumMessageLength);
	const maximumOperations = positiveLimit(options.maximumOperations, defaultMaximumOperations);
	const maximumBufferedAmount = positiveLimit(options.maximumBufferedAmount, defaultMaximumBufferedAmount);
	const operations = new Map<number, ServerOperation>();
	const closed = Promise.withResolvers<void>();
	const tables = handlers as {
		readonly requests?: Record<string, AnyHandler | undefined>;
		readonly subscriptions?: Record<string, AnyHandler | undefined>;
	};
	let isClosed = false;

	const formatError = (reason: unknown): ErrorRecord => {
		if (!options.formatError) {
			return defaultErrorRecord(reason);
		}

		try {
			const record = options.formatError(reason);

			if (isErrorRecord(record)) {
				return record.stack
					? { name: record.name, message: record.message, stack: record.stack }
					: { name: record.name, message: record.message };
			}

			reportError(new TypeError("formatError() returned an invalid ErrorRecord"));
		} catch (error) {
			reportError(error);
		}

		return defaultErrorRecord(reason);
	};

	const deliver = (message: ServerMessage): DeliveryFailure | undefined => {
		let payload: ArrayBuffer;

		try {
			payload = serialize(message);
		} catch (error) {
			return { phase: "serialize", error };
		}

		try {
			const bufferedAmount = transport.bufferedAmount?.() ?? 0;

			if (
				!Number.isFinite(bufferedAmount) ||
				bufferedAmount < 0 ||
				bufferedAmount + payload.byteLength > maximumBufferedAmount
			) {
				throw Object.assign(new Error("The transport send queue exceeds the configured maximum"), {
					name: "BackpressureError",
				});
			}

			transport.send(payload, message);
		} catch (error) {
			return { phase: "transport", error };
		}
	};

	const closeTransport = (code: number, reason: string): void => {
		try {
			transport.close(code, reason);
		} catch (error) {
			reportError(error);
		}
	};

	const runCleanup = (operation: ServerOperation): void => {
		const cleanup = operation.cleanup;

		if (!cleanup) {
			return;
		}

		delete operation.cleanup;

		Promise.resolve().then(cleanup).catch(reportError);
	};

	const finish = (reason: unknown): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		for (const [id, operation] of operations) {
			operations.delete(id);
			operation.abort(reason);
			runCleanup(operation);
		}

		closed.resolve();
	};

	const transportFailed = (error: unknown): void => {
		finish(error);
		closeTransport(1011, "Transport failure");
	};

	const settle = (
		id: number,
		operation: ServerOperation,
		outcome?: { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly reason: unknown },
	): void => {
		if (operations.get(id) !== operation) {
			return;
		}

		operations.delete(id);
		operation.abort(outcome && !outcome.ok ? outcome.reason : cancelled);

		if (outcome) {
			const message: ServerMessage = outcome.ok
				? [protocol, "resolve", id, outcome.value]
				: [protocol, "reject", id, formatError(outcome.reason)];
			const failure = deliver(message);

			if (failure) {
				if (failure.phase === "serialize" && outcome.ok) {
					const fallback = deliver([protocol, "reject", id, formatError(failure.error)]);

					if (fallback) {
						if (fallback.phase === "transport") {
							transportFailed(fallback.error);
						} else {
							reportError(fallback.error);
						}
					}
				} else if (failure.phase === "transport") {
					transportFailed(failure.error);
				} else {
					reportError(failure.error);
				}
			}
		}

		runCleanup(operation);
	};

	const failProtocol = (reason: unknown, code = 1002): void => {
		const error = Object.assign(
			new Error(
				reason instanceof Error
					? reason.message
					: reason === undefined
						? "Invalid protocol message"
						: String(reason),
			),
			{ name: code === 1009 ? "MessageTooLargeError" : "ProtocolError" },
		);

		const failure = deliver([protocol, "close", formatError(error)]);

		if (failure?.phase === "transport") {
			reportError(failure.error);
		}

		finish(error);
		closeTransport(code, code === 1009 ? "Message too large" : "Protocol error");
	};

	const reject = (id: number, reason: unknown): void => {
		const failure = deliver([protocol, "reject", id, formatError(reason)]);

		if (failure) {
			if (failure.phase === "transport") {
				transportFailed(failure.error);
			} else {
				reportError(failure.error);
			}
		}
	};

	const open = (message: Extract<ClientMessage, readonly [string, "request" | "subscribe", ...unknown[]]>): void => {
		const [, kind, id, name, input] = message;

		if (operations.has(id)) {
			failProtocol("Duplicate operation ID");

			return;
		}

		const table = kind === "request" ? tables.requests : tables.subscriptions;
		const handler = table && Object.hasOwn(table, name) ? table[name] : undefined;

		if (typeof handler !== "function") {
			reject(id, Object.assign(new Error(name), { name: "UnknownOperationError" }));

			return;
		}

		if (operations.size >= maximumOperations) {
			reject(
				id,
				Object.assign(new Error("The connection has too many active operations"), {
					name: "OperationLimitError",
				}),
			);

			return;
		}

		const operation = new ServerOperation();

		operations.set(id, operation);

		const handlerContext: RequestContext<Context> | SubscriptionContext<unknown, Context> =
			kind === "request"
				? {
						get signal() {
							return operation.signal;
						},
						connection: context,
					}
				: {
						get signal() {
							return operation.signal;
						},
						connection: context,
						emit(value): void {
							if (operations.get(id) !== operation) {
								return;
							}

							const failure = deliver([protocol, "event", id, value]);

							if (failure) {
								if (failure.phase === "serialize") {
									settle(id, operation, { ok: false, reason: failure.error });
								} else {
									transportFailed(failure.error);
								}
							}
						},
						complete(): void {
							if (operations.get(id) !== operation) {
								return;
							}

							operations.delete(id);
							operation.abort(cancelled);

							const failure = deliver([protocol, "complete", id]);

							if (failure?.phase === "transport") {
								transportFailed(failure.error);
							} else if (failure) {
								reportError(failure.error);
							}

							runCleanup(operation);
						},
						error(reason): void {
							settle(id, operation, { ok: false, reason });
						},
					};

		Promise.resolve()
			.then(() => handler(input, handlerContext as never))
			.then(
				(result) => {
					if (kind === "request") {
						settle(id, operation, { ok: true, value: result });
					} else if (typeof result === "function") {
						operation.cleanup = result as () => T.Awaitable<void>;

						if (operations.get(id) !== operation) {
							runCleanup(operation);
						}
					}
				},
				(error) => settle(id, operation, { ok: false, reason: error }),
			);
	};

	const receive = (payload: ArrayBuffer | ArrayBufferView): void => {
		if (isClosed) {
			return;
		}

		if (payload.byteLength > maximumMessageLength) {
			failProtocol("The message exceeds the configured maximum length", 1009);

			return;
		}

		let message: unknown;

		try {
			message = deserialize(payload, { maximumArrayBufferLength: maximumMessageLength });
		} catch (error) {
			failProtocol(error);

			return;
		}

		if (!isClientMessage(message)) {
			failProtocol(undefined);

			return;
		}

		if (message[1] === "request" || message[1] === "subscribe") {
			open(message);
		} else if (message[1] === "cancel") {
			const operation = operations.get(message[2]);

			if (operation) {
				settle(message[2], operation);
			}
		} else {
			finish(errorFromRecord(message[2]));
			closeTransport(1000, "");
		}
	};

	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		const error = Object.assign(
			new Error(
				reason instanceof Error
					? reason.message
					: reason === undefined
						? "The connection is closed"
						: String(reason),
			),
			{ name: "ConnectionClosedError" },
		);
		const failure = deliver([protocol, "close", formatError(error)]);

		if (failure?.phase === "transport") {
			reportError(failure.error);
		}

		finish(error);
		closeTransport(1000, "");
	};

	const disconnect = (reason?: unknown): void => finish(reason);

	return {
		receive,
		fail: failProtocol,
		closed: closed.promise,
		close,
		disconnect,
		context,
		[Symbol.dispose]: close,
	} as unknown as Connection<P, Context>;
}

/** Types used by {@link createConnection}. */
export namespace createConnection {
	export type Connection<P extends T.Protocol = T.Protocol, Context = undefined> = T.Connection<P, Context>;
	export type Handlers<P extends T.Protocol, Context = undefined> = T.Handlers<P, Context>;
	export type Options = T.ConnectionOptions;
	export type Protocol = T.Protocol;
	export type ProtocolType<Value> = T.ProtocolType<Value>;
	export type RequestContext<Context = undefined> = T.RequestContext<Context>;
	export type SubscriptionContext<Value, Context = undefined> = T.SubscriptionContext<Value, Context>;
	export type Transport = T.ConnectionTransport;
}

const positiveLimit = (value: number | undefined, fallback: number): number => {
	const limit = value ?? fallback;

	if (!Number.isSafeInteger(limit) || limit < 1) {
		throw new RangeError("Connection limits must be positive safe integers");
	}

	return limit;
};

const errorFromRecord = ({ name, message, stack }: ErrorRecord): Error => {
	const error = Object.assign(new Error(message), { name });

	if (stack !== undefined) {
		error.stack = stack;
	}

	return error;
};
