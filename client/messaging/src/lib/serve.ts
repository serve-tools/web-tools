import {
	connectionClosedError,
	errorRecord,
	isTransferResult,
	isWireMessage,
	noop,
	post,
	protocol,
	report,
} from "./.internals.js";
import type * as T from "./.types.js";
import type {
	AnyHandler,
	Handlers,
	MessageEndpoint,
	MessageEventLike,
	OpenMessage,
	Protocol,
	ProtocolDefinition,
	RequestContext,
	SendResult,
	Server,
	Settlement,
	SubscriptionContext,
	WireMessage,
} from "./.types.js";

class ServerOperation implements RequestContext {
	#controller?: AbortController;
	#aborted = false;
	declare cleanup?: () => void;

	get signal(): AbortSignal {
		const controller = (this.#controller ??= new AbortController());

		if (this.#aborted) {
			controller.abort();
		}

		return controller.signal;
	}

	abort(): void {
		if (this.#aborted) {
			return;
		}

		this.#aborted = true;
		this.#controller?.abort();
	}
}

/**
 * Serves a typed collection of request and subscription handlers on an endpoint.
 *
 * The endpoint becomes protocol-owned until the server closes. Closing the server aborts active handlers but does not
 * close the underlying transport. The server finishes automatically when a client's announced Web Lock lease is
 * released by the client's destruction.
 */
export function serve<const P extends Protocol & ProtocolDefinition<P>>(
	endpoint: MessageEndpoint,
	handlers: Handlers<P>,
): Server<P> {
	const operations = new Map<number, ServerOperation>();
	const closed = Promise.withResolvers<void>();
	const tables = handlers as {
		readonly requests?: Record<string, AnyHandler | undefined>;
		readonly subscriptions?: Record<string, AnyHandler | undefined>;
	};

	let isClosed = false;
	let leaseController: AbortController | undefined;

	const send = (message: WireMessage, transfer?: readonly Transferable[]): SendResult => {
		try {
			post(endpoint, message, transfer);
			return { ok: true };
		} catch (error) {
			return { ok: false, error };
		}
	};

	const runCleanup = (operation: ServerOperation): void => {
		const cleanup = operation.cleanup;

		if (!cleanup) {
			return;
		}

		delete operation.cleanup;
		Promise.resolve().then(cleanup).catch(report);
	};

	const settle = (
		id: number,
		operation: ServerOperation,
		outcome?: Settlement,
		transfer?: readonly Transferable[],
	): void => {
		if (operations.get(id) !== operation) {
			return;
		}

		operations.delete(id);
		operation.abort();

		if (outcome) {
			const result = send(
				outcome.ok ? [protocol, "resolve", id, outcome.data] : [protocol, "reject", id, outcome.error],
				transfer,
			);

			if (!result.ok) {
				if (outcome.ok) {
					const fallback = send([protocol, "reject", id, errorRecord(result.error)]);

					if (!fallback.ok) {
						report(fallback.error);
					}
				} else {
					report(result.error);
				}
			}
		}

		runCleanup(operation);
	};

	const open = (message: OpenMessage): void => {
		const [, kind, id, name, data] = message;
		const table = kind === "request" ? tables.requests : tables.subscriptions;
		const handler = table && Object.hasOwn(table, name) ? table[name] : undefined;

		if (typeof handler !== "function" || operations.has(id)) {
			const result = send([
				protocol,
				"reject",
				id,
				typeof handler === "function"
					? { name: "ProtocolError", message: "Duplicate operation ID" }
					: { name: "UnknownOperationError", message: name },
			]);

			if (!result.ok) {
				report(result.error);
			}

			return;
		}

		const operation = new ServerOperation();

		operations.set(id, operation);

		const context: RequestContext | SubscriptionContext<unknown> =
			kind === "request"
				? operation
				: {
						get signal() {
							return operation.signal;
						},
						emit: (value) => {
							if (operations.get(id) !== operation) {
								return;
							}

							const delivery = isTransferResult(value)
								? send([protocol, "next", id, value.value], value.transfer)
								: send([protocol, "next", id, value]);

							if (!delivery.ok) {
								settle(id, operation, { ok: false, error: errorRecord(delivery.error) });
							}
						},
						complete: () => settle(id, operation, { ok: true, data: undefined }),
						error: (reason) => settle(id, operation, { ok: false, error: errorRecord(reason) }),
					};

		Promise.resolve()
			.then(() => handler(data, context))
			.then(
				(result) => {
					if (kind === "request") {
						if (isTransferResult(result)) {
							settle(id, operation, { ok: true, data: result.value }, result.transfer);
						} else {
							settle(id, operation, { ok: true, data: result });
						}
					} else if (typeof result === "function") {
						operation.cleanup = result as () => void;

						if (operations.get(id) !== operation) {
							runCleanup(operation);
						}
					}
				},
				(error) => settle(id, operation, { ok: false, error: errorRecord(error) }),
			);
	};

	const finish = (): void => {
		if (isClosed) {
			return;
		}

		isClosed = true;

		endpoint.removeEventListener("message", receive);

		leaseController?.abort();

		for (const [id, operation] of operations) {
			settle(id, operation);
		}

		closed.resolve();
	};

	const receive = ({ data }: MessageEventLike): void => {
		if (isClosed || !isWireMessage(data)) {
			return;
		}

		if (data[1] === "request" || data[1] === "subscription") {
			open(data);
		} else if (data[1] === "cancel") {
			const id = data[2];
			const operation = operations.get(id);

			if (operation) {
				settle(id, operation);
			}
		} else if (data[1] === "lease") {
			const { locks } = navigator;

			if (!leaseController && locks) {
				leaseController = new AbortController();

				void locks.request(data[2], { signal: leaseController.signal }, finish).catch(noop);
			}
		} else if (data[1] === "close") {
			finish();
		}
	};

	const close = (reason?: unknown): void => {
		if (isClosed) {
			return;
		}

		const result = send([protocol, "close", errorRecord(connectionClosedError(reason))]);

		if (!result.ok) {
			report(result.error);
		}

		finish();
	};

	endpoint.addEventListener("message", receive);
	endpoint.start?.();

	return {
		closed: closed.promise,
		close,
		[Symbol.dispose]: close,
	} as Server<P>;
}

/** Types used by {@link serve}. */
export namespace serve {
	/** Handler tables implementing every section declared by a protocol. */
	export type Handlers<P extends T.Protocol> = T.Handlers<P>;

	/** An endpoint compatible with workers and message ports. */
	export type MessageEndpoint = T.MessageEndpoint;

	/** A compile-time collection of named request and subscription signatures. */
	export type Protocol = T.Protocol;

	/** Extracts the inline protocol retained by a client, server, or listener. */
	export type ProtocolType<Value> = T.ProtocolType<Value>;

	/** State supplied to a request handler. */
	export type RequestContext = T.RequestContext;

	/** A disposable server attached to one message endpoint. */
	export type Server<P extends T.Protocol = T.Protocol> = T.Server<P>;

	/** Controls event delivery and settlement from a subscription handler. */
	export type SubscriptionContext<Value> = T.SubscriptionContext<Value>;

	/** A result value paired with objects whose ownership should be transferred. */
	export type TransferResult<Value> = T.TransferResult<Value>;
}
