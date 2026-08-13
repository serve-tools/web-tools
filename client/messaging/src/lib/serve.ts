import {
	connectionClosedError,
	errorRecord,
	isTransferResult,
	isWireMessage,
	post,
	protocol,
	report,
	unwrapTransfer,
} from "./.internals.js";
import type {
	AnyHandler,
	MessageEndpoint,
	MessageEventLike,
	OpenMessage,
	SendResult,
	Settlement,
	WireMessage,
	WorkerHandlers,
	WorkerProtocol,
	WorkerRequestContext,
	WorkerServer,
	WorkerSubscriptionContext,
} from "./.types.js";

class ServerOperation implements WorkerRequestContext {
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
 * close the underlying transport.
 */
export function serve<const P extends WorkerProtocol>(
	endpoint: MessageEndpoint,
	handlers: WorkerHandlers<P>,
): WorkerServer<P> {
	const operations = new Map<number, ServerOperation>();
	const closed = Promise.withResolvers<void>();

	let isClosed = false;

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
		const table = kind === "request" ? handlers.requests : handlers.subscriptions;
		const handler = Object.hasOwn(table, name)
			? (table as unknown as Record<string, AnyHandler | undefined>)[name]
			: undefined;

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

		const context: WorkerRequestContext | WorkerSubscriptionContext<unknown> =
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
						const response = unwrapTransfer(result);

						settle(id, operation, { ok: true, data: response.value }, response.transfer);
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
	};
}
